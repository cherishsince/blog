# Plugin插件



## 基本使用

Plugin 是扩展MyBatis 的重要方式：

- 执行过程：Executor (update, query, flushStatements, commit, rollback,  getTransaction,  close, isClosed)     
- 参数处理：ParameterHandler(getParameterObject, setParameters)          
- 返回处理：ResultSetHandler(handleResultSets, handleOutputParameters)          
- jdbc层处理：StatementHandler(prepare, parameterize, batch, update, query)          



##### 官方案例

插件代码：

```java
// ExamplePlugin.java
@Intercepts({@Signature(
  type= Executor.class,
  method = "update",
  args = {MappedStatement.class,Object.class})})
public class ExamplePlugin implements Interceptor {
  private Properties properties = new Properties();
  public Object intercept(Invocation invocation) throws Throwable {
    // implement pre processing if need
    Object returnObject = invocation.proceed();
    // implement post processing if need
    return returnObject;
  }
  public void setProperties(Properties properties) {
    this.properties = properties;
  }
}
```

配置文件：

```xml
<!-- mybatis-config.xml -->
<plugins>
  <plugin interceptor="org.mybatis.example.ExamplePlugin">
    <property name="someProperty" value="100"/>
  </plugin>
</plugins>
```

说明：

- 需要实现 `interceptor`，使用注解 `@Intercepts` 指定应该怎么拦截，`@Signature` 就是具体的拦截规则。
- 然后在 `mybatis-config.xml` 中配置 `<plugins>` , 注意：需要在`<environments>` 标签之前配置(`mybatis3.dtd` 配置文件规范)。
- 注意注意：大家知道为什么 `@Signature` 注解 args 需要指定这两个参数吗？其实就是你拦截的 `method 也是 update` 他的参数类型，里面他会通过反射进行调用，所有需要参数类型，来确认是哪个 method，就这么简单。



## 源码分析

##### 

##### 解析`<Plugin>` 标签

```java
// XMLConfigBuilder
private void parseConfiguration(XNode root) {
  try {  
    // 略...
      
    // issue #117 read properties first
    // 解析 <properties>
    propertiesElement(root.evalNode("properties"));
    // 解析 <plugins>
    pluginElement(root.evalNode("plugins"));
    // 解析 <objectFactory>
    objectFactoryElement(root.evalNode("objectFactory"));
    
    // 略...
  } catch (Exception e) {
    throw new BuilderException("Error parsing SQL Mapper Configuration. Cause: " + e, e);
  }
}
// XMLConfigBuilder
private void pluginElement(XNode parent) throws Exception {
  // 插件节点
  if (parent != null) {
    for (XNode child : parent.getChildren()) {
      String interceptor = child.getStringAttribute("interceptor");
      Properties properties = child.getChildrenAsProperties();
      Interceptor interceptorInstance = (Interceptor) resolveClass(interceptor).getDeclaredConstructor().newInstance();
      interceptorInstance.setProperties(properties);
      configuration.addInterceptor(interceptorInstance);
    }
  }
}
```

说明：

- 在 pluginElement 方法中，进行解析，
- 解析玩后添加到 `configuration` 中，调用 `addInterceptor`，最终添加到 `InterceptorChain` 中。



##### InterceptorChain调用链

plugin 采用的是一个 **责任链** 的方式调用，代码如下：

```java

// InterceptorChain
public class InterceptorChain {
  private final List<Interceptor> interceptors = new ArrayList<>();
  public Object pluginAll(Object target) {
    // tip: 插件调用链
    for (Interceptor interceptor : interceptors) {
      // 获取 interceptor 插件，返回一个 proxy 对象
      target = interceptor.plugin(target);
    }
    return target;
  }
  // 略...
}

// Interceptor
public interface Interceptor {
  Object intercept(Invocation invocation) throws Throwable;
  default Object plugin(Object target) {
    // 包装一下，返回一个 proxy
    return Plugin.wrap(target, this);
  }
  default void setProperties(Properties properties) {
    // NOP
  }
}

// Plugin
public class Plugin implements InvocationHandler {
  public static Object wrap(Object target, Interceptor interceptor) {
    // tips: 用于包装一个 plugin，的代理对象
    Map<Class<?>, Set<Method>> signatureMap = getSignatureMap(interceptor);
    Class<?> type = target.getClass();
    Class<?>[] interfaces = getAllInterfaces(type, signatureMap);
    if (interfaces.length > 0) {
      // 创建 proxy 代理对象(Plugin)
      return Proxy.newProxyInstance(
          type.getClassLoader(),
          interfaces,
          new Plugin(target, interceptor, signatureMap));
    }
    return target;
  }

  @Override
  public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    try {
      // tip: 调用 Plugin Proxy对象 -> 根据对象的 method 获取方法的class
      // tip: -> 根据Class获取需不需要拦截，需要拦截就调用 intercept 进行拦截处理

      // 1、通过 method.getDeclaringClass() 获取，这个方法的 class
      // 2、获取 @Intercepts @Signature 注解的信息
      Set<Method> methods = signatureMap.get(method.getDeclaringClass());
      if (methods != null && methods.contains(method)) {
        // 拦截调用
        return interceptor.intercept(new Invocation(target, method, args));
      }
      // 方法直接调用
      return method.invoke(target, args);
    } catch (Exception e) {
      throw ExceptionUtil.unwrapThrowable(e);
    }
  }
}

```

