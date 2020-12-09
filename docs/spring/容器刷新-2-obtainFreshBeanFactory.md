# 容器刷新-2-obtainFreshBeanFactory



介绍：

`obtainFreshBeanFactory` 这个方法代码不多，不过挺重要的，在refresh的时候告诉子类，就是同事刷新子类的 `refreshBeanFactory` 。

在 `Spring` 中现在主要用于两个地方，`ClassPathApplicationContext`和 `AnnotationConfigApplicationContext`，一个是 xml 初`始application context` 一个是通过 `config.class` 初始化。



代码如下:

```java
// AbstractApplicationContext

protected ConfigurableListableBeanFactory obtainFreshBeanFactory() {
		// <1> 提供给子类的扩展，用于刷新容器
		refreshBeanFactory();
		// <2> 提供给子类的扩展，获取当前 Context 中的 BeanFactory
		return getBeanFactory();
	}

```

分析：

- <1>：提供给子类的扩展，用于刷新容器，这里有两条路线，一个是 xml 一个是 config.class 配置的方式。

- <2>：提供给子类的扩展，获取当前 Context 中的 BeanFactory



xml 路线

```java
// AbstractRefreshableApplicationContext

protected final void refreshBeanFactory() throws BeansException {
		// <1> 存在 beanFactory 那么先 "销毁"
		if (hasBeanFactory()) {
			destroyBeans();
			closeBeanFactory();
		}
		try {
			// <2> 这里创建的是 DefaultListableBeanFactory
			DefaultListableBeanFactory beanFactory = createBeanFactory();
			// <3> 容器的id，getId() 是使用生成(就是hashCode) ObjectUtils.identityToString(this);
			beanFactory.setSerializationId(getId());
			// <4> 设置 BeanFactory 的两个配置属性：是否允许 Bean 覆盖、是否允许循环引用
			customizeBeanFactory(beanFactory);
			// <5> 将 bean 加载到 beanFactory(解析 xml，创建 BeanDefinitions)
			loadBeanDefinitions(beanFactory);
			synchronized (this.beanFactoryMonitor) {
				this.beanFactory = beanFactory;
			}
		} catch (IOException ex) {
			throw new ApplicationContextException("I/O error parsing bean definition source for " + getDisplayName(), ex);
		}
	}
```

分析：

- <1> 至 <4>：略.. 字面意思。
- <5>：这个是重点，这里是 xml 到 beanDefinition 的转换过程(层级深、复杂 给大家提个醒)。



> 这里省略了 loadBeanDefinitions() 分析，会有专门的文章分析 TODO



ps：完结~