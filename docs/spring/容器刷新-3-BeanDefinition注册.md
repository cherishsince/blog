# 容器刷新-3-BeanDefinition注册

由于 `BeanDefinition` 解析分为两种，那么入口不一样，不过最终还是会到 `DefaultListableBeanFactory` 进行注册。



##### 默认命名空间

这个实在解析 `<bean>` 标签后就会进行注册，我们回顾一下代码：

```java
// 	DefaultBeanDefinitionDocumentReader

protected void processBeanDefinition(Element ele, BeanDefinitionParserDelegate delegate) {
	// <1> 创建 beanDefinition，并解析 xml 文件属性 设置到 beanDefinition
	// bdHolder 里面就是 BeanDefinition，
	BeanDefinitionHolder bdHolder = delegate.parseBeanDefinitionElement(ele);
	if (bdHolder != null) {
		// <2> 装饰 BeanDefinition，一般用于自定义标签
		bdHolder = delegate.decorateBeanDefinitionIfRequired(ele, bdHolder);
		try {
			// <3> 注册 BeanDefinition
			// Register the final decorated instance.
			BeanDefinitionReaderUtils.registerBeanDefinition(bdHolder, getReaderContext().getRegistry());
		} catch (BeanDefinitionStoreException ex) {
			getReaderContext().error("Failed to register bean definition with name '" +
					bdHolder.getBeanName() + "'", ele, ex);
		}

		// <4> 注册完后，发送通知
		// Send registration event.
		getReaderContext().fireComponentRegistered(new BeanComponentDefinition(bdHolder));
	}
}
```

说明：

- <1> 创建 beanDefinition，并解析 xml 文件属性 设置到 beanDefinition。
- <2> 装饰 BeanDefinition，一般用于自定义标签
- <3> 注册 BeanDefinition，调用 `BeanDefinitionReaderUtils`。
- <4> 注册完后，发送通知



**我们看一下 BeanDefinitionReaderUtils.registerBeanDefinition**

这个utils 就是为了代码复用罢了，里面调用了 register，register 就是 XmlReaderContext 里面的，代码如下：

```java
// BeanDefinitionReaderUtils

public static void registerBeanDefinition(
			BeanDefinitionHolder definitionHolder, BeanDefinitionRegistry registry)
			throws BeanDefinitionStoreException {

    // <1> 获取 beanName 用作与注册的名字
    // Register bean definition under primary name.
    String beanName = definitionHolder.getBeanName();
    // <2> 这里是去注册 BeanDefinition，register 就是 XmlReaderContext 里面的
    registry.registerBeanDefinition(beanName, definitionHolder.getBeanDefinition());

    // <3> 这里是注册别名，BeanDefinitionRegistry 继承了 AliasRegistry，所以有此功能
    // Register aliases for bean name, if any.
    String[] aliases = definitionHolder.getAliases();
    if (aliases != null) {
        for (String alias : aliases) {
            registry.registerAlias(beanName, alias);
        }
    }
}
```

说明：

- <1> 获取 beanName 用作与注册的名字

- <2> 这里是去注册 BeanDefinition，register 就是 XmlReaderContext 里面的
- <3> 这里是注册别名，BeanDefinitionRegistry 继承了 AliasRegistry，所以有此功能



我们重点放到 `<2>` 代码如下：

`DefaultListableBeanFactory` 才是最终的注册 (也很正常，应为本来就是一个 `DefaultListableBeanFactory` ，那么返回来注册也得回来，不然怎么管理 `BeanDefinition`)。

```java
// DefaultListableBeanFactory

@Override
public void registerBeanDefinition(String beanName, BeanDefinition beanDefinition)
		throws BeanDefinitionStoreException {
	// <1> 检查参数
	Assert.hasText(beanName, "Bean name must not be empty");
	Assert.notNull(beanDefinition, "BeanDefinition must not be null");

	// <2> 这里的 validate 是校验，方法是否允许覆盖
	if (beanDefinition instanceof AbstractBeanDefinition) {
		try {
			((AbstractBeanDefinition) beanDefinition).validate();
		} catch (BeanDefinitionValidationException ex) {
			throw new BeanDefinitionStoreException(beanDefinition.getResourceDescription(), beanName,
					"Validation of bean definition failed", ex);
		}
	}

	// <3> 检查 BeanDefinition 是否存在，存在进入!
	BeanDefinition existingDefinition = this.beanDefinitionMap.get(beanName);
	if (existingDefinition != null) {
		// <3.1> 检查是否允许 BeanDefinition 覆盖，默认为 true
		// 不允许 BeanDefinitionOverrideException 异常
		// 允许 会记录一下日志，然后进行put覆盖动作
		if (!isAllowBeanDefinitionOverriding()) {
			throw new BeanDefinitionOverrideException(beanName, beanDefinition, existingDefinition);
		} else if (existingDefinition.getRole() < beanDefinition.getRole()) {
			// e.g. was ROLE_APPLICATION, now overriding with ROLE_SUPPORT or ROLE_INFRASTRUCTURE
			if (logger.isInfoEnabled()) {
				logger.info("Overriding user-defined bean definition for bean '" + beanName +
						"' with a framework-generated bean definition: replacing [" +
						existingDefinition + "] with [" + beanDefinition + "]");
			}
		} else if (!beanDefinition.equals(existingDefinition)) {
			if (logger.isDebugEnabled()) {
				logger.debug("Overriding bean definition for bean '" + beanName +
						"' with a different definition: replacing [" + existingDefinition +
						"] with [" + beanDefinition + "]");
			}
		} else {
			if (logger.isTraceEnabled()) {
				logger.trace("Overriding bean definition for bean '" + beanName +
						"' with an equivalent definition: replacing [" + existingDefinition +
						"] with [" + beanDefinition + "]");
			}
		}
		this.beanDefinitionMap.put(beanName, beanDefinition);
	}
	// <4> 这里是正常的 == null 情况进入
	else {
		// <5> alreadyCreated != 空就进入，这里分为两个部分
		// 第一部分，容器doGetBean()后，就是容器已经过了注册阶段，还来修改(支持功能是为了迭代)
		// 第二部分，注册阶段，直接 put 进去即可
		if (hasBeanCreationStarted()) {
			// <5.1> 已经不推荐使用，这是为了兼容迭代(已经不推荐了)
			// 无法再修改启动时间集合元素（用于稳定迭代）
			// Cannot modify startup-time collection elements anymore (for stable iteration)
			synchronized (this.beanDefinitionMap) {
				this.beanDefinitionMap.put(beanName, beanDefinition);
				List<String> updatedDefinitions = new ArrayList<>(this.beanDefinitionNames.size() + 1);
				updatedDefinitions.addAll(this.beanDefinitionNames);
				updatedDefinitions.add(beanName);
				this.beanDefinitionNames = updatedDefinitions;
				removeManualSingletonName(beanName);
			}
		} else {
			// <5.2> 仍处于启动注册阶段
			// Still in startup registration phase
			this.beanDefinitionMap.put(beanName, beanDefinition);
			this.beanDefinitionNames.add(beanName);
			removeManualSingletonName(beanName);
		}
		// 这是冻结的 names 最后需要释放
		this.frozenBeanDefinitionNames = null;
	}

    // <6> rest 重置，只有在 BeanDefinition 已经注册的情况下，再来注册才需要 rest。
    // 这里 rest 就是根据 beanName 进行清理缓存。
	if (existingDefinition != null || containsSingleton(beanName)) {
		resetBeanDefinition(beanName);
	}
}
```

