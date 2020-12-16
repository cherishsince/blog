# EurekaServer 获取注册信息

### 容器数据获取

获取注册信息，就是 client 拉取的节点信息，我们使用 ribbon、feign 就是依赖这个信息。`ApplicationsResource` 有个 `getContainers` 方法，获取注册服务节点信息，代码如下：

```java
@GET
public Response getContainers(@PathParam("version") String version,
                              @HeaderParam(HEADER_ACCEPT) String acceptHeader,
                              @HeaderParam(HEADER_ACCEPT_ENCODING) String acceptEncoding,
                              @HeaderParam(EurekaAccept.HTTP_X_EUREKA_ACCEPT) String eurekaAccept,
                              @Context UriInfo uriInfo,
                              @Nullable @QueryParam("regions") String regionsStr) {
    // <1> tip: 这个是 云服务器
    boolean isRemoteRegionRequested = null != regionsStr && !regionsStr.isEmpty();
    String[] regions = null;
    if (!isRemoteRegionRequested) {
        EurekaMonitors.GET_ALL.increment();
    } else {
        regions = regionsStr.toLowerCase().split(",");
        Arrays.sort(regions); // So we don't have different caches for same regions queried in different order.
        EurekaMonitors.GET_ALL_WITH_REMOTE_REGIONS.increment();
    }

    // 检查服务器是否允许访问注册表。如果服务器由于各种原因尚未准备好服务流量，则可以限制访问。
    // Check if the server allows the access to the registry. The server can
    // restrict access if it is not
    // ready to serve traffic depending on various reasons.
    if (!registry.shouldAllowAccess(isRemoteRegionRequested)) {
        return Response.status(Status.FORBIDDEN).build();
    }
    // <2> 设置当前请求的版本号，里面是一个 threadLocal
    CurrentRequestVersion.set(Version.toEnum(version));
    // <3> 请求返回类型，默认是 application/json
    KeyType keyType = Key.KeyType.JSON;
    String returnMediaType = MediaType.APPLICATION_JSON;
    if (acceptHeader == null || !acceptHeader.contains(HEADER_JSON_VALUE)) {
        keyType = Key.KeyType.XML;
        returnMediaType = MediaType.APPLICATION_XML;
    }

    // tip: cacheKey 用于 ResponseCacheImpl 缓存使用
    // 如下业务：是采用 responseCache 实现类是 ResponseCacheImpl，就是去缓存中获取

    // <4> 生成cachekey
    Key cacheKey = new Key(Key.EntityType.Application,
            ResponseCacheImpl.ALL_APPS,
            keyType, CurrentRequestVersion.get(), EurekaAccept.fromString(eurekaAccept), regions
    );

    // <5> tip: 响应请求，这里会动态的适配，application/json 和 xml 格式响应(eureka 使用的不是 spring mvc 所以和我们spring的方式不一样)
    Response response;
    if (acceptEncoding != null && acceptEncoding.contains(HEADER_GZIP_VALUE)) {
        // <5.1> responseCache.getGZIP(cacheKey) 拉取注册信息，并GZIP压缩数据
        response = Response.ok(responseCache.getGZIP(cacheKey))
                .header(HEADER_CONTENT_ENCODING, HEADER_GZIP_VALUE)
                .header(HEADER_CONTENT_TYPE, returnMediaType)
                .build();
    } else {
        // <5.2> responseCache.get(cacheKey) 拉取注册信息
        response = Response.ok(responseCache.get(cacheKey))
                .build();
    }
    // 删除version
    CurrentRequestVersion.remove();
    return response;
}
```

说明：

- <1> 判断是不是有云服务
- <2> 设置当前请求的版本号，里面是一个 threadLocal
- <3> 请求支持两种解析方式，json 和 xml，如果你进入的时 xml 那么返回的也是 xml
- <4> 生成了一个 cacheKey，这里有一个缓存的机制(下面会讲)
- <5> 客户端是否支持 GZIP 的压缩格式，然后调用缓存获取
- <5.1> <5.2> 获取注册信息

### 获取注册信息

```java
// ResponseCacheImpl
public String get(final Key key) {
    return get(key, shouldUseReadOnlyResponseCache);
}

@VisibleForTesting
String get(final Key key, boolean useReadOnlyCache) {
    // <1> 从缓存中获取
    Value payload = getValue(key, useReadOnlyCache);
    // <2> 缓存不存在 || 为空字符串("")，进入
    if (payload == null || payload.getPayload().equals(EMPTY_PAYLOAD)) {
        return null;
    } else {
        return payload.getPayload();
    }
}
```

说明：

- <1> 获取注册信息，如果为 null 或者空的字符串，都返回 null，重点 getValue

##### getValue() 获取缓存

```java
// ResponseCacheImpl
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

- <1> useReadOnlyCache 默认为 true，使用缓存
- <2> readOnlyCacheMap 只读缓存，如果缓存中存在就直接返回，没有就需要 readWriteCacheMap 读写缓存去获取。
- <2.1> readWriteCacheMap 读写缓存，获取到注册信息后，然后再缓存到 readOnlyCacheMap 中。
- <3> 不适用缓存就直接从 readWriteCacheMap 获取，不过这样会频繁的呗锁住，牺牲了性能。

完结~

> 缓存请看 EurekaServer 缓存篇

## 问答

1. 拉取注册信息，支持 JSON 格式外，还支持什么格式？

   JSON、XML

2. 拉取注册信息，会使用缓存吗？

   使用缓存

3. 拉取注册信息，有哪几种缓存？

   只读缓存、读写缓存

4. 只读缓存中没有获取到的时候，是怎么处理的？

   只读缓存，没有的时候会尝试，从读写缓存中获取
