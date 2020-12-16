# EurekaServer 缓存

`EurekaServer` 是有缓存机制的；假设没有缓存机制，大家可想而知，一个集群下来 服务的注册、服务的信息拉取，都是一个非常高频的操作，而且需要保证数据安全就需要加锁，在写的时候就不能读了，这样性能是很低的。

### 缓存机制

`EurekaServer` 缓存采用 `ResponseCache` 实现，就 `ResponseCacheImpl` 一个实现类，`ResponseCache` 代码如下：

```java
public interface ResponseCache {
    /**
     * 缓存失效
     */
    void invalidate(String appName, @Nullable String vipAddress, @Nullable String secureVipAddress);

    /**
     * 获取增量的版本号
     */
    AtomicLong getVersionDelta();

    /**
     * 获取带有区域的版本Delta
     */
    AtomicLong getVersionDeltaWithRegions();

    /**
     * 获取有关应用程序的缓存信息。
     */
     String get(Key key);

    /**
     * gzip 的数据格式
     */
    byte[] getGZIP(Key key);

    /**
     * 通过停止内部线程并取消注册伺服监视器来关闭此缓存。
     */
    void stop();
}
```

### 缓存

缓存分为两种，代码如下：

```java
/**
 * 只读缓存
 */
private final ConcurrentMap<Key, Value> readOnlyCacheMap = new ConcurrentHashMap<Key, Value>();
/**
 * 读写缓存
 */
private final LoadingCache<Key, Value> readWriteCacheMap;
```

说明：

- readOnlyCacheMap 只读缓存，是一个 ConcurrentMap 只负责读取，也是 readWriteCacheMap 的一个二级缓存。
- readWriteCacheMap 读写缓存，使用的时 guava 来实现的，默认 180 秒过期

### 只读缓存 readOnlyCacheMap

代码如下：

```java
@VisibleForTesting
Value getValue(final Key key, boolean useReadOnlyCache) {
    Value payload = null;
    try {
        // <1> 是否使用缓存
        if (useReadOnlyCache) {
            // tip: readOnlyCacheMap 是一个只读缓存

            // <2> 从只读缓存中获取
            final Value currentPayload = readOnlyCacheMap.get(key);
            if (currentPayload != null) {
                payload = currentPayload;
            } else {
                // <2.1> 没有从 读写缓存获取
                // tip: 如果 readWriteCacheMap 缓存也没有怎么办呢?
                // tip: readWriteCacheMap 是 guava 的 LoadingCache 缓存，可以看创建LoadingCache地方，get 不到的策略处理
                payload = readWriteCacheMap.get(key);
                readOnlyCacheMap.put(key, payload);
            }
        } else {
            // <3> 读写缓存中获取
            payload = readWriteCacheMap.get(key);
        }
    } catch (Throwable t) {
        logger.error("Cannot get value for key : {}", key, t);
    }
    return payload;
}
```

说明：

- <1> 是否使用缓存
- <2> 从只读缓存中获取，没有的时候，调用 readWriteCacheMap 缓存获取，然后在设置到 readOnlyCacheMap 中

### 读写缓存

读写缓存实在，`ResponseCacheImpl` 创建的时候，构建的代码如下：

```java
// ResponseCacheImpl

// 构造方法
// guava 的 LoadingCache
this.readWriteCacheMap =
        CacheBuilder.newBuilder().initialCapacity(serverConfig.getInitialCapacityOfResponseCache())
                 // <1> 缓存过期时间，默认180秒
                .expireAfterWrite(serverConfig.getResponseCacheAutoExpirationInSeconds(), TimeUnit.SECONDS)
                // <2> 删除后的监听
                .removalListener(new RemovalListener<Key, Value>() {
                    @Override
                    public void onRemoval(RemovalNotification<Key, Value> notification) {
                        Key removedKey = notification.getKey();
                        if (removedKey.hasRegions()) {
                            Key cloneWithNoRegions = removedKey.cloneWithoutRegions();
                            regionSpecificKeys.remove(cloneWithNoRegions, removedKey);
                        }
                    }
                })
                // <3> CacheLoader 是缓存加载(就是 get 不到的时候，就会进入这里)
                .build(new CacheLoader<Key, Value>() {
                    @Override
                    public Value load(Key key) throws Exception {
                        //
                        if (key.hasRegions()) {
                            Key cloneWithNoRegions = key.cloneWithoutRegions();
                            regionSpecificKeys.put(cloneWithNoRegions, key);
                        }
                        // <3.2> 去加载新的数据
                        Value value = generatePayload(key);
                        return value;
                    }
                });
```

