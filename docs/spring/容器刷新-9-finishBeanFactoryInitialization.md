# 容器刷新-9-finishBeanFactoryInitialization

`finishBeanFactoryInitialization`  这一步是完成 `Bean` 的初始化过程，在这里也会改变状态，用于冻结容器，不允许修改，代码如下：

```java
// AbstractApplicationContext
protected void finishBeanFactoryInitialization(ConfigurableListableBeanFactory beanFactory) {
	// tips:
	// 初始化剩余 BeanFactory、SingletonBean

	// <1> 初始化 ConversionService 转换器(这个用于类型的转换)
	// Initialize conversion service for this context.

	// <2> 条件说明：BeanFactory 存在 conversionService && 通过 BeanFactory 匹配是否存在这个类型
	if (beanFactory.containsBean(CONVERSION_SERVICE_BEAN_NAME)
			&& beanFactory.isTypeMatch(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class)) {
		// <2.1> 通过 BeanFactory 获取 conversionService 设置给 BeanFactory
		beanFactory.setConversionService(
				beanFactory.getBean(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class));
	}

	// Register a default embedded value resolver if no bean post-processor
	// (such as a PropertyPlaceholderConfigurer bean) registered any before:
	// at this point, primarily for resolution in annotation attribute values.
	// <3> 如果之前没有注册 bean 后置处理器（例如PropertyPlaceholderConfigurer），则注册默认的解析器
	if (!beanFactory.hasEmbeddedValueResolver()) {
		// <3.1> lambda 表达式，其实就是使用 resolvePlaceholders 去解析传入的 strVal 解析完后返回
		beanFactory.addEmbeddedValueResolver(strVal -> getEnvironment().resolvePlaceholders(strVal));
	}

	// <4> LoadTimeWeaverAware 是用于AspectJ增强
	// 尽早初始化LoadTimeWeaverAware bean，以便尽早注册其转换器。
	// Initialize LoadTimeWeaverAware beans early to allow for registering their transformers early.
	String[] weaverAwareNames = beanFactory.getBeanNamesForType(LoadTimeWeaverAware.class, false, false);
	for (String weaverAwareName : weaverAwareNames) {
		getBean(weaverAwareName);
	}

	// <5> 停止使用临时类加载器进行类型匹配。
	// Stop using the temporary ClassLoader for type matching.
	beanFactory.setTempClassLoader(null);

	// <6> 这里是冻结的意思，不允许再修改了，
	// 第一，会更新 configurationFrozen 标识为 true，代表不能再进行操作了
	// 第二，会将 beanDefinitionNames 转换为一个固定长度的 Array 进行冻结
	// 允许缓存所有bean定义元数据，不需要进一步更改。
	// Allow for caching all bean definition metadata, not expecting further changes.
	beanFactory.freezeConfiguration();

	// <7> 实例化所有剩余的单例（非延迟加载的）。
	// Instantiate all remaining (non-lazy-init) singletons.
	beanFactory.preInstantiateSingletons();
}
```

说明：

- <1> 初始化 ConversionService 转换器(这个用于类型的转换)。
- <2> 条件说明：BeanFactory 存在 conversionService && 通过 BeanFactory 匹配是否存在这个类型。
- <2.1> 通过 BeanFactory 获取 conversionService 设置给 BeanFactory。
- <3> 如果之前没有注册 bean 后置处理器（例如PropertyPlaceholderConfigurer），则注册默认的解析器。
- <3.1> <3.1> lambda 表达式，这里匿名实现了一个 StringValueResolver，采用 Environment 里面的 resolvePlaceholders() 解析器，进行处理
- <4> LoadTimeWeaverAware 是用于AspectJ增强，尽早初始化LoadTimeWeaverAware bean，以便尽早注册其转换器。
- <5> 停止使用临时类加载器进行类型匹配。
- <6> 这里是冻结的意思，不允许再修改了，第一，会更新 configurationFrozen 标识为 true，代表不能再进行操作了，第二，会将 beanDefinitionNames 转换为一个固定长度的 Array 进行冻结。



总结一下：

- 初始化 `ConversionService` 用于转换属性
- `BeanFactory` 增加一个 `StringValueResolver` 解析器
- 初始化 `LoadTimeWeaverAware` 对 `AspectJ` 增强
- 删除 `BeanFactory` 的临时加载器
- 冻结 `BeanFactory` 容器里面的 `beanNames`
- 开始初始化所有的 `beanNames` (懒加载除外)



###### 初始化剩余容器-preInstantiateSingletons

上面是初始化特殊的容器，和做一些初始化前的一些准备，这里开始对 `beanNames` 容器进行初始化，代码如下：

