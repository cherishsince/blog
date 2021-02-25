# Eureka 开启认证

`Eureka` 是支持简单的认证的，这个需要借助 `spring-security` 这个框架。

> 生成中可以简单的时候，不过一般大型项目都会重写，这个地方，采用自定义的方式来鉴权。

### 官方说明

地址：https://cloud.spring.io/spring-cloud-netflix/reference/html/#authenticating-with-the-eureka-server

HTTP basic authentication is automatically added to your eureka client if one of the `eureka.client.serviceUrl.defaultZone` URLs has credentials embedded in it (curl style, as follows: `user:password@localhost:8761/eureka`). For more complex needs, you can create a `@Bean` of type `DiscoveryClientOptionalArgs` and inject `ClientFilter` instances into it, all of which is applied to the calls from the client to the server.

如果其中一个`eureka.client.serviceUrl.defaultZone`URL 嵌入了凭据（curl 样式，如下所示`user:password@localhost:8761/eureka`），则会将 HTTP 基本身份验证自动添加到您的 eureka 客户端。对于更复杂的需求，您可以创建一个`@Bean`类型`DiscoveryClientOptionalArgs`并将其注入`ClientFilter`实例，所有这些都将应用于从客户端到服务器的调用。

**(我们可以通过 `user:password@localhost:8761/eureka` 这种格式来指定，账户和密码进行认证。)**

### 快速开始

引入 pom 文件

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

配置账号密码

```properties
security.user.password=admin
security.user.name=admin
```

client 添加账号密码

```properties
eureka.client.serviceUrl.defaultZone=http://${userName}:${password}@localhost:1111/eureka/
```





完结~
