# EurekaServer 驱逐

**EurekaServer 驱逐** 是 <u>**未及时续约**</u> 或 **<u>异常退出</u>** 的服务，`Eureka` 会有专门的 `Timer` 来进行扫描，需要注意的是**<u>只有关闭自我保护的情况下才会进行</u>**。

### 驱逐的 TimerTask

代码如下：

```java
// AbstractInstanceRegistry
class EvictionTask extends TimerTask {

    private final AtomicLong lastExecutionNanosRef = new AtomicLong(0l);

    @Override
    public void run() {
        try {
            // <1> tip：compensationTimeMs 是补偿时间，用于 gc、时钟的偏移
            long compensationTimeMs = getCompensationTimeMs();
            logger.info("Running the evict task with compensationTime {}ms", compensationTimeMs);
            // <2> 调用驱逐
            evict(compensationTimeMs);
        } catch (Throwable e) {
            logger.error("Could not run the evict task", e);
        }
    }

    /**
     * 计算补偿时间，该补偿时间定义为自上次迭代以来此任务实际执行的时间，与配置的执行时间之比。
     * 当时间变化（例如由于时钟偏斜或gc）导致实际驱逐任务的执行时间晚于所需时间（根据配置的周期）时，此功能很有用。
     */
    long getCompensationTimeMs() {
        // tip: 补偿时间计算

        // <1> 获取电器时间(纳米时间)
        long currNanos = getCurrentTimeNano();
        // 上一次驱逐时间
        // tip: 这里是 getAndSet 首次是0，下一次就是上一次驱逐时间
        // tip: 0 就代表不会补偿
        long lastNanos = lastExecutionNanosRef.getAndSet(currNanos);
        if (lastNanos == 0l) {
            return 0l;
        }
        // <2> 相差时间 = 当前时间和上一次执行时间
        long elapsedMs = TimeUnit.NANOSECONDS.toMillis(currNanos - lastNanos);
        // <3> 配置的驱逐时间
        long compensationTime = elapsedMs - serverConfig.getEvictionIntervalTimerInMs();
        // <4> 情况好的话为小于 0，所以返回0，不好的情况下会补充时间
        return compensationTime <= 0l ? 0l : compensationTime;
    }

    long getCurrentTimeNano() {  // for testing
        return System.nanoTime();
    }
}
```

说明：

- `EurekaServer` 驱逐是一个 `TimerTask` ，默认驱逐时间为 60 秒， 可以设置 `evictionIntervalTimerInMs` 进行配置。

- <1> 获取的这个补偿时间，是比较有意思的，这个补充时间是，用于 **时钟偏移，gc，实例的数量，服务器之间同步** ，根据上一次执行的时间，来确定本次补充的大小。

- `getCompensationTimeMs` 里面是补充逻辑，和 `getEvictionIntervalTimerInMs` 驱逐时间有很大关系（具体看代码注释信息）。

### 调用驱逐

```java
public void evict(long additionalLeaseMs) {
    logger.debug("Running the evict task");
    // <0> 没有开启驱逐，就直接 return
    if (!isLeaseExpirationEnabled()) {
        logger.debug("DS: lease expiration is currently disabled.");
        return;
    }

    // 我们首先收集所有过期的物品，以随机顺序将其逐出。
    // 对于大型驱逐集，如果不这样做，我们可能会在自我保护开始之前先清除整个应用程序。
    // 通过将其随机化，其影响应均匀地分布在所有应用程序中。
    // We collect first all expired items, to evict them in random order. For large eviction sets,
    // if we do not that, we might wipe out whole apps before self preservation kicks in. By randomizing it,
    // the impact should be evenly distributed across all applications.

    // <1> 收集需要驱逐的实例，这里会随机驱逐，为什么需要随机驱逐呢? 这是自我保护机制的一种，
    // 如果本次驱逐大于某一个值，就会触发随机驱逐，驱逐的实例过多，会将某些应用实例全部清空
    List<Lease<InstanceInfo>> expiredLeases = new ArrayList<>();
    for (Entry<String, Map<String, Lease<InstanceInfo>>> groupEntry : registry.entrySet()) {
        Map<String, Lease<InstanceInfo>> leaseMap = groupEntry.getValue();
        if (leaseMap != null) {
            for (Entry<String, Lease<InstanceInfo>> leaseEntry : leaseMap.entrySet()) {
                Lease<InstanceInfo> lease = leaseEntry.getValue();
                // <1.1> 调用 isExpired 判断是否过期
                if (lease.isExpired(additionalLeaseMs) && lease.getHolder() != null) {
                    expiredLeases.add(lease);
                }
            }
        }
    }

    // 为了补偿GC的暂停或本地时间的漂移，我们需要使用当前注册表大小作为触发自我保存的基础。否则，我们将清除完整的注册表。
    // To compensate for GC pauses or drifting local time, we need to use current registry size as a base for
    // triggering self-preservation. Without that we would wipe out full registry.

    // <2> 获取注册的实例(实例，不是应用，一个应用可能多个实例)
    int registrySize = (int) getLocalRegistrySize();
    // <3> 获取续订百分比阈值，默认为85%，如果 registrySize 100个 * 0.85 = 15个
    int registrySizeThreshold = (int) (registrySize * serverConfig.getRenewalPercentThreshold());
    // <4> 驱逐限制 85，最大驱逐就是 85%
    int evictionLimit = registrySize - registrySizeThreshold;
    // <5> 驱逐大小，和驱逐限制，取一个最小值
    // tip: toEvict 就是最终驱逐的数量
    int toEvict = Math.min(expiredLeases.size(), evictionLimit);
    if (toEvict > 0) {
        logger.info("Evicting {} items (expired={}, evictionLimit={})", toEvict, expiredLeases.size(), evictionLimit);

        Random random = new Random(System.currentTimeMillis());
        for (int i = 0; i < toEvict; i++) {
            // <5.1> 选择一个随机项目（Knuth随机算法）
            // Pick a random item (Knuth shuffle algorithm)
            int next = i + random.nextInt(expiredLeases.size() - i);
            // <5.2> 随机打乱 collection，采用 swap交替位置
            Collections.swap(expiredLeases, i, next);
            Lease<InstanceInfo> lease = expiredLeases.get(i);

            //
            String appName = lease.getHolder().getAppName();
            String id = lease.getHolder().getId();
            EXPIRED.increment();
            logger.warn("DS: Registry: expired lease for {}/{}", appName, id);
            // <5.3> 取消实例，这里就去 register 删除实例了
            internalCancel(appName, id, false);
        }
    }
}

```

