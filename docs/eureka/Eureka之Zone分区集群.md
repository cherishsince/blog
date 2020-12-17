# Eureka 之 Zone 分区集群

Zone 用于配置分区集群，比如我们现在有 beijing、shanghai 两个集群区域，每个分区的最近访问距离，肯定是当前自己的这个集群，比如 beijing 你的 user 服务需要访问 order 服务，如果访问到 shanghai 的去了那么肯定机会出现延迟大的问题。

EurekaClient 默认情况下优先，本区域的 Zone 服务，如果注册失败，就会考虑第二个 Zone 服务，这个时候就会注册到 shanghai 上去。

更多 zone 说明：https://blog.csdn.net/limingcai168/article/details/84659135

![1](..\..\public\eureka\image\1.png)

### 如何配置

官方地址：https://cloud.spring.io/spring-cloud-netflix/reference/html/#zones

server1 配置 zone1

```properties
eureka.instance.metadataMap.zone = zone1
eureka.client.preferSameZoneEureka = true
```

server2 配置 zone2

```properties
eureka.instance.metadataMap.zone = zone2
eureka.client.preferSameZoneEureka = true
```

说明：

- preferSameZoneEureka 是否使用 zone，就是是否使用 `eureka.instance.metadataMap.zone` 指定的 zone
- `eureka.instance.metadataMap.zone` 设置的就是你的 zone 区域

完结~
