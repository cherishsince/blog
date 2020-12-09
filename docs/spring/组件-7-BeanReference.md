# 组件-7-BeanRefresh

`BeanReference` 这个 `interface` 很有趣，这是 `Spring` 对 `BeanDefinition` 的解耦，一般一个 Class 依赖另一个 Class，是需要另一个 Class 对象的实例，这样就是强依赖。Spring 采用了一个很聪明的方式，采用 beanName 先作为标记，在 doGetBean 的时候才回去处理这些 Class 依赖时，会判断是不是 `BeanRefresh` 相关实现。

代码如下：

```java
// BeanReference

/**
 * 以抽象方式公开对bean名称的引用的接口。这个接口并不一定意味着对实际bean实例的引用；
 * 它只是表示对bean名称的逻辑引用。
 */
public interface BeanReference extends BeanMetadataElement {

	/**
	 * <1> 返回此引用指向的目标bean名称（从不{@code null}）
	 */
	String getBeanName();
}
```

说明：

就一个 `getBeanName()` 方法，获取的就是 `beanName`，我们看看实现类 `RuntimeBeanNameReference`、`RuntimeBeanNameReference`。



##### RuntimeBeanNameReference 

随便看一个实现类，`RuntimeBeanNameReference` 扩展了一个 `source`，这里保存的是**源对象**，不过在 xml 解析的过程，这里保存的是 `Element` 节点。

```java
// RuntimeBeanNameReference

public class RuntimeBeanNameReference implements BeanReference {

  // <1> 就是 bean的名称
	private final String beanName;
  // <2> 这里保存的是 Element
	@Nullable
	private Object source;

	// 略...
}
```







ps：完结~