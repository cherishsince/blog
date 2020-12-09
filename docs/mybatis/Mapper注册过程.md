# Mapper注册过程



### 流程

解析 `<Mapper>` 标签 --> mapper绑定namespace的时候 



### 代码如下

```java
// XMLMapperBuilder
public void parse() {
  // loadedResources 没有加载过资源，进入
  if (!configuration.isResourceLoaded(resource)) {
    // <1>、获取 mapper 节点
    // <2>、解析 mapper 标签
    configurationElement(parser.evalNode("/mapper"));
    // <3>、添加到 loadedResources 进行缓存，标记已加载
    configuration.addLoadedResource(resource);
    // <4>、mapper绑定namespace命名空间
    bindMapperForNamespace();
  }
  // 解析 resultMap
  parsePendingResultMaps();
  // 解析 cacheRef
  parsePendingCacheRefs();
  // 解析 Statement
  parsePendingStatements();
}
```

说明：<2> 是解析 `<mapper>` 标签，<4> 注册 namespace 和 mapper



### mapper绑定Namespace

```java
// XMLMapperBuilder
private void bindMapperForNamespace() {
  // <1> 获取当前的 namespace
  String namespace = builderAssistant.getCurrentNamespace();
  if (namespace != null) {
    Class<?> boundType = null;
    try {
      // <2> 采用MyBatis classLoaderWrapper 加载这个 class(mapper) 信息(里面其实就是ClassLoader)
      boundType = Resources.classForName(namespace);
    } catch (ClassNotFoundException e) {
      // ignore, bound type is not required
    }
    if (boundType != null && !configuration.hasMapper(boundType)) {
      // Spring may not know the real resource name so we set a flag
      // to prevent loading again this resource from the mapper interface
      // look at MapperAnnotationBuilder#loadXmlResource
      // <3.1> 添加 namespace
      configuration.addLoadedResource("namespace:" + namespace);
      // <3.2> tip: 添加到 MapperRegister，这一步其实是注册 mapper
      configuration.addMapper(boundType);
    }
  }
}
```

- <3.2>：这一步其实是，注册的Mapper；调用的是MapperRegister，它里面维护了一个 map，用于保存已注册的 Mapper。



### MapperRegister这个累是怎么注册的

```java
// MapperRegistry
public <T> void addMapper(Class<T> type) {
  // <1> 必须是 interface
  if (type.isInterface()) {
    if (hasMapper(type)) {
      throw new BindingException("Type " + type + " is already known to the MapperRegistry.");
    }
    // <2> 加载完成标记
    boolean loadCompleted = false;
    try {
      // <3> 根据mapper，添加对应的 MapperProxyFactory 代理工厂
      knownMappers.put(type, new MapperProxyFactory<>(type));
//        在解析器运行之前添加类型是很重要的
//        否则，将自动尝试绑定
//        映射器解析器。如果已经知道类型，则不会尝试。
      // It's important that the type is added before the parser is run
      // otherwise the binding may automatically be attempted by the
      // mapper parser. If the type is already known, it won't try.
      // <3> 解析 Mapper 的注解配置
      MapperAnnotationBuilder parser = new MapperAnnotationBuilder(config, type);
      parser.parse();
      // 加载完成标记
      loadCompleted = true;
    } finally {
      // <4> 加载失败，需要从 knownMappers 移除
      if (!loadCompleted) {
        knownMappers.remove(type);
      }
    }
  }
}
```

- <3> 就是完成注册的步骤，里面会 `new MapperProxyFactory()` 这是一个代理类(TODO MapperProxyFactory)。



完结~



# 彩蛋

1. Mapper 是怎么注册的？
2. Mapper 相关注解在什么时候解析？
3. Mapper 注册在哪个类里面？
4. 程序运行中怎么去加载一个新的 Mapper？
5. 没有xml怎么注册一个 Mapper？



