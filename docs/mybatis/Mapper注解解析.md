# Mapper注解解析

Mapper在什么时候解析注解的？一般在开发过程中，大家可能都会存在一些混编，那什么时候解析，怎么生效的？



##### 1、Mapper注解解析

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

说明：

- **Mapper注解解析** 是在 addMapper 的时候；这里会有两个入口，**1、xml配置** 和 **2、configuration配置类**  两个入口；
- 注意、注意、注意，**xml配置** 在addMapper 的时候 **才解析注解** ；**configuration类配置** ，**在解析注解的时候，会检查是否加载过.xml配置文件，没有就回去加载！**



##### 2、MapperAnnotationBuilder 解析

如下是，注解解析过程，代码如下：

```java
// MapperAnnotationBuilder
public void parse() {
  // <1> 判断当前 Mapper 接口是否应加载过。
  String resource = type.toString();
  if (!configuration.isResourceLoaded(resource)) {
    // <2> 加载对应的 XML Mapper
    loadXmlResource();
    // <3> 标记该 Mapper 接口已经加载过
    configuration.addLoadedResource(resource);
    // <4> 设置 namespace 属性
    assistant.setCurrentNamespace(type.getName());
    // <5> 解析 @CacheNamespace 注解
    parseCache();
    // <6> 解析 @CacheNamespaceRef 注解
    parseCacheRef();
    // <7> 遍历每个方法，解析其上的注解
    for (Method method : type.getMethods()) {
      if (!canHaveStatement(method)) {
        continue;
      }
      // <7.1> 解析 @Select @SelectProvider 上是否有 @ResultMap，需要处理 ResultMap
      if (getAnnotationWrapper(method, false, Select.class, SelectProvider.class).isPresent()
        && method.getAnnotation(ResultMap.class) == null) {
        parseResultMap(method);
      }
      try {
        // <7.2> 执行解析
        parseStatement(method);
      } catch (IncompleteElementException e) {
        // <7.3> 解析失败，添加到 configuration 中
        configuration.addIncompleteMethod(new MethodResolver(this, method));
      }
    }
  }
  // <8> 解析待定的方法(由于信息还不完全，主要是 resultMap解析，xml 和 注解加载顺序不一样问题)
  parsePendingMethods();
}

```

说明：

- 重点在 **if 判断** ，`isResourceLoaded` 是 `Configuration` 里面的一个 `Set` 保存我们加载的资源，资源包含两个，**第一个是我们的mapper接口，第二个是mapper.xml 配置文件**，这两个都是资源文件，如下代码：

  ```java
  // MapperAnnotationBuilder.parse
  if (!configuration.isResourceLoaded(resource))
  // MapperAnnotationBuilder.loadXmlResource
  if (!configuration.isResourceLoaded("namespace:" + type.getName()))
  ```

  xml加载 addResource 是 "namespace" + 配置的namespace，注解加载 addResource 是 Class<?> type type.toString，获取到的时候 interface xx.xx.UserMapper

- parsePendingMethods 是解析过程中，信息还不完全的时候，如：mapper 有两个 xml配置，加载顺序不一样，@ResultMap 就会放入



完结~





# 彩蛋



1. 注解在什么时候解析？
2. Configuration配置文件中的 loadedResources 保存的资源分为哪几种？
3. xml配置 和 Configuration配置，解析方式有什么区别？

