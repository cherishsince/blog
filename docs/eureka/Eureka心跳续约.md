# Eureka 心跳续约

## EurekaClient 心跳续约

Eureka 采用心跳的方式，维持服务的活跃，确保服务可用，默认每 30 秒一次，每次有效期 90 秒，配置如下:

```yml
eureka:
  client:
    register-with-eureka: true # 注册到 Eureka-Server，默认为 true
    fetch-registry: true # 从 Eureka-Server 获取注册表，默认为 true
    service-url:
      defaultZone: http://127.0.0.1:8761/eureka/ # Eureka-Server 地址
  instance:
    instanceId: ${spring.application.name}:${vcap.application.instance_id:${spring.application.instance_id:${random.value}}}
    leaseRenewalIntervalInSeconds: 1 # 发送心跳间隔时间(发送续约间隔时间)，默认30秒
    lease-expiration-duration-in-seconds: 2 # 续约时间，默认90秒
```

说明：

- `leaseRenewalIntervalInSeconds` 发送心跳间隔时间(发送续约间隔时间)，默认 30 秒
- `lease-expiration-duration-in-seconds` # 续约时间，默认 90 秒

### 心跳定时任务

心跳任务是在，初始化任务的时候创建，代码如下：

```java
/**
 * 初始化所有调度任务
 */
private void initScheduledTasks() {
    // 略...

    // <2> 注册eureka
    if (clientConfig.shouldRegisterWithEureka()) {
        int renewalIntervalInSecs = instanceInfo.getLeaseInfo().getRenewalIntervalInSecs();
        int expBackOffBound = clientConfig.getHeartbeatExecutorExponentialBackOffBound();
        logger.info("Starting heartbeat executor: " + "renew interval is: {}", renewalIntervalInSecs);

        // <2.1> 心跳任务
        // Heartbeat timer
        heartbeatTask = new TimedSupervisorTask(
                "heartbeat",
                scheduler,
                heartbeatExecutor,
                renewalIntervalInSecs,
                TimeUnit.SECONDS,
                expBackOffBound,
                new HeartbeatThread()
        );
        scheduler.schedule(
                heartbeatTask,
                renewalIntervalInSecs, TimeUnit.SECONDS);

        // 略...
    } else {
        logger.info("Not registering with Eureka server per configuration");
    }
}
```

说明：

- <2.1> 创建了一个心跳任务，`TimedSupervisorTask` 继承了 `TimeTask` ，里面做了扩展，相当于被 `scheduler` 调用后，`TimedSupervisorTask` 里面会无限循环调用。

- `HeartbeatThread` 这是一个，心跳的任务，里面是一个 Runnable

  ```java
  private class HeartbeatThread implements Runnable {
      // tip: 心跳调用的就是 renew 续订动作
      public void run() {
          if (renew()) {
              lastSuccessfulHeartbeatTimestamp = System.currentTimeMillis();
          }
      }
  }
  ```

##### TimedSupervisorTask

代码如下：