说明：

- 驱逐顺序是，1、收集驱逐的实例 2、计算驱逐数量 3、执行随机驱逐

- <0> 是否启用续租到期处理，这个和自我保护也有关系 **(说明如下)**

- <1> 收集驱逐实例, 调用 `isExpired` **判断是否过期** **(说明如下)**

##### <0> 是否启动续租到期处理

```java
// PeerAwareInstanceRegistryImpl
@Override
public boolean isLeaseExpirationEnabled() {
    // <1> 关闭自我保护进入
    if (!isSelfPreservationModeEnabled()) {
        // 自保留模式被禁用，因此允许实例过期。
        // The self preservation mode is disabled, hence allowing the instances to expire.
        return true;
    }
    // <2>
    // getNumOfRenewsInLastMin: 续租每分钟次数
    // numberOfRenewsPerMinThreshold: 每分钟阈值的续订次数(根据默认 85%计算，100个实例至少需要85个心跳次数)
    return numberOfRenewsPerMinThreshold > 0 && getNumOfRenewsInLastMin() > numberOfRenewsPerMinThreshold;
}
```

说明：

- <1> 关闭自我保护，每次都是 true，相当于每次都驱逐。
- <2> 开启自我保护，这个需要和 <u>"续租每分钟次数"</u> 以及 <u>"每分钟阈值的续订次数(根据默认 85%计算，100 个实例至少需要 85 个心跳次数) "</u> 进行计算；简单理解就是，<u>"每分钟的一个预期心跳值"</u> 和 <u>"最后一分钟统计的心跳值"</u> 进行对比，统计的值 > 预期值的时候 = true

##### <1> isExpired 判断是否过期

```java
// Lease
public boolean isExpired(long additionalLeaseMs) {
    /**
      * tip: 注意: 由于{@link #cancel()} 里面 lastUpdateTimestamp = 当前时间 + 续约时间，应该叫过期时间，而不是最后更新时间
      */
    // tip: additionalLeaseMs 这是一个服务器同步 预计消耗的时间(只是一个预估时间)
    // 剔除时间大于0(大于0就需要剔除) = 过期
    // 当前时间 > 过期时间 = 过期
    return (evictionTimestamp > 0 || System.currentTimeMillis() > (lastUpdateTimestamp + duration + additionalLeaseMs));
}
```

说明：

- additionalLeaseMs 这是一个服务器同步 预计消耗的时间(只是一个预估时间)
- duration 是 client 续约的一个有效时间（每次续约需要保持多久），
- 当前时间 > 过期时间 = 过期

### 配置说明

```yml
eureka:
  client:
    # 禁用client刷新，自动刷新会导致，刷新的时候短暂的不可用 https://cloud.spring.io/spring-cloud-netflix/reference/html/#netflix-eureka-client-starter
    refresh:
      enable: false
    register-with-eureka: false # 不注册到 Eureka-Server，默认为 true
    fetch-registry: false # 不从 Eureka-Server 获取注册表，默认为 true
    healthcheck: # 开启心跳机制
      enabled: true
  server:
    enable-self-preservation: true # 关闭自我保护
    evictionIntervalTimerInMs: 60000 # 驱逐定时时间(默认60秒)
```

说明：

- evictionIntervalTimerInMs 可以设置驱逐时间，检测的就越频繁，默认 60 秒
- enable-self-preservation 可以关闭自我保护，默认是 true

完结~

### 问答

1. 驱逐是什么？

   答：**EurekaServer 驱逐** 是 <u>**未及时续约**</u> 或 **<u>异常退出</u>** 的服务

2) 自我保护(enable-self-preservation) 为 true 时，怎么才能启动驱逐？

   答：开启自我保护的时候，有个阈值( `renewalPercentThreshold` 默认 85%)，如果触发了自我保护机制，就不会启动驱逐。

3. 自我保护(enable-self-preservation) 为 false 时，怎么才能启动驱逐？为什么？

   答：关闭自我保护时，会每次启动驱逐。因为自我保护，就是为了解决异常的情况(在同一时间段 100 个实例，就收到了 1 个实例的心跳，这就是异常)，有个阈值( `renewalPercentThreshold` 默认 85%)，都关闭了自我保护，就随便我怎么驱逐。

4) 说一下 numberOfRenewsPerMinThreshold、renewsLastMin、expectedNumberOfClientsSendingRenews 这几个属性？

   `numberOfRenewsPerMinThreshold` 每分钟阈值的续订次数(根据默认 85%计算，100 个实例至少需要 85 个心跳次数)

   `expectedNumberOfClientsSendingRenews`客户端发送续约，预期的一个数量(就是客户端数量)

   `renewsLastMin` 续租每分钟次数
