# MVC-流程概览



1. 创建 `XmlWebApplicationContext` ，在 `web.xml` 文件配置的 `ContextLoaderListener` ，在 `Servlet3` 容器初始化的时候，会进行调用，那么这个时候回去创建 `XmlWebApplicationContext` ，创建有两种方式，默认加载的 `ContextLoader.properties` 配置文件中(Spring-web 下面)，另一种就是通过 web.xml 设置 `contextClass` 属性指定 ApplicationContext`，这样就可以指定初始化。
2. 解析 `<mvc:anntation-driven>` 注解，加载 `SpringMVC` 需要用到的类，创建 `RootBeanDefinition` ，然后注册到 `BeanDefinition` 中。
3. 解析后，在 `#refresh()` 方法的 `#finishBeanFactoryInitialization()` 对注册的 beanName 进行 `#getBean()` 的初始化，那么 `SpringMVC` 标签解析的，bean 也会在这里进行初始化。
4. 扫描 `@RequestMapping @Controller` ，生成 `RequestMappingInfo`，通过 `RequestMappingHandlerMapping` 进行处理。
5. 请求发送，会经过 `Servlet#doService()` 方法，`DispatcherServlet` 本身也是个 `Servlet` ，所以也会调用；
6. 请求转发，通过 `DispatchServlet#doDispatch()` 进行转发，**在转发前，我们需要知道**，调用 `Controller` 目标方法的时候，会经过 `HandlerExecutionChain` 这个 `SpringMVC` 的拦截器，`Chain` 里面保存了一组 `HandlerInterceptor` 拦截器；
7. 获取对于的 HandlerMethod，根据请求的 `Url` 获取注册的 `RquestMappingInfo` ，在 `AbstractHandlerMethodMapping#urlLookup` 保存的是 `url` -> 对于的 `RquestMappingInfo`。
8. 获得 `HandlerMethod` ，这是通过 Match 对象获得，因为保存了 `RequestMappingInfo` 和 `HandlerMethod`。
9. 调用 HandlerMethod，获取返回值。
10. 解析返回值，使用 `HandlerMethodReturnValueHandler` 进行返回值的处理，包含 ModelAndView，@ResponseBody
11. 检查试图，如果没有 view，如果存在 view 就进行，view 的渲染(tomcat 的 jsp 渲染器)；如果是 @ResponseBody 这种，是没有 view 的。
12. 重置 ContextHolders，释放内存便于下次使用
13. 发布一个 request 事件(每完成一个 request 发送一次) 在 `FrameworkServlet#processRequest()`





其他：

- HandleMapping: 可以获取到 HandleExecutionChain 

- HandlerMethod：保存的是，Method 的所有信息

- HandleExecutionChain：一组 HandlerIntercept，里面可以获取到 HandlerMethod

- Match：中保存了一个 RequestMappingInfo 和 HandlerMethod；从哪来的呢，在注册 RequestMappingInfo 的时候，会注册 url -> RequestMappingInfo ，RequestMappingInfo -> HandlerMethod。

  





## 总结

**HttpMessageConvert 和 HandlerMethodReturnValueHandler 区别？**

- 请求一个地址的时候，会去调用 @Controller 对应的方法，然后返回一个 Object 对象；这个时候就会进入 `HandlerMethodReturnValueHandler` 处理逻辑，就是根据方法的返回类型，找到对应的 `handler`; 

- 如果是 `@ResponseBody` 注解：就会看 returnType 是否存在这个注册，存在就使用 `RequestResponseBodyMethodProcessor` 这个处理器。

- 如果是 ModelAndView：也一样，先检查 returnType 类型是不是 `ModelAndView` 如果是，那么久进行解析，`ModelAndView` 处理的信息，会放到 `ModelAndViewContainer` 中保存返回。

- `RequestResponseBodyMethodProcessor` 采用了策略模式，HttpMessageConvert 就是他的策略，找到最合适的策略，然后通过这个策略去处理。

- 注意：如果解析 `@ReponseBody` 这个注解，那么调用 HandlerMapping#handler() 方法，返回的 ModelAndView 就是空的，所以在 `#render()` 视图的时候就不会渲染 `jsp` 页面。



**RequestMappingInfo 是啥？**

`RequestMappingInfo` 对于的是我们的 `Controller` 的方法，`RequestMappingInfo` 保存的是这个方法的描述信息；一个 Method 方法对于一个  `RequestMappingInfo` ；在解析请求的时候，发现会匹配多个 `RequestMappingInfo` 出来，完全是因为 **方法重载** ；

```java
	// AbstractHandlerMethodMapping#lookupHandlerMethod(xx)

	 // Match 里面保存了一个 object，就是我们的 RequestMappingInfo
		List<Match> matches = new ArrayList<>();
		// 从 MappingRegistry 中查找，看 url 是否存在，这里查找的是 urlLookup
		List<T> directPathMatches = this.mappingRegistry.getMappingsByUrl(lookupPath);
		if (directPathMatches != null) {
			// 从所有的 RequestMappingInfo 中进行匹配
			addMatchingMappings(directPathMatches, matches, request);
		}
```

这里就是，处理请求的匹配地方，如果有多个，会进行排序，然后后获取最合适的，然后返回 `HandlerMethod`。















