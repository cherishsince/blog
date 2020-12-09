# 容器刷新-11-catch动作

容器在 refresh 中发生异常，都会处理 `destroyBeans`、`cancelRefresh` 两个动作，代码如下：

```java
// AbstractApplicationContext#refresh()
catch (BeansException ex) {
  if (logger.isWarnEnabled()) {
    logger.warn("Exception encountered during context initialization - " +
                "cancelling refresh attempt: " + ex);
  }

  // <1> 销毁已经创建的Bean
  // Destroy already created singletons to avoid dangling resources.
  destroyBeans();

  // <2> 重置容器激活标签
  // Reset 'active' flag.
  cancelRefresh(ex);

  // 抛出异常
  // Propagate exception to caller.
  throw ex;
}
```

说明：

- <1> 销毁已经创建的Bean
- <2> 重置容器激活标签



##### 销毁Bean

通常都是`DefaultListableBeanFactory#destroySingletons()` 方法，销毁单例对象，然后清理BeanFactory的一些注册缓存，直接上代码：

```java
// DefaultListableBeanFactory
@Override
public void destroySingletons() {
	// <1> 优先调用 DefaultSingletonBeanRegistry 里面的 destroySingletons() 方法
	super.destroySingletons();
	// <2> 更新手册单例，这里采用了 Consumer、Predicate 两个 1.8 的特性
	// 清理的是 manualSingletonNames，这是一个按注册顺序的缓存
	updateManualSingletonNames(Set::clear, set -> !set.isEmpty());
	// <3> 根据类型清除
	clearByTypeCache();
}
```

说明：

- <1> 优先调用 DefaultSingletonBeanRegistry 里面的 destroySingletons() 方法。
- <2> 更新手册单例，这里采用了 Consumer、Predicate 两个 1.8 的特性，清理的是 manualSingletonNames，这是一个按注册顺序的缓存。
- <3> 根据类型清除。

终于：核心内容在 <1>



###### 方法分析-super.destroySingletons() 

调用的是父类 `DefaultSingletonBeanRegistry` 来进行对单例对象，进行销毁动作，代码如下：

```java
// DefaultSingletonBeanRegistry
public void destroySingletons() {
	if (logger.isTraceEnabled()) {
		logger.trace("Destroying singletons in " + this);
	}
	// <1> 设置 Destruction 销毁标识为 true，代表销毁中
	synchronized (this.singletonObjects) {
		this.singletonsCurrentlyInDestruction = true;
	}
	// <2> disposableBeanNames 是已经销毁的 bean 名称
	String[] disposableBeanNames;
	synchronized (this.disposableBeans) {
		disposableBeanNames = StringUtils.toStringArray(this.disposableBeans.keySet());
	}
	// <3> 循环销毁 bean
	for (int i = disposableBeanNames.length - 1; i >= 0; i--) {
		destroySingleton(disposableBeanNames[i]);
	}
	// <4> 清除，BeanFactory 缓存
	this.containedBeanMap.clear();
	this.dependentBeanMap.clear();
	this.dependenciesForBeanMap.clear();
	// <5> 清除，单例的缓存，这里是clear 清除所有的，上面是 remove 删除单个
	clearSingletonCache();
}
```

说明：

- <1> 设置 Destruction 销毁标识为 true，代表销毁中
- <2> disposableBeanNames 是已经销毁的 bean 名称
- <3> 循环销毁 bean
- <4> 清除，BeanFactory 缓存
- <5> 清除，单例的缓存，这里是clear 清除所有的，上面是 remove 删除单个

重点：`<3>` ，我们接下来分析



###### 方法分析-destroySingleton

```java

public void destroySingleton(String beanName) {
	// <1> 删除 singleton，删除的是单例 三级缓存
	// Remove a registered singleton of the given name, if any.
	removeSingleton(beanName);

	// <2> 销毁相应的DisposableBean实例。
	// Destroy the corresponding DisposableBean instance.
	DisposableBean disposableBean;
	synchronized (this.disposableBeans) {
		disposableBean = (DisposableBean) this.disposableBeans.remove(beanName);
	}
	// <3> 去销毁 bean 实例
	destroyBean(beanName, disposableBean);
}

```

说明：

- <1> 删除 singleton，删除的是单例 三级缓存
- <2> 销毁相应的DisposableBean实例。
- <3> 去销毁 bean 实例

重点是：<3>



###### 方法分析-destroyBean

