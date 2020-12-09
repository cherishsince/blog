# 组件-6-BeanDefinitionParserDelegate

看名字基本能理解到一二，我们先看 `NamespaceHandler` 和 `NamesoaceHandlerResolver` ，和着两个类有什么关系呢？

`xml` 是有命名空间的，需要引入对于的 `URI` 才能使用对于的功能，那么对于的 `NamespaceHandler` 就是对应的 `URI` 处理逻辑，记过 `parse()` 获取 `BeanDefinition` 对象。

我们看一下 `NamespaceHandler ` 代码: 

```java
// NamespaceHandler

public interface NamespaceHandler {

	/**
	 * <1> 由{@link DefaultBeanDefinitionDocumentReader}在构造之后，在分析任何自定义元素，之前调用。
	 */
	void init();

	/**
	 * <2> 解析 BeanDefinition
	 */
	@Nullable
	BeanDefinition parse(Element element, ParserContext parserContext);

	/**
	 * <3> 分析指定的{@link Node}并修饰提供的{@link BeanDefinitionHolder}，返回修饰的定义。
	 * {@link Node}可以是{@link org.w3c。本地属性}或者{@link Element}，
	 * 这取决于是否正在分析自定义属性或元素。
	 */
	@Nullable
	BeanDefinitionHolder decorate(Node source, BeanDefinitionHolder definition, ParserContext parserContext);
}
```

说明：

- <1> `init()` 方法，是用于注册自己，告诉上层，我能处理什么 **标签**。
- <2> `parse()` 方法，这里就是解析 `Element` 节点。
- <3> `decorate()` 方法，这是一个 **修饰功能**，处理 `parse()` 后的逻辑。



##### NamespaceHandlerResolver 解析器

解析器里面就很简单，根据 `URI ` 获取一个 `NamespaceHandler`，没有就返回 null。

```java
// NamespaceHandlerResolver

@FunctionalInterface
public interface NamespaceHandlerResolver {

	/**
	 * 解析 namespace URI， 返回这个 URI 的处理器
	 */
	@Nullable
	NamespaceHandler resolve(String namespaceUri);
}
```



###### 再看看-BeanDefinitionParserDelegate 

看看  `BeanDefinitionParserDelegate ` 是怎么回事，其实就是 默认解析、和自定义 这两种，组件都是自定义，像 `<bean>` 这种基础标签，就在 Delegate 处理了，**扩展的/自定义**  的才使用 `NamespaceHandlerResolver` 解析。

我们回顾一下代码：

```java
// DefaultBeanDefinitionDocumentReader

protected void parseBeanDefinitions(Element root, BeanDefinitionParserDelegate delegate) {
	// <1> 默认命名空间，执行如下，检查是不是 http://www.springframework.org/schema/beans，下的标签
	if (delegate.isDefaultNamespace(root)) {
		// <2> 处理所有子节点，进行解析，里面还存在 递归情况，没有子节点就不会进入 for，一般root节点会有的
		NodeList nl = root.getChildNodes();
		for (int i = 0; i < nl.getLength(); i++) {
			Node node = nl.item(i);
			if (node instanceof Element) {
				Element ele = (Element) node;
				// <2.1> 默认命名空间，执行如下，检查是不是 http://www.springframework.org/schema/beans，下的标签
				if (delegate.isDefaultNamespace(ele)) {
					parseDefaultElement(ele, delegate);
				} else {
					// <2.2> 自定义 或 扩展标签 解析，扩展的 BeanDefinition 解析全在里面了
					// 这里调用 parseCustomElement 原因是，默认的标签下，有自定义标签情况
					delegate.parseCustomElement(ele);
				}
			}
		}
	} else {
		// <3> 不是默认命名空间执行(自定义 或 扩展标签 解析)
		// 如：<tx:annotation-driven> <component-scan>
		delegate.parseCustomElement(root);
	}
}
```

说明：

重点看 `<2.1>`、`<2.2>`，这两个就是自定义入口，里面采用的就是 `NamespaceHandlerResolver` 来进行解析的。

这里不做多介绍，大家看一下源码即可明白~





ps：完结~