```java
// DefaultListableBeanFactory
@Override
public void preInstantiateSingletons() throws BeansException {
	if (logger.isTraceEnabled()) {
		logger.trace("Pre-instantiating singletons in " + this);
	}

	// <1> 遍历一个副本以允许使用init方法，这些方法依次注册新的bean定义。
	// 尽管这可能不是常规工厂引导程序的一部分，但可以正常运行。
	// Iterate over a copy to allow for init methods which in turn register new bean definitions.
	// While this may not be part of the regular factory bootstrap, it does otherwise work fine.
	List<String> beanNames = new ArrayList<>(this.beanDefinitionNames);

	// <2> 触发所有的非懒加载的 singleton beans 的初始化操作
	// Trigger initialization of all non-lazy singleton beans...
	for (String beanName : beanNames) {
		// <2.1> 合并 BeanDefinition 返回 RootBeanDefinition，
		// 看一下bean标签 <bean id="" class="" parent="" /> 就是这个 parent
		// 如果 parent 存在，就合并后返回 RootBeanDefinition，没有就转换为 RootBeanDefinition 返回
		RootBeanDefinition bd = getMergedLocalBeanDefinition(beanName);
		// <2.2> 不是一个 abstract && 是单例 && 不是懒加载(进入)
		if (!bd.isAbstract() && bd.isSingleton() && !bd.isLazyInit()) {
			// <2.3> FactoryBean 需要额外处理，只有 isEagerInit 的时候才进行 doGetBean() 进行初始化
			if (isFactoryBean(beanName)) {
				// FactoryBean 的话，在 beanName 前面加上 ‘&’ 符号。再调用 getBean，getBean 方法别急
				Object bean = getBean(FACTORY_BEAN_PREFIX + beanName);
				if (bean instanceof FactoryBean) {
					final FactoryBean<?> factory = (FactoryBean<?>) bean;
					// 渴望加载
					boolean isEagerInit;
					if (System.getSecurityManager() != null && factory instanceof SmartFactoryBean) {
						isEagerInit = AccessController.doPrivileged((PrivilegedAction<Boolean>)
										((SmartFactoryBean<?>) factory)::isEagerInit,
								getAccessControlContext());
					} else {
						isEagerInit = (factory instanceof SmartFactoryBean &&
								((SmartFactoryBean<?>) factory).isEagerInit());
					}
					if (isEagerInit) {
						getBean(beanName);
					}
				}
			} else {
				// <2.4> 调用的是 doGetBean() 对 Bean 进行初始化，这里是初始化 注意！
				getBean(beanName);
			}
		}
	}

	// <3> 到这里所有的 singleton 都已经初始化完了(懒加载的除外)，
	// 如果Bean 实现了 SmartInitializingSingleton 接口，这里需要进行回调
	// Trigger post-initialization callback for all applicable beans...
	for (String beanName : beanNames) {
		Object singletonInstance = getSingleton(beanName);
		// <3.1> 判断 bean 是否实现了 SmartInitializingSingleton
		if (singletonInstance instanceof SmartInitializingSingleton) {
			// <3.2> 回调 afterSingletonsInstantiated 方法
			final SmartInitializingSingleton smartSingleton = (SmartInitializingSingleton) singletonInstance;
			if (System.getSecurityManager() != null) {
				AccessController.doPrivileged((PrivilegedAction<Object>) () -> {
					smartSingleton.afterSingletonsInstantiated();
					return null;
				}, getAccessControlContext());
			} else {
				smartSingleton.afterSingletonsInstantiated();
			}
		}
	}
}
```

说明：

- <1> 遍历一个副本以允许使用init方法，这些方法依次注册新的bean定义。
- <2> 触发所有的非懒加载的 singleton beans 的初始化操作。
- <2.1> 合并 BeanDefinition 返回 RootBeanDefinition，看一下bean标签 `<bean id="" class="" parent="" />` 就是这个 parent  如果 parent 存在，就合并后返回 RootBeanDefinition，没有就转换为 RootBeanDefinition 返回。
- <2.2> 不是一个 abstract && 是单例 && 不是懒加载(进入)。
- <2.3> FactoryBean 需要额外处理，只有 isEagerInit 的时候才进行 doGetBean() 进行初始化。
- <2.4> 调用的是 doGetBean() 对 Bean 进行初始化，这里是初始化 注意！。
- <3> 到这里所有的 singleton 都已经初始化完了(懒加载的除外)，如果Bean 实现了 SmartInitializingSingleton 接口，这里需要进行回调。
- <3.1> 判断 bean 是否实现了 SmartInitializingSingleton。
- <3.2> 回调 afterSingletonsInstantiated 方法。



总结：

- 第一步，初始化普通的 `bean` 实例。
- 第二步，对实现 `SmartInitializingSingleton` 接口的 `bean`，需要进行 `afterSingletonsInstantiated()` 的回调。



ps：完结~









