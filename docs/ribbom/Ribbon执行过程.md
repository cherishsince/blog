# Ribbon

Ribbon 用于 **负载均衡**，可以通过 **@LoadBalancer** 注解进行开启，代码如下：

```java
@Configuration
public class ApplicationConfiguration {

    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
```

说明：

- `@LoadBalancer` 需要结合，`RestTemplate` 进行开启。
- `@LoadBalancer` 其实就是在 `RestTemplate` 中增加了一个 `Interceptor` 拦截器，然后再调用拦截器的时候，解析服务地址。
- `@LoadBalancer` 服务器地址是通过，`EurekaClient` 进行获取的。

## 配置 RestTemplate 拦截器

```java
// LoadBalancerAutoConfiguration

@LoadBalanced
@Autowired(required = false)
private List<RestTemplate> restTemplates = Collections.emptyList();

@Bean
public SmartInitializingSingleton loadBalancedRestTemplateInitializerDeprecated(
    final ObjectProvider<List<RestTemplateCustomizer>> restTemplateCustomizers) {
    return () -> restTemplateCustomizers.ifAvailable(customizers -> {
        for (RestTemplate restTemplate : LoadBalancerAutoConfiguration.this.restTemplates) {
            for (RestTemplateCustomizer customizer : customizers) {
                // <1> 挨个配置 restTemplate 增加拦截器
                customizer.customize(restTemplate);
            }
        }
    });
}

@Bean
@ConditionalOnMissingBean
public RestTemplateCustomizer restTemplateCustomizer(
    final LoadBalancerInterceptor loadBalancerInterceptor) {
    return restTemplate -> {
        // <10> 获取 restTemplate 里面所有的 Interceptors，然后添加 Ribbon 自己的拦截器
        List<ClientHttpRequestInterceptor> list = new ArrayList<>(restTemplate.getInterceptors());
        list.add(loadBalancerInterceptor);
        // <11> 设置完后再设置回去
        restTemplate.setInterceptors(list);
    };
}
```

说明：

- `restTemplates` 是配置的 `RestTemplate`
- <1> 挨个配置 `restTemplate` 增加拦截器。
- <10> 获取 `restTemplate` 里面所有的 `Interceptors`，然后添加 `Ribbon` 自己的拦截器。
- <11> 设置完后再设置回去。

## 负载均衡拦截器(LoadBalancerInterceptor)

```java
public class LoadBalancerInterceptor implements ClientHttpRequestInterceptor {
	// 负载均衡 client
	private LoadBalancerClient loadBalancer;
	// 负载均衡 request factory
	private LoadBalancerRequestFactory requestFactory;

	public LoadBalancerInterceptor(LoadBalancerClient loadBalancer,
			LoadBalancerRequestFactory requestFactory) {
		this.loadBalancer = loadBalancer;
		this.requestFactory = requestFactory;
	}

	public LoadBalancerInterceptor(LoadBalancerClient loadBalancer) {
		// for backwards compatibility
		this(loadBalancer, new LoadBalancerRequestFactory(loadBalancer));
	}

	@Override
	public ClientHttpResponse intercept(final HttpRequest request, final byte[] body,
			final ClientHttpRequestExecution execution) throws IOException {
        // tip: 发送请求的使用，会调用到这个拦截器，进行负载均衡
        // <1> 获取请求的 URI 地址，如：http://user-service/api/getName
		final URI originalUri = request.getURI();
        // <2> 获取的是服务名, USER-SERVICE
		String serviceName = originalUri.getHost();
		Assert.state(serviceName != null, "Request URI does not contain a valid hostname: " + originalUri);
        // <3>
        // 1、选择负载均衡策略(rule)，选择一个 server，然后进行调用
        // 2、将 USER-SERVICE 解析成 URL 地址
		return this.loadBalancer.execute(serviceName, this.requestFactory.createRequest(request, body, execution));
	}
}
```

说明：

- <1> 获取请求的 `URI` 地址，如：`http://user-service/api/getName`
- <2> 获取的是服务名 `USER-SERVICE`
- <3> 1、选择负载均衡策略(`rule`)，选择一个 `server`，然后进行调用；2、将 `USER-SERVICE` 解析成 `URL` 地址。

## Ping 检查

ping 用于检测，server 是否可用，在创建 LoaderBalancer 的时候，会启动 ping 的任务，代码如下：

