# 组件-4-DocumentLoader

这个用于 xml 文件的加载，这里采用了 **策略模式**，不过 `Spring` 里面现在只有一个 `DefaultDocumentLoader` ，我们看一下代码：

```java

/**
 * 用于加载XML{@link Document}的策略接口。
 *
 * Strategy interface for loading an XML {@link Document}.
 *
 * @author Rob Harrop
 * @since 2.0
 * @see DefaultDocumentLoader
 */
public interface DocumentLoader {

	/**
	 * 从提供的{@link InputSource}加载{@link Document Document}。
	 */
	Document loadDocument(
			InputSource inputSource, EntityResolver entityResolver,
			ErrorHandler errorHandler, int validationMode, boolean namespaceAware)
			throws Exception;
}
```

说明：

可以看出，Strategy interface for loading an XML {@link Document}. 翻译过来就是，采用策略模式加载 XML Document 对象。



**loadDocument() 方法：**

这里有几个参数，大家可以了了解一下，开发中大家接触的也比较少：

- `InputSource`：这个是 XML 的 `org.xml.sax.InputSource` 这下面的，用于获取XML文件信息。
- `EntityResolver`:  这个是 `org.xml.sax.EntityResolver` 用于解析 XML。
- `ErrorHandler`:  异常的处理器。



##### DefaultDocumentLoader 加载器

`DefaultDocumentLoader` 是 `DocumentLoader` 唯一实现类，**官方说是一个策略模式，不过里面暂时没有使用到策略模式**。

代码如下：

```java
  // DefaultDocumentLoader

	public Document loadDocument(InputSource inputSource, EntityResolver entityResolver,
			ErrorHandler errorHandler, int validationMode, boolean namespaceAware) throws Exception {
		// <1> 创建一个 DocumentBuilderFactory，里面采用了 Build 模式来创建 DocumentBuilderFactory
		DocumentBuilderFactory factory = createDocumentBuilderFactory(validationMode, namespaceAware);
		if (logger.isTraceEnabled()) {
			logger.trace("Using JAXP provider [" + factory.getClass().getName() + "]");
		}
		// <2> 通过 DocumentBuilderFactory 创建 DocumentBuilder
		DocumentBuilder builder = createDocumentBuilder(factory, entityResolver, errorHandler);
		// <3> 调用 DocumentBuilder解析 xml 返回一个 Document
		return builder.parse(inputSource);
	}
```

说明：

- <1> 创建一个 DocumentBuilderFactory，里面采用了 Build 模式来创建 DocumentBuilderFactory
- <2> 通过 DocumentBuilderFactory 创建 DocumentBuilder
- <3> 调用 DocumentBuilder解析 xml 返回一个 Document

>  `createDocumentBuilderFactory()` 和 `createDocumentBuilder()` 就分析了，里面调用的 `DocumentBuilderFactory` 进行 `build`。







ps：完结~