说明：

- `serverConfig.getResponseCacheAutoExpirationInSeconds()` 是一个缓存过期时间，默认 180 秒。
- <3> 是一个重点，当一个 key 不存在缓存的时候，会回调这里。
- <3.2> 去加载新的数据

#### 加载新的数据

```java
// ResponseCacheImpl#generatePayload(Key key)
// 略...
boolean isRemoteRegionRequested = key.hasRegions();
if (ALL_APPS.equals(key.getName())) {
    // <1> tip: ALL_APPS 全量获取

    if (isRemoteRegionRequested) {
        tracer = serializeAllAppsWithRemoteRegionTimer.start();
        // <1.1> 获取远程服务的
        payload = getPayLoad(key, registry.getApplicationsFromMultipleRegions(key.getRegions()));
    } else {
        tracer = serializeAllAppsTimer.start();
        // <1.2> 获取本地服务的
        // 1、registry.getApplications() 获取全部的 applications
        payload = getPayLoad(key, registry.getApplications());
    }
} else if (ALL_APPS_DELTA.equals(key.getName())) {
    // <2> tip: ALL_APPS_DELTA 增量获取

    if (isRemoteRegionRequested) {
        tracer = serializeDeltaAppsWithRemoteRegionTimer.start();
        versionDeltaWithRegions.incrementAndGet();
        versionDeltaWithRegionsLegacy.incrementAndGet();
        payload = getPayLoad(key,
                registry.getApplicationDeltasFromMultipleRegions(key.getRegions()));
    } else {
        tracer = serializeDeltaAppsTimer.start();
        // 增量计数 +1
        versionDelta.incrementAndGet();
        versionDeltaLegacy.incrementAndGet();
        // 1、registry.getApplicationDeltas() 从增量队列中获取 applications
        // 2、获取 value
        payload = getPayLoad(key, registry.getApplicationDeltas());
    }
} else {
    tracer = serializeOneApptimer.start();
    payload = getPayLoad(key, registry.getApplication(key.getName()));
}
break;

// 略...
```

说明：

- <1> <2> 时获取的方式，全量获取 和 增量获取
- <1.2> 全量本地获取

### 全量获取

##### 获取 applications 信息

```java
// AbstractInstanceRegistry
public Applications getApplications() {
    boolean disableTransparentFallback = serverConfig.disableTransparentFallbackToOtherRegion();
    if (disableTransparentFallback) {
        // <1> 本地获取 applications
        return getApplicationsFromLocalRegionOnly();
    } else {
        // <2> 云服务器的 eureka 集群中获取 applications
        return getApplicationsFromAllRemoteRegions();  // Behavior of falling back to remote region can be disabled.
    }
}
```

说明：

- <1> 本地获取 applications，获取的就是 regsiter 里面的 applications 信息
- <2> 云服务器的 eureka 集群中获取 applications (这个跳过)

##### 加载数据 getPayLoad()

代码如下:

```java
// ResponseCacheImpl
private String getPayLoad(Key key, Applications apps) {
    // tip: 将 Applications 转换成，xml 或者 json 格式
    // tip: 因为我们是有缓存的，所以同一个 apps 缓存，最多可以有2份，因为支持 xml 和 json
    EncoderWrapper encoderWrapper = serverCodecs.getEncoder(key.getType(), key.getEurekaAccept());
    String result;
    try {
        result = encoderWrapper.encode(apps);
    } catch (Exception e) {
        logger.error("Failed to encode the payload for all apps", e);
        return "";
    }
    if(logger.isDebugEnabled()) {
        logger.debug("New application cache entry {} with apps hashcode {}", key.toStringCompact(), apps.getAppsHashCode());
    }
    return result;
}
```

说明:

