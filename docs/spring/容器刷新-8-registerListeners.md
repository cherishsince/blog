# 容器刷新-8-registerListeners.md

这里是注册监听，没注册监听前，只有注册完监听后才能使用，这里需要注意，注册完 Listener 后会发布一个早期的 Event。

```java
// AbstractApplicationContext
protected void registerListeners() {
	// <1> 优先注册静态指定的侦听器。
	// Register statically specified listeners first.
	for (ApplicationListener<?> listener : getApplicationListeners()) {
		getApplicationEventMulticaster().addApplicationListener(listener);
	}

	// <2> 将 ApplicationListener 这个类型的 beanName 全部拿到，然后注册到 Listener
	// 不要在这里初始化FactoryBeans：我们需要保留所有未初始化的常规bean，以便后处理器对其应用！
	// Do not initialize FactoryBeans here: We need to leave all regular beans
	// uninitialized to let post-processors apply to them!
	String[] listenerBeanNames = getBeanNamesForType(ApplicationListener.class, true, false);
	for (String listenerBeanName : listenerBeanNames) {
		getApplicationEventMulticaster().addApplicationListenerBean(listenerBeanName);
	}

	// <3> 这里是发布一些早期的 Event
	// 现在我们终于有了一个多播器，可以发布早期的应用程序事件。
	// Publish early application events now that we finally have a multicaster...
	Set<ApplicationEvent> earlyEventsToProcess = this.earlyApplicationEvents;
	this.earlyApplicationEvents = null;
	if (earlyEventsToProcess != null) {
		for (ApplicationEvent earlyEvent : earlyEventsToProcess) {
			getApplicationEventMulticaster().multicastEvent(earlyEvent);
		}
	}
}
```

说明：

- <1> 优先注册静态指定的侦听器。
- <2> 将 ApplicationListener 这个类型的 beanName 全部拿到，然后注册到 Listener
- <3> 这里是发布一些早期的 Event

