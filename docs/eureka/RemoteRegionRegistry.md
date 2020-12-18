# RemoteRegionRegistry

远程注册列表，我们在配置 `EurekaServer` 里面会有其他节点信息地址，其他节点的 `EurekaServer` 节点就是 `RemoteRegionRegistry` 来进行获取和同步。

### 实例注册初始化

代码如下：

```java
// PeerAwareInstanceRegistryImpl
@Override
public void init(PeerEurekaNodes peerEurekaNodes) throws Exception {
    this.numberOfReplicationsLastMin.start();
    this.peerEurekaNodes = peerEurekaNodes;
    // <1> 初始化 response cache
    initializedResponseCache();
    // <2> 定时更新阀值，自我保护的额阀值
    scheduleRenewalThresholdUpdateTask();
    // <3> 初始化远程区域注册表
    initRemoteRegionRegistry();
    // <4> 注册监听
    try {
        Monitors.registerObject(this);
    } catch (Throwable e) {
        logger.warn("Cannot register the JMX monitor for the InstanceRegistry :", e);
    }
}
```

说明：

- <1> 初始化 response cache
- <2> 定时更新阀值，自我保护的额阀值
- <3> 初始化远程区域注册表
- <4> 注册监听

### initRemoteRegionRegistry

初始化远程注册表，代码如下：

```java
// AbstractInstanceRegistry
protected void initRemoteRegionRegistry() throws MalformedURLException {
    // <1> 获取远程仓库地址信息
    Map<String, String> remoteRegionUrlsWithName = serverConfig.getRemoteRegionUrlsWithName();
    if (!remoteRegionUrlsWithName.isEmpty()) {
        allKnownRemoteRegions = new String[remoteRegionUrlsWithName.size()];
        int remoteRegionArrayIndex = 0;
        // <2> 循环创建 RemoteRegionRegistry
        for (Map.Entry<String, String> remoteRegionUrlWithName : remoteRegionUrlsWithName.entrySet()) {
            RemoteRegionRegistry remoteRegionRegistry = new RemoteRegionRegistry(
                    serverConfig,
                    clientConfig,
                    serverCodecs,
                    remoteRegionUrlWithName.getKey(),
                    new URL(remoteRegionUrlWithName.getValue()));
            regionNameVSRemoteRegistry.put(remoteRegionUrlWithName.getKey(), remoteRegionRegistry);
            allKnownRemoteRegions[remoteRegionArrayIndex++] = remoteRegionUrlWithName.getKey();
        }
    }
    logger.info("Finished initializing remote region registries. All known remote regions: {}",
            (Object) allKnownRemoteRegions);
}
```

说明：

- <1> 获取远程仓库地址信息
- <2> 循环创建 RemoteRegionRegistry

### 创建 RemoteRegionRegistry

构造函数，代码如下：

```java
// RemoteRegionRegistry

// 略...

@Inject
public RemoteRegionRegistry(EurekaServerConfig serverConfig,
                            EurekaClientConfig clientConfig,
                            ServerCodecs serverCodecs,
                            String regionName,
                            URL remoteRegionURL) {
    // <2> 构建一个 Eureka 请求客户端
    EurekaJerseyClientBuilder clientBuilder = new EurekaJerseyClientBuilder()
        .withUserAgent("Java-EurekaClient-RemoteRegion")
        .withEncoderWrapper(serverCodecs.getFullJsonCodec())
        .withDecoderWrapper(serverCodecs.getFullJsonCodec())
        .withConnectionTimeout(serverConfig.getRemoteRegionConnectTimeoutMs())
        .withReadTimeout(serverConfig.getRemoteRegionReadTimeoutMs())
        .withMaxConnectionsPerHost(serverConfig.getRemoteRegionTotalConnectionsPerHost())
        .withMaxTotalConnections(serverConfig.getRemoteRegionTotalConnections())
        .withConnectionIdleTimeout(serverConfig.getRemoteRegionConnectionIdleTimeoutSeconds());

    // <3> 构建协议
    if (remoteRegionURL.getProtocol().equals("http")) {
        clientBuilder.withClientName("Discovery-RemoteRegionClient-" + regionName);
    } else if ("true".equals(System.getProperty("com.netflix.eureka.shouldSSLConnectionsUseSystemSocketFactory"))) {
        clientBuilder.withClientName("Discovery-RemoteRegionSystemSecureClient-" + regionName)
            .withSystemSSLConfiguration();
    } else {
        clientBuilder.withClientName("Discovery-RemoteRegionSecureClient-" + regionName)
            .withTrustStoreFile(
            serverConfig.getRemoteRegionTrustStore(),
            serverConfig.getRemoteRegionTrustStorePassword()
        );
    }
    // <4> 构建请求的 discoveryJerseyClient
    discoveryJerseyClient = clientBuilder.build();
    // <5> 构建请求的 discoveryApacheClient
    discoveryApacheClient = discoveryJerseyClient.getClient();

    // should we enable GZip decoding of responses based on Response Headers?
    if (serverConfig.shouldGZipContentFromRemoteRegion()) {
        // compressed only if there exists a 'Content-Encoding' header whose value is "gzip"
        discoveryApacheClient.addFilter(new GZIPContentEncodingFilter(false));
    }
}

// 略...
```