```java
public class TimedSupervisorTask extends TimerTask {
    private static final Logger logger = LoggerFactory.getLogger(TimedSupervisorTask.class);

    private final Counter successCounter;
    private final Counter timeoutCounter;
    private final Counter rejectedCounter;
    private final Counter throwableCounter;
    private final LongGauge threadPoolLevelGauge;

    private final String name;
    private final ScheduledExecutorService scheduler;
    private final ThreadPoolExecutor executor;
    private final long timeoutMillis;
    private final Runnable task;

    private final AtomicLong delay;
    private final long maxDelay;

    public TimedSupervisorTask(String name, ScheduledExecutorService scheduler, ThreadPoolExecutor executor,
                               int timeout, TimeUnit timeUnit, int expBackOffBound, Runnable task) {
        this.name = name;
        // <1.1> 调度执行器
        this.scheduler = scheduler;
        // <1.2> 执行器
        this.executor = executor;
        this.timeoutMillis = timeUnit.toMillis(timeout);
        this.task = task;
        this.delay = new AtomicLong(timeoutMillis);
        // <1.3> 最大延时时间
        this.maxDelay = timeoutMillis * expBackOffBound;

        // <1.4> 初始化计数器并注册。
        // Initialize the counters and register.
        successCounter = Monitors.newCounter("success");
        timeoutCounter = Monitors.newCounter("timeouts");
        rejectedCounter = Monitors.newCounter("rejectedExecutions");
        throwableCounter = Monitors.newCounter("throwables");
        threadPoolLevelGauge = new LongGauge(MonitorConfig.builder("threadPoolUsed").build());
        Monitors.registerObject(name, this);
    }

    @Override
    public void run() {
        // <2.1> Future 任务
        Future<?> future = null;
        try {
            future = executor.submit(task);
            // <2.2> 获取线程池 激活的数量 设置到threadPoolLevelGauge
            threadPoolLevelGauge.set((long) executor.getActiveCount());
            // <2.3> 获取 future 返回值信息，设置一个超时时间
            future.get(timeoutMillis, TimeUnit.MILLISECONDS);  // block until done or timeout
            // <2.4> 设置延时时间
            // tip: TimedSupervisorTask 构造方法中也初始化一次，这里每次 run 的时候重新设置，catch 中会重新计算本次请求的时间
            delay.set(timeoutMillis);
            // <2.5> 获取线程池 激活的数量 设置到threadPoolLevelGauge
            threadPoolLevelGauge.set((long) executor.getActiveCount());
            // <2.6> 这就是一个 AtomicLong 计数器，每次都 +1
            successCounter.increment();
        } catch (TimeoutException e) {
            logger.warn("task supervisor timed out", e);
            // <3.1> 超时记录
            timeoutCounter.increment();
            // tip: 超时时间和最大超时时间，取最小，所以在设置的时候需要注意
            long currentDelay = delay.get();
            long newDelay = Math.min(maxDelay, currentDelay * 2);
            // <3.2> 重新设置延时时间
            delay.compareAndSet(currentDelay, newDelay);

            // tip：超时时间10秒，最大30秒
            // tip: 超时后进入，newDelay 是 20秒，delay 就是 20，下次请求超时时间就会变大（用于处理服务器网络波动情况）
            // tip: delay 是只增不减的，只要 timeout 一次，那么时间就是 newDelay
        } catch (RejectedExecutionException e) {
            if (executor.isShutdown() || scheduler.isShutdown()) {
                logger.warn("task supervisor shutting down, reject the task", e);
            } else {
                logger.warn("task supervisor rejected the task", e);
            }
            // 请求拒绝，每次都 +1
            rejectedCounter.increment();
        } catch (Throwable e) {
            if (executor.isShutdown() || scheduler.isShutdown()) {
                logger.warn("task supervisor shutting down, can't accept the task");
            } else {
                logger.warn("task supervisor threw an exception", e);
            }
            // 未知的异常，每次都 +1
            throwableCounter.increment();
        } finally {
            // <5.1> 关闭 future
            if (future != null) {
                future.cancel(true);
            }
            // <5.2>
            // tip：这里有点意思，这是一个死循环(scheduler 线程池没有关闭的情况下)
            // tip: scheduler 是一个外部传入的 ScheduledExecutorService，外面没有关闭 scheduler 那么就会一直 run.
            if (!scheduler.isShutdown()) {
                scheduler.schedule(this, delay.get(), TimeUnit.MILLISECONDS);
            }
        }
    }

    @Override
    public boolean cancel() {
        // 取消注册
        Monitors.unregisterObject(name, this);
        return super.cancel();
    }
}
```

说明：

- <1.1> 调度执行器，从外面传入的，采用的是 `schedule` 的方式(只会执行一次)，在 finally 的时候，会再次 `schedule` ，然后变成了无限调用，这也是这个累的核心。
- <1.4> 初始化计数器，执行成功，失败，都会有相应计数。

##### HeartbeatThread 心跳任务

```java
private class HeartbeatThread implements Runnable {
    // <1> tip: 心跳调用的就是 renew 续订动作
    public void run() {
        if (renew()) {
            lastSuccessfulHeartbeatTimestamp = System.currentTimeMillis();
        }
    }
}
```