```java
// BaseLoadBalancer
public BaseLoadBalancer() {
    this.name = DEFAULT_NAME;
    this.ping = null;
    setRule(DEFAULT_RULE);
    // <2> 启动pingTask
    setupPingTask();
    lbStats = new LoadBalancerStats(DEFAULT_NAME);
}
// 启动 ping task
void setupPingTask() {
    if (canSkipPing()) {
        return;
    }
    if (lbTimer != null) {
        lbTimer.cancel();
    }
    lbTimer = new ShutdownEnabledTimer("NFLoadBalancer-PingTimer-" + name,
                                       true);
    lbTimer.schedule(new PingTask(), 0, pingIntervalSeconds * 1000);
    forceQuickPing();
}
```

说明：

- <2> 启动 ping 的任务
- 默认是 10 秒检查一次，**不能直接配置文件配置，需要创建 LoadBalancer 时候 set**。

## Ribbon 服务列表更新

Ribbon 自己本身维护了一个 ServerList，**不过需要从 EurekaClient 中间去拿，拿的这个过程就是，采用 Timer 定时更新**，代码如下：

```java
// ServerList
public interface ServerList<T extends Server> {
	// 获取服务器的初始列表
    public List<T> getInitialListOfServers();
    // 获取服务器的更新列表
    public List<T> getUpdatedListOfServers();
}
```

说明：

- 提供了 **两个方法**，**获取服务器的初始列表** 和 **获取服务器的更新列表** 。

### 服务列表(ServerList)

ServerList 有五个实现类，类图如下：

![1](....\public\ribbon\1.png)

说明：

- 重点是 `DomainExtractingServerList` 这个类，内部保存了一个 `ServerList<DiscoveryEnabledServer>`

#### DomainExtractingServerList 实现

```java
// DomainExtractingServerList
public class DomainExtractingServerList implements ServerList<DiscoveryEnabledServer> {
    // <1> 可用的 server(从eureka client 中拿过来的，只有状态未UP的server)
    private ServerList<DiscoveryEnabledServer> list;

	private final RibbonProperties ribbon;

	private boolean approximateZoneFromHostname;

    // 略...
}
```

说明：

- <1> 可用的 server(从 eureka client 中拿过来的，只有状态未 UP 的 server)，

#### `DomainExtractingServerList#updateListOfServers()`

```java
    @VisibleForTesting
    public void updateListOfServers() {
        List<T> servers = new ArrayList<T>();
        if (serverListImpl != null) {
            // <1> 调用 ServerList 获取更新的服务列表
            servers = serverListImpl.getUpdatedListOfServers();
            LOGGER.debug("List of Servers for {} obtained from Discovery client: {}",
                    getIdentifier(), servers);

            // <2> 调用过滤器，过滤服务
            if (filter != null) {
                servers = filter.getFilteredListOfServers(servers);
                LOGGER.debug("Filtered List of Servers for {} obtained from Discovery client: {}",
                        getIdentifier(), servers);
            }
        }
        // <3> 将更新的 servers，同步到 BaseLoadBalancer 里面生效
        updateAllServerList(servers);
    }
```

说明：

- `DomainExtractingServerList#updateListOfServers()` 方法实现，主要是对 **怎么从 eureka 那边更新服务** 。
- <1> 调用 ServerList 获取更新的服务列表
- <2> 调用过滤器，过滤服务
- <3> 将更新的 servers，同步到 BaseLoadBalancer 里面生效

#### 定时调用 UpdateAction

```java
public class DynamicServerListLoadBalancer<T extends Server> extends BaseLoadBalancer {
    // <1> 用于 ServerList 更新使用，里面start就是一个 timer的定时调用
    protected volatile ServerListUpdater serverListUpdater;
    // 略...
    protected final ServerListUpdater.UpdateAction updateAction = new ServerListUpdater.UpdateAction() {
        @Override
        public void doUpdate() {
            // <2> 调用更新，去 EurekaClient 中去获取。
            updateListOfServers();
        }
    };
    // 略...
}
```

说明：

- `DynamicServerListLoadBalancer` 里面定义了一个， `UpdateAction` 用于定时调用更新，
- <1> 用于 ServerList 更新使用，里面 start 就是一个 timer 的定时调用
- <2> 调用更新，去 EurekaClient 中去获取。

- start 代码如下：