说明：

- `InterceptorChain` 是一个 **责任链**，里面是我们添加的 `plugin` 。

- 重点在，`interceptor.plugin` 这个方法，里面创建了一个 `Plugin` ; `Plugin` 他是一个代理对象，实现了 `InvocationHandler` 这个接口。

- invoke 方法这里比较有趣，每个 proxy 保存了注解解析的信息，也就是需要拦截的方法，在调用 proxy的时候，会进入 invoke，通过 method 反推 class，然后再判断是否需要拦截。

- Execute、ParameterHandler、ResultSetHandler、StatementHandler 都会调用插件（具体都在实在 Configuration 里面）。

  ```java
  // Configuration 
  public ParameterHandler newParameterHandler(MappedStatement mappedStatement, Object parameterObject, BoundSql boundSql) {
    ParameterHandler parameterHandler = mappedStatement.getLang().createParameterHandler(mappedStatement, parameterObject, boundSql);
    parameterHandler = (ParameterHandler) interceptorChain.pluginAll(parameterHandler);
    return parameterHandler;
  }
  
  public ResultSetHandler newResultSetHandler(Executor executor, MappedStatement mappedStatement, RowBounds rowBounds, ParameterHandler parameterHandler,
      ResultHandler resultHandler, BoundSql boundSql) {
    ResultSetHandler resultSetHandler = new DefaultResultSetHandler(executor, mappedStatement, parameterHandler, resultHandler, boundSql, rowBounds);
    resultSetHandler = (ResultSetHandler) interceptorChain.pluginAll(resultSetHandler);
    return resultSetHandler;
  }
  
  public StatementHandler newStatementHandler(Executor executor, MappedStatement mappedStatement, Object parameterObject, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    // 路由选择 StatementHandler
    StatementHandler statementHandler = new RoutingStatementHandler(executor, mappedStatement, parameterObject, rowBounds, resultHandler, boundSql);
    // 调用所有 plugin
    statementHandler = (StatementHandler) interceptorChain.pluginAll(statementHandler);
    return statementHandler;
  }
  
  public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
    // 创建一个新的执行器
    executorType = executorType == null ? defaultExecutorType : executorType;
    executorType = executorType == null ? ExecutorType.SIMPLE : executorType;
    Executor executor;
    // 批量的
    if (ExecutorType.BATCH == executorType) {
      executor = new BatchExecutor(this, transaction);
    } else if (ExecutorType.REUSE == executorType) {
      executor = new ReuseExecutor(this, transaction);
    } else {
      executor = new SimpleExecutor(this, transaction);
    }
    // 开启缓存 默认true
    if (cacheEnabled) {
      executor = new CachingExecutor(executor);
    }
    // 插件(这是个 proxy)
    executor = (Executor) interceptorChain.pluginAll(executor);
    return executor;
  }
  ```

  - 所以，每个调用 `interceptorChain.pluginAll` 的方法都会创建对于的，代理对象，然后每次调用的时候，有限经过 Plugin 代理对象。

##### Plugin创建

```java
// Configuration
public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
    // 创建一个新的执行器
    executorType = executorType == null ? defaultExecutorType : executorType;
    executorType = executorType == null ? ExecutorType.SIMPLE : executorType;
    Executor executor;
    // 批量的
    if (ExecutorType.BATCH == executorType) {
        executor = new BatchExecutor(this, transaction);
    } else if (ExecutorType.REUSE == executorType) {
        executor = new ReuseExecutor(this, transaction);
    } else {
        executor = new SimpleExecutor(this, transaction);
    }
    // 开启缓存 默认true
    if (cacheEnabled) {
        executor = new CachingExecutor(executor);
    }
    // 插件(这是个 proxy)
    executor = (Executor) interceptorChain.pluginAll(executor);
    return executor;
}
```



##### 插件解析注解

```java
// Plugin
private static Map<Class<?>, Set<Method>> getSignatureMap(Interceptor interceptor) {
  // 获取 Interceptor 的 @Intercepts 注解信息
  Intercepts interceptsAnnotation = interceptor.getClass().getAnnotation(Intercepts.class);
  // issue #251
  if (interceptsAnnotation == null) {
    throw new PluginException("No @Intercepts annotation was found in interceptor " + interceptor.getClass().getName());
  }
  // 获取 @Signature 签名信息
  Signature[] sigs = interceptsAnnotation.value();
  Map<Class<?>, Set<Method>> signatureMap = new HashMap<>();
  // 每个 @Signature 都是一个 method
  for (Signature sig : sigs) {
    Set<Method> methods = signatureMap.computeIfAbsent(sig.type(), k -> new HashSet<>());
    try {
      Method method = sig.type().getMethod(sig.method(), sig.args());
      methods.add(method);
    } catch (NoSuchMethodException e) {
      throw new PluginException("Could not find method on " + sig.type() + " named " + sig.method() + ". Cause: " + e, e);
    }
  }
  return signatureMap;
}
```









完结~





# 彩蛋



1. plugin 在什么时候创建的？
2. Mybatis 里面  Plugin 采用什么模式进行调用？
3. 通过 xml 配置 plugin，在什么时候进行解析的？
4. 想自定义一个 plugin，应该怎么做？
5. plugin 可以拦截那些动作，让我们扩展？







