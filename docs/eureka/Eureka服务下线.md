# Eureka 服务下线

应用实例关闭时，Eureka-Client 向 Eureka-Server 发起下线应用实例。需要满足如下条件才可发起：

### 关闭应用

代码如下：

```java
// DiscoveryClient.java
public synchronized void shutdown() {

    // ... 省略无关代码
	// <1>
    // If APPINFO was registered
    if (applicationInfoManager != null
         && clientConfig.shouldRegisterWithEureka() // eureka.registration.enabled = true
         && clientConfig.shouldUnregisterOnShutdown()) { // eureka.shouldUnregisterOnShutdown = true
        // <2>
        applicationInfoManager.setInstanceStatus(InstanceStatus.DOWN);
        // <3>
        unregister();
    }
}
```

- 配置 `eureka.registration.enabled = true` ，应用实例开启注册开关。默认为 `false` 。
- 配置 `eureka.shouldUnregisterOnShutdown = true` ，应用实例开启关闭时下线开关。默认为 `true` 。
- <2> 设置实例状态为 `DOWN`
- <3> 取消注册，里面会发送请求去，`EurekaServer` 取消注册。

### 取消注册

代码如下：

```java
// DiscoveryClient
void unregister() {
    // <1> 判断 eurekaTransport 状态信息
    // It can be null if shouldRegisterWithEureka == false
    if (eurekaTransport != null && eurekaTransport.registrationClient != null) {
        try {
            logger.info("Unregistering ...");
            // <2> 主动 取消注册(优雅的关闭)
            EurekaHttpResponse<Void> httpResponse = eurekaTransport.registrationClient.cancel(instanceInfo.getAppName(), instanceInfo.getId());
            logger.info(PREFIX + "{} - deregister  status: {}", appPathIdentifier, httpResponse.getStatusCode());
        } catch (Exception e) {
            logger.error(PREFIX + "{} - de-registration failed{}", appPathIdentifier, e.getMessage(), e);
        }
    }
}
```

说明：

- <1> 判断 `eurekaTransport` 状态信息。
- <2> 主动 取消注册(优雅的关闭)，发送请求到 `EurekaServer` 进行关闭。

## EurekaServer 接收取消

### 接受取消

代码如下：

```java
@DELETE
public Response cancelLease(@HeaderParam(PeerEurekaNode.HEADER_REPLICATION) String isReplication) {
    try {
        // <1> 调用 PeerAwareInstanceRegistry 进行关闭
        boolean isSuccess = registry.cancel(app.getName(), id, "true".equals(isReplication));
        // 关闭是否成功
        if (isSuccess) {
            logger.debug("Found (Cancel): {} - {}", app.getName(), id);
            return Response.ok().build();
        } else {
            // <2.2> 关闭失败返回 NOT_FOUND
            logger.info("Not Found (Cancel): {} - {}", app.getName(), id);
            return Response.status(Status.NOT_FOUND).build();
        }
    } catch (Throwable e) {
        logger.error("Error (cancel): {} - {}", app.getName(), id, e);
        return Response.serverError().build();
    }
}
```

说明：

- <1> 调用 PeerAwareInstanceRegistry 进行关闭。
- <2.2> 关闭失败返回 NOT_FOUND

### 取消注册 1

代码如下：

```java
// PeerAwareInstanceRegistryImpl
@Override
public boolean cancel(final String appName, final String id, final boolean isReplication) {
    // <1> 调用 super.cancel()
    if (super.cancel(appName, id, isReplication)) {
        // <2> tip: 关闭成功后，复制给其他节点
        replicateToPeers(Action.Cancel, appName, id, null, null, isReplication);
        return true;
    }
    return false;
}
```

说明：

- <1> 调用 super.cancel() 进行关闭，关闭成功后，进行节点信息复制。
- <2> tip: 关闭成功后，复制给其他节点。

### 调用内部取消

代码如下：

