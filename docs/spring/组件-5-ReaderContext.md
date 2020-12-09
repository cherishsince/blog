# 组件-5-ReaderContext

`ReaderContext` 是在 `Xml` 读取的时候，使用到的 `Context` ，在bean定义读取过程中传递的上下文，它封装了所有相关的配置和状态。

部分代码如下：

```java
  // ReaderContext

  // 略 ...

	/**
	 * Resource 资源
	 */
	private final Resource resource;
	/**
	 * 问题报告(记录异常的)
	 */
	private final ProblemReporter problemReporter;
	/**
	 * BeanDefinition 的事件监听，是 EventListener 的扩展
	 */
	private final ReaderEventListener eventListener;
	/**
	 * 源数据提取器
	 */
	private final SourceExtractor sourceExtractor;

  // 略 ...
```

说明：

可以看到，`Context` 中保存的信息全在这，`Resource` 的资源、异常的处理器、读取完后的事件监听、源数据的提取方法。

(和普通的 Context 基本一样，简单理解就好了~)



###### XmlReaderContext 扩展类

`XmlReaderContext` 读取类，这里是 `ReaderContext` 扩展，里面增加了 xml 读取 和 xml namespace 解析。

```java
// XmlReaderContext

// <1> 用于xml读取
private final XmlBeanDefinitionReader reader;
// <2> 用于namespace处理，就是xml上面的uri
private final NamespaceHandlerResolver namespaceHandlerResolver;
```

说明：

- <1> 用于xml读取
- <2> 用于namespace处理，就是xml上面的uri

(和普通的 Context 基本一样，简单理解就好了~)





ps: 完结~