说明：

- 是一个简单的 `Runnable` 任务，调用 `renew()` 进行心跳续约。

### EurekaClient 续约

心跳续约，代码如下：

```java
boolean renew() {
    EurekaHttpResponse<InstanceInfo> httpResponse;
    try {
        // <1> 发送心跳
        httpResponse = eurekaTransport.registrationClient.sendHeartBeat(
                instanceInfo.getAppName(), instanceInfo.getId(), instanceInfo, null);
        logger.debug(PREFIX + "{} - Heartbeat status: {}", appPathIdentifier, httpResponse.getStatusCode());
        // <2> 再发送心跳过程中，如果服务不存在，再次调用 register，去注册服务
        if (httpResponse.getStatusCode() == Status.NOT_FOUND.getStatusCode()) {
            // <2.1> 注册服务 count +1
            REREGISTER_COUNTER.increment();
            logger.info(PREFIX + "{} - Re-registering apps/{}", appPathIdentifier, instanceInfo.getAppName());
            // <2.2> 将当前时间作为脏数据设置
            long timestamp = instanceInfo.setIsDirtyWithTime();
            // <2.3> 调用服务注册
            boolean success = register();
            if (success) {
                // 取消脏数据标识
                instanceInfo.unsetIsDirty(timestamp);
            }
            return success;
        }
        return httpResponse.getStatusCode() == Status.OK.getStatusCode();
    } catch (Throwable e) {
        logger.error(PREFIX + "{} - was unable to send heartbeat!", appPathIdentifier, e);
        return false;
    }
}
```

说明：

- <1> 发送心跳请求，这里就是一个 `http`请求，发送给 `EurekaServer`
- <2> 如果续约，返回 NOT_FOUND，**就再发送心跳过程中，如果服务不存在，再次调用 register，去注册服务**
- <2.3> 调用服务注册
- `InstanceInfo` 是 client 统计到的，实力数据信息。

### InstanceInfo 实力信息

代码如下：

