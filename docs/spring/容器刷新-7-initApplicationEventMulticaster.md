# 容器刷新-7-initApplicationEventMulticaster

这一步，是初始化程序的 `Event`，代码如下：

```java
// AbstractApplicationContext
protected void initApplicationEventMulticaster() {
    // <1> 获取 BeanFactory，这里是 ConfigurableListableBeanFactory
    ConfigurableListableBeanFactory beanFactory = getBeanFactory();
    // <2> 如果 ApplicationEventMulticaster 不存在，就是用 SimpleApplicationEventMulticaster
    if (beanFactory.containsLocalBean(APPLICATION_EVENT_MULTICASTER_BEAN_NAME)) {
        // <2.1> 调用 doGetBean() 初始化 Event
        this.applicationEventMulticaster =
            beanFactory.getBean(APPLICATION_EVENT_MULTICASTER_BEAN_NAME, ApplicationEventMulticaster.class);
        if (logger.isTraceEnabled()) {
            logger.trace("Using ApplicationEventMulticaster [" + this.applicationEventMulticaster + "]");
        }
    } else {
        // <3> 通过 BeanFactory 创建 SimpleApplicationEventMulticaster，这里实例化，和初始化一并完成了
        this.applicationEventMulticaster = new SimpleApplicationEventMulticaster(beanFactory);
        // <3.1> 注册 SimpleApplicationEventMulticaster 实例
        // (直接注册到 singletonObjects 进行缓存，没有经过 earlySingletonObjects 三级缓存这些)
        beanFactory.registerSingleton(APPLICATION_EVENT_MULTICASTER_BEAN_NAME, this.applicationEventMulticaster);
        if (logger.isTraceEnabled()) {
            logger.trace("No '" + APPLICATION_EVENT_MULTICASTER_BEAN_NAME + "' bean, using " +
                         "[" + this.applicationEventMulticaster.getClass().getSimpleName() + "]");
        }
    }
}
```

说明：

- <1> 获取 BeanFactory，这里是 ConfigurableListableBeanFactory。
- <2> **如果 ApplicationEventMulticaster 不存在，就是用 SimpleApplicationEventMulticaster**。
- <2.1> 调用 doGetBean() 初始化 Event。
- <3> 通过 BeanFactory 创建 SimpleApplicationEventMulticaster，这里实例化，和初始化一并完成了。
- <3.1> 注册 SimpleApplicationEventMulticaster 实例 (直接注册到 singletonObjects 进行缓存，没有经过 earlySingletonObjects 三级缓存这些)。





ps：完结~