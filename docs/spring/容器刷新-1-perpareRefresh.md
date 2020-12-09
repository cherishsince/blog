# 容器刷新-1-perpareRefresh



简介：

`perpareRefresh` 这个阶段，主要是做一些容器的状态的激活，和记录一下开始`refresh`容器的开始时间，还会准备一些容器(`list`、 `map`)重新初始(这里的容器指 `earlyApplicationListeners` `applicationListeners`，不包含 `beanDefinition`)



代码如下：

```java
// AbstractApplicationContext	

protected void prepareRefresh() {
		// <1>、切换激活状态
		// Switch to active.
		this.startupDate = System.currentTimeMillis();
		this.closed.set(false);
		this.active.set(true);

		if (logger.isDebugEnabled()) {
			if (logger.isTraceEnabled()) {
				logger.trace("Refreshing " + this);
			} else {
				logger.debug("Refreshing " + getDisplayName());
			}
		}

		// <2>、初始化属性来源
		// Initialize any placeholder property sources in the context environment.
		initPropertySources();

		// <3>、校验必填的 properties
		// Validate that all properties marked as required are resolvable:
		// see ConfigurablePropertyResolver#setRequiredProperties
		getEnvironment().validateRequiredProperties();

		// <4>、早期的 applicationListeners，特点是：在refresh之前就会去注册
		// Store pre-refresh ApplicationListeners...
		if (this.earlyApplicationListeners == null) {
			this.earlyApplicationListeners = new LinkedHashSet<>(this.applicationListeners);
		} else {
			// 重置本地的 applicationListeners
			// Reset local application listeners to pre-refresh state.
			this.applicationListeners.clear();
			this.applicationListeners.addAll(this.earlyApplicationListeners);
		}

		// <5>、早期的event，对应于 earlyApplicationListeners
		// Allow for the collection of early ApplicationEvents,
		// to be published once the multicaster is available...
		this.earlyApplicationEvents = new LinkedHashSet<>();
	}

```

问题：

- 为啥需要**重新初始化容器**呢？

场景是在容器刷新的时候，一个经典的例子是 `spring boot 的 热部署` ，这种会频繁的刷新、销毁动作。



分析：

- <1>：切换一些状态，记录一下容器刷新的时间。
- <2>：`initPropertySources` 是一个钩子方法，提供给子类扩展的，如果子类需要在这个时候做些什么，可以重写。
- <3>：校验必填项，这个跟 `PropertyResolver` 有关，一般都没有必填项，自定义的时候，可以第一自己的必填项。
- <4>：早期的 applicationListeners，特点是：在refresh之前就会去注册。
- <5>：早期的event，对应于 earlyApplicationListeners。





ps：完结~