```java
protected boolean internalCancel(String appName, String id, boolean isReplication) {
    // <1> ReentrantReadWriteLock 读取lock
    read.lock();
    try {
        // <2> 取消注册计数 +1
        CANCEL.increment(isReplication);
        // <3> 从 registry 根据 appName 获取注册实例
        Map<String, Lease<InstanceInfo>> gMap = registry.get(appName);
        // <4> 记录删除的实例
        Lease<InstanceInfo> leaseToCancel = null;
        if (gMap != null) {
            // 删除注册的实例
            leaseToCancel = gMap.remove(id);
        }

        // <5>
        // tip: recentCanceledQueue 是一个取消的队列
        // tip: overriddenInstanceStatusMap 用于保存服务状态

        // 将取消的实例，添加到 recentCanceledQueue
        recentCanceledQueue.add(new Pair<Long, String>(System.currentTimeMillis(), appName + "(" + id + ")"));
        // <6> 删除实例的状态缓存
        InstanceStatus instanceStatus = overriddenInstanceStatusMap.remove(id);
        if (instanceStatus != null) {
            logger.debug("Removed instance id {} from the overridden map which has value {}", id, instanceStatus.name());
        }
        // <7> leaseToCancel 是我们删除的实例，如果没找到，这里需要 +1
        if (leaseToCancel == null) {
            // 未找到取消 count +1
            CANCEL_NOT_FOUND.increment(isReplication);
            logger.warn("DS: Registry: cancel failed because Lease is not registered for: {}/{}", appName, id);
            return false;
        } else {
            // <8> tip: 这里的 cancel 里面只是更新了一个 evictionTimestamp(驱逐时间)
            leaseToCancel.cancel();
            // <9> 获取的是 InstanceInfo 实例信息
            InstanceInfo instanceInfo = leaseToCancel.getHolder();
            String vip = null;
            String svip = null;
            if (instanceInfo != null) {
                // <9.1> 设置 actionType 为 deleted
                instanceInfo.setActionType(ActionType.DELETED);
                // <9.2> 添加到 最近变化queue
                recentlyChangedQueue.add(new RecentlyChangedItem(leaseToCancel));
                // <9.3> 更新最后 更新时间
                instanceInfo.setLastUpdatedTimestamp();
                // <9.4> 这是两个虚拟的 vip 地址，没有设置获取的是ip
                vip = instanceInfo.getVIPAddress();
                svip = instanceInfo.getSecureVipAddress();
            }
            // <10> 将缓存失效
            invalidateCache(appName, vip, svip);
            logger.info("Cancelled instance {}/{} (replication={})", appName, id, isReplication);
        }
    } finally {
        read.unlock();
    }

    // <11> tip: 更新一下客户端数量，关闭了一个客户端 这里需要 -1
    synchronized (lock) {
        if (this.expectedNumberOfClientsSendingRenews > 0) {
            // Since the client wants to cancel it, reduce the number of clients to send renews.
            this.expectedNumberOfClientsSendingRenews = this.expectedNumberOfClientsSendingRenews - 1;
            // <11.2> 更新每分钟阈值(客户端数量，和请求的延迟，这些信息)
            updateRenewsPerMinThreshold();
        }
    }
    return true;
}
```

说明：

- <1> ReentrantReadWriteLock 读取 lock
- <2> 取消注册计数 +1
- <3> 从 registry 根据 appName 获取注册实例
- <4> 记录删除的实例
- <5> 将取消的实例，添加到 recentCanceledQueue
- <6> 删除实例的状态缓存
- <7> leaseToCancel 是我们删除的实例，如果没找到，这里需要 +1
- <8> tip: 这里的 cancel 里面只是更新了一个 evictionTimestamp(驱逐时间)
- <9> 获取的是 InstanceInfo 实例信息
- <9.1> 设置 actionType 为 deleted
- <9.2> 添加到 最近变化 queue
- <9.3> 更新最后 更新时间
- <9.4> 这是两个虚拟的 vip 地址，没有设置获取的是 ip
- <10> 将缓存失效
- <11> tip: 更新一下客户端数量，关闭了一个客户端 这里需要 -1
- <11.2> 更新每分钟阈值(客户端数量，和请求的延迟，这些信息)

#### 更新每分钟阀值 updateRenewsPerMinThreshold

代码如下：

```java
protected void updateRenewsPerMinThreshold() {

    // tip：这里计算的是 eureka server 当前的阀值
    // tip: 默认 getRenewalPercentThreshold 最大为 85%

    // <1> tip: 客户端心跳时间(默认30秒) / 60 = 2(服务端预期能够在60秒收到客户端几次心跳)
    double d1 = (60.0 / serverConfig.getExpectedClientRenewalIntervalSeconds());
    // <2> tip: 客户端发送续约，预期的一个数量(就是客户端数量) * 每分钟能够收到几次心跳
    double d2 = this.expectedNumberOfClientsSendingRenews * d1;
    // tip: eureka server 配置的百分比阀值(85%)，计算每分钟阀值(d2 * eurekaServer配置的百分比阀值)
    // <3> tip: 如果预期为 100 个心跳之 * 0.85 = 85个心跳
    this.numberOfRenewsPerMinThreshold = (int) (d2 * serverConfig.getRenewalPercentThreshold());
}
```

说明：

- <1> tip: 客户端心跳时间(默认 30 秒) / 60 = 2(服务端预期能够在 60 秒收到客户端几次心跳)
- <2> tip: 客户端发送续约，预期的一个数量(就是客户端数量) \* 每分钟能够收到几次心跳
- <3> tip: 如果预期为 100 个心跳之 \* 0.85 = 85 个心跳

完结~

## 问答

1. 关闭的时候，缓存是怎么失效的？

   `EurekaServer` 关闭的时候，会调用 `invalidateCache` 进行缓存失效。

2. 每分钟阈值的续订次数，是怎么计算的？

   - 根据每分钟，预计收到的次数
   - 预计客户端收到的次数
   - 每分钟阈值的续订次数

3. eureka 客户端取消注册的时候，状态修改为什么？

   会将 `InstanceInfo` 信息的状态设置为 `DOWN`

4. eureka 客户端取消注册成功后，怎么更新到其他节点？

   会调用 `replicateToPeers` 进行节点同步