```java


protected void destroyBean(String beanName, @Nullable DisposableBean bean) {
	// tips:
	// bean的销毁逻辑，优先销毁bean的依赖，然后销毁bean

	// <1> 首先从 bean 的依赖开始销毁
	// Trigger destruction of dependent beans first...
	Set<String> dependencies;
	synchronized (this.dependentBeanMap) {
		// <2> 将谁依赖他，从map中删除
		// 完全同步，命令保证断开设置
		// Within full synchronization in order to guarantee a disconnected Set
		dependencies = this.dependentBeanMap.remove(beanName);
	}
	// <3> 有其他class 依赖这个 class 进入
	if (dependencies != null) {
		if (logger.isTraceEnabled()) {
			logger.trace("Retrieved dependent beans for bean '" + beanName + "': " + dependencies);
		}
		// <4> 这里是个递归调用，会再次进入到这里
		for (String dependentBeanName : dependencies) {
			destroySingleton(dependentBeanName);
		}
	}

	// <5> 销毁实现 DisposableBean 的 bean 实例
	// Actually destroy the bean now...
	if (bean != null) {
		try {
			// <6> 调用bean的 destroy() 方法
			bean.destroy();
		} catch (Throwable ex) {
			if (logger.isWarnEnabled()) {
				logger.warn("Destruction of bean with name '" + beanName + "' threw an exception", ex);
			}
		}
	}

	// <6> 销毁容器里面的 bean，
	// containedBeans 是移除 beanName 后其他的依赖，这里使用一个递归继续销毁
	// Trigger destruction of contained beans...
	Set<String> containedBeans;
	// <7> 销毁容器的 bean，从 containedBeanMap 移除，
	synchronized (this.containedBeanMap) {
		// Within full synchronization in order to guarantee a disconnected Set
		// 这里的map关系是：bean名称之间依赖，bean name设置bean包含的bean名称。
		containedBeans = this.containedBeanMap.remove(beanName);
	}
	// <8> 对移除后的，依赖进行销毁动作。
	if (containedBeans != null) {
		for (String containedBeanName : containedBeans) {
			destroySingleton(containedBeanName);
		}
	}

	// <9> 从其他bean的依赖项中删除销毁的bean。
	// Remove destroyed bean from other beans' dependencies.
	synchronized (this.dependentBeanMap) {
		// <9> 迭代 dependentBeanMap 这个map，从 value 中移除
		for (Iterator<Map.Entry<String, Set<String>>> it = this.dependentBeanMap.entrySet().iterator(); it.hasNext(); ) {
			Map.Entry<String, Set<String>> entry = it.next();
			Set<String> dependenciesToClean = entry.getValue();
			dependenciesToClean.remove(beanName);
			// 如果 dependenciesToClean 为空了，就把这个 key 直接删除了
			if (dependenciesToClean.isEmpty()) {
				it.remove();
			}
		}
	}

	// <10> 删除他依赖谁，的map缓存。
	// Remove destroyed bean's prepared dependency information.
	this.dependenciesForBeanMap.remove(beanName);
}
```

说明：

- <1> 首先从 bean 的依赖开始销毁
- <2> 将谁依赖他，从map中删除
- <3> 有其他class 依赖这个 class 进入
- <4> 这里是个递归调用，会再次进入到这里
- <5> 销毁实现 DisposableBean 的 bean 实例
- <6> 销毁容器里面的 bean， containedBeans 是移除 beanName 后其他的依赖，这里使用一个递归继续销毁
- <7> 销毁容器的 bean，从 containedBeanMap 移除，
- <8> 对移除后的，依赖进行销毁动作。
- <9> 从其他bean的依赖项中删除销毁的bean。
- <10> 删除他依赖谁，的map缓存。



**到这整个 destroy() 动作已经完了。**



##### 方法分析-cancelRefresh

关闭刷新，里面比较简单，代码如下：

```java
// AbstractRefreshableApplicationContext
@Override
protected void cancelRefresh(BeansException ex) {
	// <1> 清除 BeanFactory 的 SerializationId
	synchronized (this.beanFactoryMonitor) {
		if (this.beanFactory != null) {
			this.beanFactory.setSerializationId(null);
		}
	}
	// <2> 调用父类的 cancelRefresh 将容器刷新状态设置成 false
	super.cancelRefresh(ex);
}

// AbstractApplicationContext
protected void cancelRefresh(BeansException ex) {
  // <1> 将容器刷新状态设置成 false
  this.active.set(false);
}
```

说明：

- <1> 清除 BeanFactory 的 SerializationId。
- <2> 调用父类的 cancelRefresh 将容器刷新状态设置成 false。





ps：完结~