```java
public class InstanceInfo {
    // 略...


    /**
     * 默认端口号 7001
     */
    public static final int DEFAULT_PORT = 7001;
    // 默认端口号 7002
    public static final int DEFAULT_SECURE_PORT = 7002;
    public static final int DEFAULT_COUNTRY_ID = 1; // US

    // 注册到 eureka server 上面的名称(192.168.0.101:demo-provider:18080)
    // ${spring.cloud.client.ipAddress}:${spring.application.name}:${spring.application.instance_id:${server.port}}
    // The (fixed) instanceId for this instanceInfo. This should be unique within the scope of the appName.
    private volatile String instanceId;

    // 配置的 DEMO-PROVIDER(会转换为大写)
    private volatile String appName;
    // 默认group为null
    @Auto
    private volatile String appGroupName;
    /**
     * ip地址 192.168.0.101
     */
    private volatile String ipAddr;

    private static final String SID_DEFAULT = "na";
    @Deprecated
    private volatile String sid = SID_DEFAULT;
    // 获取的是 server.port，默认 7001
    private volatile int port = DEFAULT_PORT;
    // 保护端口号
    private volatile int securePort = DEFAULT_SECURE_PORT;

    // http://192.168.0.101:18080/
    @Auto
    private volatile String homePageUrl;
    // http://192.168.0.101:18080/actuator/info
    @Auto
    private volatile String statusPageUrl;
    // http://192.168.0.101:18080/actuator/health
    @Auto
    private volatile String healthCheckUrl;
    @Auto
    private volatile String secureHealthCheckUrl;
    // demo-provider
    @Auto
    private volatile String vipAddress;
    // demo-provider
    @Auto
    private volatile String secureVipAddress;
    // /actuator/info
    @XStreamOmitField
    private String statusPageRelativeUrl;
    // http://192.168.0.101:18080/actuator/info
    @XStreamOmitField
    private String statusPageExplicitUrl;
    // /actuator/health
    @XStreamOmitField
    private String healthCheckRelativeUrl;
    @XStreamOmitField
    private String healthCheckSecureExplicitUrl;
    // demo-provider
    @XStreamOmitField
    private String vipAddressUnresolved;
    // demo-provider
    @XStreamOmitField
    private String secureVipAddressUnresolved;
    // http://192.168.0.101:18080/actuator/health
    @XStreamOmitField
    private String healthCheckExplicitUrl;
    @Deprecated
    private volatile int countryId = DEFAULT_COUNTRY_ID; // Defaults to US
    private volatile boolean isSecurePortEnabled = false;
    private volatile boolean isUnsecurePortEnabled = true;
    private volatile DataCenterInfo dataCenterInfo;
    private volatile String hostName;
    private volatile InstanceStatus status = InstanceStatus.UP;
    private volatile InstanceStatus overriddenStatus = InstanceStatus.UNKNOWN;
    @XStreamOmitField
    private volatile boolean isInstanceInfoDirty = false;
    private volatile LeaseInfo leaseInfo;
    @Auto
    private volatile Boolean isCoordinatingDiscoveryServer = Boolean.FALSE;
    @XStreamAlias("metadata")
    private volatile Map<String, String> metadata;
    // 最后更新时间（初始化的时候是 当前时间）
    @Auto
    private volatile Long lastUpdatedTimestamp;
    // 最后脏数据时间
    @Auto
    private volatile Long lastDirtyTimestamp;
    // 注册时 add(里面有 add delete modify)
    @Auto
    private volatile ActionType actionType;
    @Auto
    private volatile String asgName;
    // 默认是 unknown 未知的，从服务器拉取注册信息后，会和服务器版本保持一致
    private String version = VERSION_UNKNOWN;

    private InstanceInfo() {
        this.metadata = new ConcurrentHashMap<String, String>();
        // 最后更新时间
        this.lastUpdatedTimestamp = System.currentTimeMillis();
        // 最后脏数据时间
        this.lastDirtyTimestamp = lastUpdatedTimestamp;
    }

    // 略...
}
```

说明：

- `InstanceInfo` 里面保护了，向 `EurekaServer` 发送请求的地址(心跳、注册、关闭服务)，实例的 id、服务的名字、服务的分组、ipAddr，这些信息。

## EurekaServer 心跳续约

### 接收心跳信息

代码如下：

```java
@PUT
public Response renewLease(
        @HeaderParam(PeerEurekaNode.HEADER_REPLICATION) String isReplication,
        @QueryParam("overriddenstatus") String overriddenStatus,
        @QueryParam("status") String status,
        @QueryParam("lastDirtyTimestamp") String lastDirtyTimestamp) {
    // <1> isReplication 标记是否是复制(集群节点复制的时候为 true)
    // tip: 用户心跳续约这个为 false，然后会调用集群同步为true的时候，为true的时候就不会去同步到其他节点去
    boolean isFromReplicaNode = "true".equals(isReplication);
    // <2> 调用心跳续约
    boolean isSuccess = registry.renew(app.getName(), id, isFromReplicaNode);

    // Not found in the registry, immediately ask for a register
    if (!isSuccess) {
        logger.warn("Not Found (Renew): {} - {}", app.getName(), id);
        return Response.status(Status.NOT_FOUND).build();
    }
    // Check if we need to sync based on dirty time stamp, the client
    // instance might have changed some value
    Response response;
    if (lastDirtyTimestamp != null && serverConfig.shouldSyncWhenTimestampDiffers()) {
        response = this.validateDirtyTimestamp(Long.valueOf(lastDirtyTimestamp), isFromReplicaNode);
        // Store the overridden status since the validation found out the node that replicates wins
        if (response.getStatus() == Response.Status.NOT_FOUND.getStatusCode()
                && (overriddenStatus != null)
                && !(InstanceStatus.UNKNOWN.name().equals(overriddenStatus))
                && isFromReplicaNode) {
            registry.storeOverriddenStatusIfRequired(app.getAppName(), id, InstanceStatus.valueOf(overriddenStatus));
        }
    } else {
        // <3> 续约成功
        response = Response.ok().build();
    }
    logger.debug("Found (Renew): {} - {}; reply status={}", app.getName(), id, response.getStatus());
    return response;
}
```