- 这个方法就是将，applications 信息序列成 JSON 或者 XML，然后返回保存到缓存，下次过来直接获取就好了。

### 增量获取

#### 获取增量信息 getApplicationDeltas

代码如下:

```java
// AbstractInstanceRegistry
@Deprecated
public Applications getApplicationDeltas() {
    // <1> 缓存未命中计数 +1
    GET_ALL_CACHE_MISS_DELTA.increment();
    // <2> Applications 应用信息
    Applications apps = new Applications();
    apps.setVersion(responseCache.getVersionDelta().get());
    Map<String, Application> applicationInstancesMap = new HashMap<String, Application>();
    // <3> 获取写锁，服务注册的时候获取的是都锁，这个时候就不能注册了
    write.lock();
    try {
        // <4> recentlyChangedQueue 是一个最近修改的队列，默认保留3三分钟
        Iterator<RecentlyChangedItem> iter = this.recentlyChangedQueue.iterator();
        logger.debug("The number of elements in the delta queue is : {}",
                this.recentlyChangedQueue.size());
        while (iter.hasNext()) {
            // 获取续约信息
            Lease<InstanceInfo> lease = iter.next().getLeaseInfo();
            InstanceInfo instanceInfo = lease.getHolder();
            logger.debug(
                    "The instance id {} is found with status {} and actiontype {}",
                    instanceInfo.getId(), instanceInfo.getStatus().name(), instanceInfo.getActionType().name());
            // tip: applicationInstancesMap 用于去重
            // applicationInstancesMap 如果为空的时候，才进行添加
            Application app = applicationInstancesMap.get(instanceInfo.getAppName());
            if (app == null) {
                app = new Application(instanceInfo.getAppName());
                applicationInstancesMap.put(instanceInfo.getAppName(), app);
                apps.addApplication(app);
            }
            // 添加实例信息
            app.addInstance(new InstanceInfo(decorateInstanceInfo(lease)));
        }

        // <5> 是否禁用失败回退（回退就会调用vip地址）
        boolean disableTransparentFallback = serverConfig.disableTransparentFallbackToOtherRegion();
        // <6> 没有禁用进入，然后调用vip注册的信息
        if (!disableTransparentFallback) {
            Applications allAppsInLocalRegion = getApplications(false);
            for (RemoteRegionRegistry remoteRegistry : this.regionNameVSRemoteRegistry.values()) {
                // 远程注册中心，增量的信息
                Applications applications = remoteRegistry.getApplicationDeltas();
                for (Application application : applications.getRegisteredApplications()) {
                    Application appInLocalRegistry =
                            allAppsInLocalRegion.getRegisteredApplications(application.getName());
                    if (appInLocalRegistry == null) {
                        apps.addApplication(application);
                    }
                }
            }
        }
        //
        Applications allApps = getApplications(!disableTransparentFallback);
        // <7> 生成 HashCode
        apps.setAppsHashCode(allApps.getReconcileHashCode());
        return apps;
    } finally {
        // 释放锁
        write.unlock();
    }
}
```

说明：

- <1> 缓存未命中计数 +1
- <3> 获取写锁，服务注册的时候获取的是都锁，这个时候就不能注册了
- <4> recentlyChangedQueue 是一个最近修改的队列，默认保留 3 三分钟
- <5> 是否禁用失败回退（回退就会调用 vip 地址）
- <6> 没有禁用进入，然后调用 vip 注册的信息
- <7> 生成 HashCode

#### 加载数据 getPayLoad()

> 略... 和上面的 payload 一样的

完结~

## 问答

## 问答

1. EurekaServer 的 CacheKey 是什么样的？

1. EurekaServer 支持集中 response 格式？
1. 获取同一个 Application 信息，第一次使用 application/json 获取，第二次采用 xml 获取，第二次会走缓存吗？
1. EurekaServer 有几级缓存？
1. 讲讲 readOnlyCacheMap、readWriteCacheMap？
1. readWriteCacheMap 获取为空的时候，他是怎么加载数据的？
1. readWriteCacheMap 怎么更新缓存？
1. readOnlyCacheMap 怎么更新缓存？
1. Applications 容器默认版本号是从几开始?
