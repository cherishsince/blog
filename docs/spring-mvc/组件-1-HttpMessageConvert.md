# 组件-1-HttpMessageConvert

`HttpMessageConvert` 是 `Spring3.0` 增加的消息转换功能，对 `ServletRequest` 和 `ServletResponse` 的输入输出流进行封装(`ServletInputStream`、`ServletOutputStream`)。 

我们想象 `HTTP` 请求，报文分为两种，`String` 和 `Byte` 二进制(`multipart/form-data`)，我们在写 `Controller` 的时候，一般都是对象（转换好的对象），这种需要转换的对象，就是通过 `HttpMessageConvert` 进行转换。



## 预留

- HttpMessage: 用于定义报文，有两个常用的子类 `HttpInputMessage`、`HttpOutMessage` ，输入和输出。
- HttpMessageConvert: 采用策略模式，解析 `HttpMessage` **并转换成对应的类型**。





## 先熟悉 Servlet 中的溜

`ServletRequest` 和 `ServletResponse` 是 `Servlet` 的 **请求和响应** 封装，里面有我们常用的一些信息，如请求头、请求体、请求的类型 等，代码如下： 

```java
// ServletRequest
public ServletInputStream getInputStream() throws IOException; 

// ServletResponse
public ServletOutputStream getOutputStream() throws IOException;
   
```

`Spring` 中 `HttpMessage` 就是对着两个进行封装，通过这两个进行读取和写入，在读取报文和写入报文，中间通过 `HttpMessageConvert` 进行转换。



## HttpMessage

```java
/**
 * 表示HTTP请求和响应消息的基本接口。
 * 由{@link HttpHeaders}组成，可通过{@link #getHeaders（）}检索。
 *
 * Represents the base interface for HTTP request and response messages.
 * Consists of {@link HttpHeaders}, retrievable via {@link #getHeaders()}.
 *
 * @author Arjen Poutsma
 * @since 3.0
 */
public interface HttpMessage {

	/**
	 * 返回 header 信息
	 *
	 * Return the headers of this message.
	 * @return a corresponding HttpHeaders object (never {@code null})
	 */
	HttpHeaders getHeaders();
}

```

`HttpMessage` 只提供了一个获取 `HttpHeaders` 的方法，不过有几个核心的扩展 接口，`HttpInputMessage` 和 `HttpOutputMessage` 提供对 `Body` 的写入和读取功能。

如：我们常用的 `JSON` 转换，`MappingJackson2HttpMessageConverter` 、`FastJsonHttpMessageConverter` 就是对 `HttpMessageConvert` 的扩展。



## HttpMessageConvert

这个 `HttpMessageConvert` 是一个消息的转换，采用了策略模式，代码如下:

```java

/**
 * 策略接口，指定可以在HTTP请求和响应，之间进行转换的转换器。
 */
public interface HttpMessageConverter<T> {

	/**
	 * 转换器是否可以读取
	 */
	boolean canRead(Class<?> clazz, @Nullable MediaType mediaType);

	/**
	 * 转换器是否可以写
	 */
	boolean canWrite(Class<?> clazz, @Nullable MediaType mediaType);

	/**
	 * 返回此转换器支持的{@link MediaType}对象的列表。
	 */
	List<MediaType> getSupportedMediaTypes();

	/**
	 * 读取消息，读取信息
	 */
	T read(Class<? extends T> clazz, HttpInputMessage inputMessage)
			throws IOException, HttpMessageNotReadableException;

	/**
	 * 写入信息，写入信息
	 */
	void write(T t, @Nullable MediaType contentType, HttpOutputMessage outputMessage)
			throws IOException, HttpMessageNotWritableException;
}
```

说明：

- canRead(xx): 在读取前需要进行，前期的检查，是否支持这个类型的读取。
- canWrite(xx): 在读取前需要进行，前期的检查，是否支持这个类型的读取。

- read(xx): 可以指定一个类型，传入 `HttpInputMessage`，就是对 `HttpInputMessage` 进行解析，然后转换成我们对应的 `类型`。
- write(xx): 制定了一个 `MediaType`，将 `HttpOutputMessage` 以 `MediaType` 形式输出。



## 怎么注册一个 HttpMessageConvert？

咱们先了解一下下，在 `SpringMVC` 中，什么时候进行初始化的；在`RequestMappingHandlerAdapter#afterPropertiesSet()` 这个时候进行初始化，代码如下

