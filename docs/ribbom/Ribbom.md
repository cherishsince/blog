### Ping 检查

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

### Ribbon 服务列表更新

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

#### 服务列表(ServerList)

ServerList 有五个实现类，类图如下：

![1](....\public\ribbon\1.png)

说明：

- 重点是 `DomainExtractingServerList` 这个类，内部保存了一个 `ServerList<DiscoveryEnabledServer>`

##### DomainExtractingServerList 实现

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

##### `DomainExtractingServerList#updateListOfServers()`

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

##### 定时调用 UpdateAction

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

    void start(UpdateAction updateAction);

    void stop();

    String getLastUpdate();


    long getDurationSinceLastUpdateMs();


    int getNumberMissedCycles();


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

- <1> 创建一个 Runnable 任务
- <3> scheduleWithFixedDelay 定时调用，`refreshIntervalMs = 30000` `initialDelayMs = 1000` 单位未秒。