说明：

- <2> 构建一个 Eureka 请求客户端
- <3> 构建协议
- <4> 构建请求的 discoveryJerseyClient
- <5> 构建请求的 discoveryApacheClient
- 里面会构建请求 client，然后定时去拉取，远程的注册列表信息

### 远程服定时拉取

代码如下：

```java
// RemoteRegionRegistry
@Inject
public RemoteRegionRegistry(EurekaServerConfig serverConfig,
                            EurekaClientConfig clientConfig,
                            ServerCodecs serverCodecs,
                            String regionName,
                            URL remoteRegionURL) {
    // 略...

    // <10> 远程拉取注册列表
    // remote region fetch
    Runnable remoteRegionFetchTask = new Runnable() {
        @Override
        public void run() {
            try {
                // <>
                if (fetchRegistry()) {
                    readyForServingData = true;
                } else {
                    logger.warn("Failed to fetch remote registry. This means this eureka server is not "
                            + "ready for serving traffic.");
                }
            } catch (Throwable e) {
                logger.error(
                        "Error getting from remote registry :", e);
            }
        }
    };
    // <13> 设置定时调度，定时拉取远程注册表信息
    scheduler.schedule(
        new TimedSupervisorTask(
            "RemoteRegionFetch_" + regionName,
            scheduler,
            remoteRegionFetchExecutor,
            serverConfig.getRemoteRegionRegistryFetchInterval(),
            TimeUnit.SECONDS,
            5,  // exponential backoff bound
            remoteRegionFetchTask
        ),
        serverConfig.getRemoteRegionRegistryFetchInterval(), TimeUnit.SECONDS);
    // 略...
}
```

说明：

- `getRemoteRegionRegistryFetchInterval` 配置远程注册列表拉取，默认 30 秒一次。

- <10> 远程拉取注册列表

- <13> 设置定时调度，定时拉取远程注册表信息

### 执行拉取注册列表

代码如下：

```java
private boolean fetchRegistry() {
    boolean success;
    // <1> 启动一个计时器，开始计时
    Stopwatch tracer = fetchRegistryTimer.start();
    try {
        // <2> 如果禁用增量，或者这是第一次，请获取所有应用程序
        // If the delta is disabled or if it is the first time, get all applications
        if (serverConfig.shouldDisableDeltaForRemoteRegions()
                || (getApplications() == null)
                || (getApplications().getRegisteredApplications().size() == 0)) {
            logger.info("Disable delta property : {}", serverConfig.shouldDisableDeltaForRemoteRegions());
            logger.info("Application is null : {}", getApplications() == null);
            logger.info("Registered Applications size is zero : {}", getApplications().getRegisteredApplications().isEmpty());
            // <2.1> 全量拉取
            success = storeFullRegistry();
        } else {
            // <2.2> 增量拉取
            success = fetchAndStoreDelta();
        }
        // <3>
        logTotalInstances();
    } catch (Throwable e) {
        logger.error("Unable to fetch registry information from the remote registry {}", this.remoteRegionURL, e);
        return false;
    } finally {
        // <4> 停止计时器
        if (tracer != null) {
            tracer.stop();
        }
    }
    // <5> 保存一下，拉取的时候(上次成功远程获取的时间)
    if (success) {
        timeOfLastSuccessfulRemoteFetch = System.currentTimeMillis();
    }
    return success;
}

```

说明：

- <1> 启动一个计时器，开始计时
- <2> 如果禁用增量，或者这是第一次，请获取所有应用程序
- <2.1> 全量拉取 <2.2> 增量拉取
- <5> 保存一下，拉取的时候(上次成功远程获取的时间)

完结~

## 问答

1. 远程拉取用来干嘛的？

   用于拉取 `EurekaServer` 其他节点信息，没 30 秒更新，

2. 远程拉取在什么时候初始化的？

   在 `PeerAwareInstanceRegistryImpl#init()` 方法的时候进行初始化。