说明：

- <1> 用户心跳续约这个为 false，然后会调用集群同步为 true 的时候，为 true 的时候就不会去同步到其他节点去。
- <2> 调用心跳续约，成功返回 true，失败为 false。

### 心跳续约 registry.renew()

```java
// PeerAwareInstanceRegistryImpl
public boolean renew(final String appName, final String id, final boolean isReplication) {
    // 执行心跳续约
    if (super.renew(appName, id, isReplication)) {
        // 复制到其他节点
        replicateToPeers(Action.Heartbeat, appName, id, null, null, isReplication);
        return true;
    }
    return false;
}
```

说明：

- `PeerAwareInstanceRegistryImpl` 里面的 `renew` 是提供了集群的动作。
- 执行 **心跳续约** 成功后，会将信息复制到其他节点去。

### 心跳续约 super.renew()

代码如下：

```java
// AbstractInstanceRegistry

// 注册的实例
private final ConcurrentHashMap<String, Map<String, Lease<InstanceInfo>>> registry
            = new ConcurrentHashMap<String, Map<String, Lease<InstanceInfo>>>();

public boolean renew(String appName, String id, boolean isReplication) {
    // 续约次数 +1
    RENEW.increment(isReplication);
    // 根据 appName 获取注册的实例节点信息
    Map<String, Lease<InstanceInfo>> gMap = registry.get(appName);

    // 获取续约的节点
    Lease<InstanceInfo> leaseToRenew = null;
    if (gMap != null) {
        leaseToRenew = gMap.get(id);
    }
    // <1>
    // tip: 没有找到续约的节点，这里会返回一个 NOT_FOUND
    // tip: client 收到 NOT_FOUND，会去调用register进行注册
    if (leaseToRenew == null) {
        RENEW_NOT_FOUND.increment(isReplication);
        logger.warn("DS: Registry: lease doesn't exist, registering resource: {} - {}", appName, id);
        return false;
    } else {
        // tip: 心跳续约

        // tip: getHolder 保存的是我们 client 注册的 InstanceInfo
        InstanceInfo instanceInfo = leaseToRenew.getHolder();
        if (instanceInfo != null) {
            // touchASGCache(instanceInfo.getASGName());
            // 获取覆盖实例状态(这一步)
            InstanceStatus overriddenInstanceStatus = this.getOverriddenInstanceStatus(
                    instanceInfo, leaseToRenew, isReplication);
            // UNKNOWN 是一个未知的状态
            if (overriddenInstanceStatus == InstanceStatus.UNKNOWN) {
                logger.info("Instance status UNKNOWN possibly due to deleted override for instance {}"
                        + "; re-register required", instanceInfo.getId());
                RENEW_NOT_FOUND.increment(isReplication);
                return false;
            }
            if (!instanceInfo.getStatus().equals(overriddenInstanceStatus)) {
                logger.info(
                        "The instance status {} is different from overridden instance status {} for instance {}. "
                                + "Hence setting the status to overridden status", instanceInfo.getStatus().name(),
                        overriddenInstanceStatus.name(),
                        instanceInfo.getId());
                instanceInfo.setStatusWithoutDirty(overriddenInstanceStatus);
            }
        }
        // <2> 续租每分钟次数 +1
        renewsLastMin.increment();
        // <3> 设置 租约最后更新时间（续租）
        leaseToRenew.renew();
        return true;
    }
}
```

说明：

- `register` 是一个 ConcurrentMap 保存的是，实例注册的信息。

- 就是根据 **appName** 获取，注册的实例信息，然后调用 `leaseToRenew.renew()` 更新过期时间。

- 注意：根据 **appName** 没有获取到注册的实例信息(`leaseToRenew == null`) 的时候，会返回一个 `NOT_FOUND`，客户端接收到会调用 register 重新注册。

