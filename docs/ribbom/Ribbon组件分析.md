## Ribbon 组件分析

## Rule 负载规则

![5](....\public\ribbon\5.png)

说明一：

- `AvailabiltyFilteringRule` 过滤掉一直连接失败的被标记为 circuit tripped 的后端 Server,并过滤掉那些高并发的后端 Server 或者使用一-个 AvailabilityPredicate 来包含过滤 server 的逻辑，其实就就是检查 status 里记录的各个 Server 的运行状态
- `BestAvailableRule` 选择一个最小的并发请求的 Server,逐个考察 Server,如果 Server 被 tripped 了，则跳过
- `RandomRule` 随机选择一个 Server
- ~~`ResponseTimeWeightedRule` 已废弃，作用同 WeightedResponseTimeRule，根据响应时间加权，响应时间越长，权重越小，被选中的可能性越低~~
- `RetryRule` 对选定的负载均衡策略机上重试机制，在一个配置时间段内当选择 Server 不成功，则一直尝试使用 subRule(轮询)的方式选择一个可用的 server
- `RoundRobinRule` 轮询选择，轮询 index, 选择 index 对应位置的 Server
- `WeightedResponseTimeRule` 根据响应时间加权，响应时间越长，权重越小，被选中的可能性越低
- `ZoneAvoidanceRule` 复合判断 Server 所 Zone 的性能和 Server 的可用性选择 Server,在没有 Zone 的环境下，类似于轮询(RoundRobinRule)

说明二：

- BestAvailableRule 选择最小请求数

- ClientConfigEnabledRoundRobinRule 轮询

- RandomRule 随机选择一个 server

- RoundRobinRule 轮询选择 server

- RetryRule 根据轮询的方式重试

- WeightedResponseTimeRule 根据响应时间去分配一个 weight ，weight 越低，被选择的可能性就越低

- ZoneAvoidanceRule 根据 server 的 zone 区域和可用性来轮询选择

了解更多

http://www.iocoder.cn/Ribbon/didi/springcloud-sourcecode-ribbon/

## Ping 检测

![8](....\public\ribbon\8.png)

- PingUrl 真实的去 ping 某个 url，判断其是否 alive
- PingConstant 固定返回某服务是否可用，默认返回 true，即可用
- NoOpPing 不去 ping,直接返回 true,即可用。
- DummyPing 直接返回 true，并实现了 initWithNiwsConfig 方法。
- NIWSDiscoveryPing，根据 DiscoveryEnabledServer 的 InstanceInfo 的 InstanceStatus 去判断，如果为 InstanceStatus.UP，则为可用，否则不可用。

代码如下：

```java
public interface IPing {
    public boolean isAlive(Server server);
}
```

了解更多：http://www.iocoder.cn/Ribbon/fangzhipeng/ribbon/
