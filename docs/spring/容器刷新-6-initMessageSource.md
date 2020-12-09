# 容器刷新-6-initMessageSource

初始化 `MessageSource` ，里面做了什么事情呢？就是检查 BeanFactory 容器是否存在 `messageSource` ，如果存在就检查 `BeanFactory` 是否存在 `parent`容器，如果存在就将父类的 `MessageSource` 设置到到期的 `MessageSource`。

```java
// AbstractApplicationContext

protected void initMessageSource() {
	// <1> 获取 ConfigurableListableBeanFactory
	ConfigurableListableBeanFactory beanFactory = getBeanFactory();
	// <2> BeanFactory 容器如果存在 messageSource 进入
	if (beanFactory.containsLocalBean(MESSAGE_SOURCE_BEAN_NAME)) {
		// <2.1> 从容器中获取 MessageSource
		this.messageSource = beanFactory.getBean(MESSAGE_SOURCE_BEAN_NAME, MessageSource.class);
		// <2.2> 使 MessageSource 去解析 父类的 MessageSource，
		// 这里是应为 BeanFactory 有 parent 属性，所以如果 parent 容器存在，
		// 那么就需要去设置一下 parentMessageSource
		// Make MessageSource aware of parent MessageSource.
		if (this.parent != null && this.messageSource instanceof HierarchicalMessageSource) {
			HierarchicalMessageSource hms = (HierarchicalMessageSource) this.messageSource;
			if (hms.getParentMessageSource() == null) {
				// 仅当尚未注册父消息源时，才将父上下文设置为父消息源。
				// Only set parent context as parent MessageSource if no parent MessageSource
				// registered already.

				// <1> getInternalParentMessageSource() 是，如果 parent 也是 AbstractApplicationContext，
				// 那么就拿父类的 MessageSource 设置到 setParentMessageSource() 中
				hms.setParentMessageSource(getInternalParentMessageSource());
			}
		}
		if (logger.isTraceEnabled()) {
			logger.trace("Using MessageSource [" + this.messageSource + "]");
		}
	} else {
		// <3> 这个地方的意思呢是，如果没有 messageSource 呢，就是用 DelegatingMessageSource 来占个坑，
		// 代表不实用 messageSource 国际化(可以看 DelegatingMessageSource 说明)。

		// 使用空的MessageSource可以接受getMessage调用。
		// Use empty MessageSource to be able to accept getMessage calls.
		DelegatingMessageSource dms = new DelegatingMessageSource();
		dms.setParentMessageSource(getInternalParentMessageSource());
		this.messageSource = dms;
		beanFactory.registerSingleton(MESSAGE_SOURCE_BEAN_NAME, this.messageSource);
		if (logger.isTraceEnabled()) {
			logger.trace("No '" + MESSAGE_SOURCE_BEAN_NAME + "' bean, using [" + this.messageSource + "]");
		}
	}
}
```

说明：

- <1> 获取 ConfigurableListableBeanFactory
- <2> BeanFactory 容器如果存在 messageSource 进入
- <2.1> 从容器中获取 MessageSource
- <2.2> 使 MessageSource 去解析 父类的 MessageSource，这里是应为 BeanFactory 有 parent 属性，所以如果 parent 容器存在，那么就需要去设置一下 parentMessageSource
- <3> 这个地方的意思呢是，如果没有 messageSource 呢，就是用 DelegatingMessageSource 来占个坑，代表不实用 messageSource 国际化(可以看 DelegatingMessageSource 说明)。





ps：完结~