- `renewsLastMin` 这个比较重要，是一个统计数据：

  - EurekaServer 运维界面的显示**续租每分钟次数**。
  - EurekaServer 的自我保护机制。

- <3> 是一个**续约** 更新一下最后更新时间 = 当前时间 + 续约时间(Eureka 里面用到了大量的 Timer，定时处理，比如服务剔除，也只是标记一下过期时间)。这里知识更新一下时间，移除任务是交给，驱逐去检测，如果过期了就会移除任务。

  ```java
  // Lease
  public void renew() {
      lastUpdateTimestamp = System.currentTimeMillis() + duration;
  }
  ```

> 心跳续约，知识更新了过期时间，因为 Eureka 采用的 Timer 会定时检查过期时间，过期了就会剔除；注意：如果开启了 **自我保护** 那么就不会立即剔除，而是需要一段时间。

### replicateToPeers 节点复制

代码如下：

```java
private void replicateToPeers(Action action, String appName, String id,
                              InstanceInfo info /* optional */,
                              InstanceStatus newStatus /* optional */, boolean isReplication) {
    // <1> 开始计时
    Stopwatch tracer = action.getTimer().start();
    try {
        // <2> 是否复制
        if (isReplication) {
            // 复制次数 +1
            numberOfReplicationsLastMin.increment();
        }
        // <2> 没有eureka其他节点 || 不复制就直接返回
        // If it is a replication already, do not replicate again as this will create a poison replication
        if (peerEurekaNodes == Collections.EMPTY_LIST || isReplication) {
            return;
        }

        // <3> 循环节点，挨个复制
        for (final PeerEurekaNode node : peerEurekaNodes.getPeerEurekaNodes()) {
            // <3.1> 排除自己
            // 如果该URL代表此主机，请不要复制到您自己。
            // If the url represents this host, do not replicate to yourself.
            if (peerEurekaNodes.isThisMyUrl(node.getServiceUrl())) {
                continue;
            }
            // <3.2> 调用复制
            // tip: 就是复制请求，是register就发送register，是 Cancel 就发送 Cancel
            replicateInstanceActionsToPeers(action, appName, id, info, newStatus, node);
        }
    } finally {
        tracer.stop();
    }
}
```

说明：

- <1> 就只是做一个计时使用
- <2> 没有 eureka 其他节点 || 不复制就直接返回
- <3.1> 排除自己，如果是自己就不用发送了
- <3.2> 调用复制，就是复制请求，是 register 就发送 register，是 Cancel 就发送 Cancel(注意，如果是复制请求，发送的时候 `isReplication=false` 会设置为 false)

完结~

## 问答

1. EurekaClient 是怎么发送心跳续约的？

   EurekaClient 是采用一个 `scheduler` 定时调用，默认是 30 秒一次

2. EurekaClient 默认发送心跳续约，有效时间是多少

   90 秒

3. EurekaClinet 发送续约请求的时候，返回 NOT_FOUND 的时候，应该怎么办？

   EurekaClient 会判断，如果是 NOT_FOUND 会调用，register 注册服务

4. EurekaClient 心跳续约，会注册哪些信息过去？

   实例 id、服务名、服务分组、ip 地址，这些信息

5. EurekaServer 怎么接收 client 发送过来的续约信息？

   是在 InstanceResource 里面，renewLease 方法进行接收

6. EurekaServer 里面的 `isReplication` 参数是拿来干嘛的？

   `isReplication` 用于标记请求，是否需要复制到其他节点，

7. EurekaServer 是怎么复制节点信息的？

   - 时候 ``isReplication`` 如果为 false，或者 EurekaServiceUrl 节点为空的时候，就不会复制；

   - 在复制的过程中，会排除自己

   - 在发送复制请求的时候，会将 isReplication 设置为 false，这样下一个收到请求的时候，就不会再复制到其他节点去了。

8. EurekaServer 怎么续约的？

   EurekaServer 续约，只是更新了 InstanceInfo 里面的 lastUpdateTimestamp 时间，因为任务驱逐来移除，过期的任务。
