# 容器刷新-10-finishRefresh

`finishRefresh` 是容器完成刷新的最后一个动作，清理一些 cache，发送容器完成的通知，代码如下：

```java
// AbstractApplicationContext
protected void finishRefresh() {
	// <1> 清除上下文级别的资源缓存（例如来自扫描的ASM元数据）。
	// Clear context-level resource caches (such as ASM metadata from scanning).
	clearResourceCaches();

	// <2> 初始化 lifecycleProcessor 实例
	// Initialize lifecycle processor for this context.
	initLifecycleProcessor();

	// <2> 调用 lifecycleProcessor#onRefresh() 方法通知容器刷新
	// Propagate refresh to lifecycle processor first.
	getLifecycleProcessor().onRefresh();

	// <3> 发布最终事件，告诉refresh已经刷新完了
	// Publish the final event.
	publishEvent(new ContextRefreshedEvent(this));

	// <4> 生成当前bean，及其依赖关系的JSON快照。
	// Participate in LiveBeansView MBean, if active.
	LiveBeansView.registerApplicationContext(this);
}
```

说明：

- <1> 清除上下文级别的资源缓存（例如来自扫描的ASM元数据）。
- <2> 初始化 lifecycleProcessor 实例
- <3> 发布最终事件，告诉refresh已经刷新完了
- <4> 生成当前bean，及其依赖关系的JSON快照。



特别说明：

`LiveBeansView` 是一个对 ApplicationContext 的快照，我们看一下这个 `interface` :

```java
// LiveBeansViewMBean
public interface LiveBeansViewMBean {
	/**
	 * 生成当前bean及其依赖关系的JSON快照。
	 */
	String getSnapshotAsJson();
}
```

就一个 `getSnapshotAsJson()` 方法，返回一个 `String` 返回的就是 `JSON`，我们看一下实现：

```java
// LiveBeansView
protected String generateJson(Set<ConfigurableApplicationContext> contexts) {
	StringBuilder result = new StringBuilder("[\n");
	for (Iterator<ConfigurableApplicationContext> it = contexts.iterator(); it.hasNext();) {
		ConfigurableApplicationContext context = it.next();
		result.append("{\n\"context\": \"").append(context.getId()).append("\",\n");
		if (context.getParent() != null) {
			result.append("\"parent\": \"").append(context.getParent().getId()).append("\",\n");
		}
		else {
			result.append("\"parent\": null,\n");
		}
		result.append("\"beans\": [\n");
		ConfigurableListableBeanFactory bf = context.getBeanFactory();
		String[] beanNames = bf.getBeanDefinitionNames();
		boolean elementAppended = false;
		for (String beanName : beanNames) {
			BeanDefinition bd = bf.getBeanDefinition(beanName);
			if (isBeanEligible(beanName, bd, bf)) {
				if (elementAppended) {
					result.append(",\n");
				}
				result.append("{\n\"bean\": \"").append(beanName).append("\",\n");
				result.append("\"aliases\": ");
				appendArray(result, bf.getAliases(beanName));
				result.append(",\n");
				String scope = bd.getScope();
				if (!StringUtils.hasText(scope)) {
					scope = BeanDefinition.SCOPE_SINGLETON;
				}
				result.append("\"scope\": \"").append(scope).append("\",\n");
				Class<?> beanType = bf.getType(beanName);
				if (beanType != null) {
					result.append("\"type\": \"").append(beanType.getName()).append("\",\n");
				}
				else {
					result.append("\"type\": null,\n");
				}
				result.append("\"resource\": \"").append(getEscapedResourceDescription(bd)).append("\",\n");
				result.append("\"dependencies\": ");
				appendArray(result, bf.getDependenciesForBean(beanName));
				result.append("\n}");
				elementAppended = true;
			}
		}
		result.append("]\n");
		result.append("}");
		if (it.hasNext()) {
			result.append(",\n");
		}
	}
	result.append("]");
	return result.toString();
}
```

说明：

代码其实就可以看出来，**这里就是对特定的属性，生成对应的快照 JSON。**



ps：完结~