```java
// RequestMappingHandlerAdapter

private List<HandlerMethodReturnValueHandler> getDefaultReturnValueHandlers() {
		List<HandlerMethodReturnValueHandler> handlers = new ArrayList<>();

		// Single-purpose return value types
		handlers.add(new ModelAndViewMethodReturnValueHandler());
		handlers.add(new ModelMethodProcessor());
		handlers.add(new ViewMethodReturnValueHandler());
		handlers.add(new ResponseBodyEmitterReturnValueHandler(getMessageConverters(),
				this.reactiveAdapterRegistry, this.taskExecutor, this.contentNegotiationManager));
		handlers.add(new StreamingResponseBodyReturnValueHandler());
		handlers.add(new HttpEntityMethodProcessor(getMessageConverters(),
				this.contentNegotiationManager, this.requestResponseBodyAdvice));
		handlers.add(new HttpHeadersReturnValueHandler());
		handlers.add(new CallableMethodReturnValueHandler());
		handlers.add(new DeferredResultMethodReturnValueHandler());
		handlers.add(new AsyncTaskMethodReturnValueHandler(this.beanFactory));
		// <xx>
		// Annotation-based return value types
		handlers.add(new ModelAttributeMethodProcessor(false));
		handlers.add(new RequestResponseBodyMethodProcessor(getMessageConverters(),
				this.contentNegotiationManager, this.requestResponseBodyAdvice));

		// Multi-purpose return value types
		handlers.add(new ViewNameMethodReturnValueHandler());
		handlers.add(new MapMethodProcessor());

		// Custom return value types
		if (getCustomReturnValueHandlers() != null) {
			handlers.addAll(getCustomReturnValueHandlers());
		}

		// Catch-all
		if (!CollectionUtils.isEmpty(getModelAndViewResolvers())) {
			handlers.add(new ModelAndViewResolverMethodReturnValueHandler(getModelAndViewResolvers()));
		}
		else {
			handlers.add(new ModelAttributeMethodProcessor(true));
		}

		return handlers;
	}
```

在 `afterPropertesSet()` 方法会去初始化很多 `default` 的组件，`HttpMessageConvert` ；重点在 `<xx>` 这里调用了 `#getMessageConverters()` 方法，代码如下：

```java
  // RequestMappingHandlerAdpater
	public List<HttpMessageConverter<?>> getMessageConverters() {
    // <1.1>
		return this.messageConverters;
	}

	// RequestMappingHandlerAdapter
	public RequestMappingHandlerAdapter() {
    // <2.1>
		this.messageConverters = new ArrayList<>(4);
		this.messageConverters.add(new ByteArrayHttpMessageConverter());
		this.messageConverters.add(new StringHttpMessageConverter());
		try {
			this.messageConverters.add(new SourceHttpMessageConverter<>());
		}
		catch (Error err) {
			// Ignore when no TransformerFactory implementation is available
		}
		this.messageConverters.add(new AllEncompassingFormHttpMessageConverter());
	}
 
  // RequestMappingHandlerAdapter
	public void setMessageConverters(List<HttpMessageConverter<?>> messageConverters) {
    // <3.1>
		this.messageConverters = messageConverters;
	}
```

说明：

- <1.1>：获取的是当前类的，`HttpMessageConvert` 在 `RequestMappingHandlerAdpater` 构造函数创建，看 `<2.1>`
- <2.1>: 构造函数，默认的时候会创建，几个默认的 `HttpMessageConvert`，这也是为什么，默认支持 `String` 和 `Byte` 的操作。
- <3.1>: 大家应该清楚了，我们在配置 `MappingJackson2HttpMessageConverter `和 `FastJsonHttpMessageConverter` 只需要 `<mvc:message-converters>` 标签了吧，因为 `<mvc:annotation-driven>` 在解析标签的时候，会创建 `RequestMappingHandlerAdapter` `RootBeanDefinition` ，并且设置，`MessageConvert` ，代码如下：

```xml
// 配置如下
	<mvc:annotation-driven>
		<mvc:message-converters>
			<bean id="mappingJackson2HttpMessageConverter"
				class="org.springframework.http.converter.json.MappingJackson2HttpMessageConverter"/>
		</mvc:message-converters>
	</mvc:annotation-driven>
```

```java
	// AnnotationDrivenBeanDefinitionParser
	@Override
	@Nullable
	public BeanDefinition parse(Element element, ParserContext context) {
		// 省略...
		ManagedList<?> messageConverters = getMessageConverters(element, source, context);
apter 的 RootBeanDefinition
		// 并设置 PropertyValues 收注册 RootBeanDefinition
		RootBeanDefinition handlerAdapterDef = new RootBeanDefinition(RequestMappingHandlerAdapter.class);
		handlerAdapterDef.getPropertyValues().add("messageConverters", messageConverters);
  }
```

其实很简单，大家记住 xml 配置必定有对应的，parse 解析器，spring boot 配置，必定有 Configuration 类。





ps：完结~