```java
// PollingServerListUpdater 实现了 ServerListUpdater
@Override
public synchronized void start(final UpdateAction updateAction) {
    if (isActive.compareAndSet(false, true)) {
        final Runnable wrapperRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isActive.get()) {
                    if (scheduledFuture != null) {
                        scheduledFuture.cancel(true);
                    }
                    return;
                }
                try {
                    updateAction.doUpdate();
                    lastUpdated = System.currentTimeMillis();
                } catch (Exception e) {
                    logger.warn("Failed one update cycle", e);
                }
            }
        };

        scheduledFuture = getRefreshExecutor().scheduleWithFixedDelay(
            wrapperRunnable,
            initialDelayMs,
            refreshIntervalMs,
            TimeUnit.MILLISECONDS
        );
    } else {
        logger.info("Already active, no-op");
    }
}
```

#### ServerListUpdater 服务更新

这个接口，专门用于 ServerList 更新使用，代码如下：

```java
public interface ServerListUpdater {
    public interface UpdateAction {
        void doUpdate();
    }
    // 启动服务更新器，传入的UpdateAction对象为更新操作的具体实现。
    void start(UpdateAction updateAction);
    // 停止服务更新器
    void stop();
    // 获取最近的更新时间戳
    String getLastUpdate();
    // 获取上一次更新到现在的时间间隔，单位为毫秒
    long getDurationSinceLastUpdateMs();
    // 获取错过的更新周期数
    int getNumberMissedCycles();
    // 获取核心线程数
    int getCoreThreads();
}
```

说明：重点是 `start(UpdateAction updateAction);` 方法

##### ServerListUpdater 类图

![1](....\public\ribbon\2.png)

主要看 `PollingServerListUpdater`

##### PollingServerListUpdater 服务更新

```java
@Override
public synchronized void start(final UpdateAction updateAction) {
    if (isActive.compareAndSet(false, true)) {
        // <1> 创建一个 Runnable 任务
        final Runnable wrapperRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isActive.get()) {
                    if (scheduledFuture != null) {
                        scheduledFuture.cancel(true);
                    }
                    return;
                }
                try {
                    updateAction.doUpdate();
                    lastUpdated = System.currentTimeMillis();
                } catch (Exception e) {
                    logger.warn("Failed one update cycle", e);
                }
            }
        };
		// <3> scheduleWithFixedDelay 定时调用，
        // refreshIntervalMs = 30000
        // initialDelayMs = 1000
        scheduledFuture = getRefreshExecutor().scheduleWithFixedDelay(
            wrapperRunnable,
            initialDelayMs,
            refreshIntervalMs,
            TimeUnit.MILLISECONDS
        );
    } else {
        logger.info("Already active, no-op");
    }
}
```

说明：

- <1> 创建一个 Runnable 任务。
- <3> scheduleWithFixedDelay 定时调用，服务启动时 延迟 1 秒，然后每 30 秒执行一次。

#### 服务列表过滤(ServerListFilter)

##### ServerListFilter 类图

![4](....\public\ribbon\4.png)

说明：

- `AbstractServerListFilter` 这是一个抽象过滤器，在这里定义了过滤时需要的一个重要依据对象，`LoadBalancerStats`，我们在之前介绍过的，该对象存储了关于负载均衡器的一些属性和统计信息等。
- `ZoneAffinityServerListFilter`：该过滤器基于“区域感知（Zone Affinity）”的方式实现服务实例的过滤，也就是说它会根据提供服务的实例所处区域（Zone）与消费者自身的所处区域（Zone）进行比较，过滤掉那些不是同处一个区域的实例。
- `DefaultNIWSServerListFilter`：该过滤器完全继承自`ZoneAffinityServerListFilter`，是默认的 NIWS（Netflix Internal Web Service）过滤器。
- `ServerListSubsetFilter`：该过滤器也继承自`ZoneAffinityServerListFilter`，它非常适用于拥有大规模服务器集群(上百或更多)的系统。因为它可以产生一个“区域感知”结果的子集列表，同时它还能够通过比较服务实例的通信失败数量和并发连接数来判定该服务是否健康来选择性的从服务实例列表中剔除那些相对不够健康的实例
- `ZonePreferenceServerListFilter`：Spring Cloud 整合时新增的过滤器。若使用 Spring Cloud 整合 Eureka 和 Ribbon 时会默认使用该过滤器。它实现了通过配置或者 Eureka 实例元数据的所属区域（Zone）来过滤出同区域的服务实例。

完结~

## 问答