说明：

- <1> 检查参数

-  <2> 这里的 validate 是校验，方法是否允许覆盖

- <3> 检查 BeanDefinition 是否存在，存在进入!

- <3.1> 检查是否允许 BeanDefinition 覆盖，默认为 true，不允许 BeanDefinitionOverrideException 异常，允许 会记录一下日志，然后进行put覆盖动作

- <4> 这里是正常的 == null 情况进入

- <5> alreadyCreated != 空就进入，这里分为两个部分，第一部分，容器doGetBean()后，就是容器已经过了注册阶段，还来修改(支持功能是为了迭代)，第二部分，注册阶段，直接 put 进去即可

- <5.1> 已经不推荐使用，这是为了兼容迭代(已经不推荐了)，无法再修改启动时间集合元素（用于稳定迭代）

- <5.2> 仍处于启动注册阶段，

-  <6> rest 重置，只有在 BeanDefinition 已经注册的情况下，再来注册才需要 rest，这里 rest 就是根据 beanName 进行清理缓存。

  

**重点还是 <5.xx> 这里是注册的部分，里面我们只看，正常注册流程就好了，迭代兼容可以作为了解！**





**我们看一下  resetBeanDefinition 重置：**

只有二次注册的时候才会进入，才需要重置，代码如下：

```java
// DefaultListableBeanFactory

protected void resetBeanDefinition(String beanName) {
    //
    // tips: 只有 BeanDefinition 二次注册的情况才会进入 rest，
    // 需要 rest 为了防止重新，注册的 BeanDefinition 有更改。

    // <1> 移除beanName 合并的 bean definition。
    // Remove the merged bean definition for the given bean, if already created.
    clearMergedBeanDefinition(beanName);

    // <2> 这里为什么需要 destroy 的动作呢? 其实是为了保障注册到cache中的一个兜底。
    // 从单例缓存中移除相应的bean（如果有的话）。
    // 通常不应该是必需的，而只是用于重写上下文的默认bean
    // （例如，StaticApplicationContext中的默认StaticMessageSource）。
    // Remove corresponding bean from singleton cache, if any. Shouldn't usually
    // be necessary, rather just meant for overriding a context's default beans
    // (e.g. the default StaticMessageSource in a StaticApplicationContext).
    destroySingleton(beanName);

    // <3> 通知所有后处理器指定的 BeanDefinition 已重置。
    // 也是根据 beanName 清楚一些缓存。
    // Notify all post-processors that the specified bean definition has been reset.
    for (BeanPostProcessor processor : getBeanPostProcessors()) {
        if (processor instanceof MergedBeanDefinitionPostProcessor) {
            ((MergedBeanDefinitionPostProcessor) processor).resetBeanDefinition(beanName);
        }
    }

    // <4> 重置 BeanDefinition 的父类（递归）。
    // Reset all bean definitions that have the given bean as parent (recursively).
    for (String bdName : this.beanDefinitionNames) {
        if (!beanName.equals(bdName)) {
            BeanDefinition bd = this.beanDefinitionMap.get(bdName);
            // Ensure bd is non-null due to potential concurrent modification
            // of the beanDefinitionMap.
            if (bd != null && beanName.equals(bd.getParentName())) {
                resetBeanDefinition(bdName);
            }
        }
    }
}
```

说明：

- <1> 移除beanName 合并的 bean definition。
- <2> 这里为什么需要 destroy 的动作呢? 其实是为了保障注册到cache中的一个兜底。
- <3> 通知所有后处理器指定的 BeanDefinition 已重置，也是根据 beanName 清楚一些缓存。
- <4> 重置 BeanDefinition 的父类（递归）。







ps：完结~