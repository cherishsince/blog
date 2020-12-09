# 组件-11-ViewResolver

视图解析器 `ViewResolver` ，可以根据 **视图名** 和 **国际化**，**获得最终的 View 对象** (JSP 的时候用的比较多)。

代码如下：

```java

// ViewResolver.java

public interface ViewResolver {

	/**
     * 根据视图名和国际化，获得最终的 View 对象
	 */
	@Nullable
	View resolveViewName(String viewName, Locale locale) throws Exception;

}
```







## 类图

![类图](http://static2.iocoder.cn/images/Spring/2022-06-13/01.png)





## ContentNegotiatingViewResolver

实现 ViewResolver、Ordered、InitializingBean 接口，继承 WebApplicationObjectSupport 抽象类，基于**内容类型**来获取对应 View 的 ViewResolver 实现类。

其中，**内容类型**指的是 `"Content-Type"` 和拓展后缀。

代码如下：

```java

// ContentNegotiatingViewResolver.java

@Nullable
private ContentNegotiationManager contentNegotiationManager;
/**
 * ContentNegotiationManager 的工厂，用于创建 {@link #contentNegotiationManager} 对象
 */
private final ContentNegotiationManagerFactoryBean cnmFactoryBean = new ContentNegotiationManagerFactoryBean();

/**
 * 在找不到 View 对象时，返回 {@link #NOT_ACCEPTABLE_VIEW}
 */
private boolean useNotAcceptableStatusCode = false;

/**
 * 默认 View 数组
 */
@Nullable
private List<View> defaultViews;

/**
 * ViewResolver 数组
 */
@Nullable
private List<ViewResolver> viewResolvers;

/**
 * 顺序，优先级最高
 */
private int order = Ordered.HIGHEST_PRECEDENCE;
```

- `viewResolvers` 属性，ViewResolver 数组。对于来说，ContentNegotiatingViewResolver 会使用这些 `viewResolvers` 们，解析出所有的 View 们，然后基于**内容类型**来获取对应的 View 们。此时的 View 结果，可能是一个，可能是多个，所以需要比较获取到**最优**的 View 对象。

- `defaultViews` 属性，默认 View 数组。那么此处的默认是什么意思呢？在 `viewResolvers` 们解析出所有的 View 们的基础上，也会添加 `defaultViews` 到 View 结果中。😈 如果听起来有点绕，下面看具体的代码，会更加易懂。
- `order` 属性，顺序，优先级**最高**。



### initServletContext

代码如下：

```java

// ContentNegotiatingViewResolver.java

@Override
protected void initServletContext(ServletContext servletContext) {
    // <1> 扫描所有 ViewResolver 的 Bean 们
    Collection<ViewResolver> matchingBeans =
            BeanFactoryUtils.beansOfTypeIncludingAncestors(obtainApplicationContext(), ViewResolver.class).values();
    // <1.1> 情况一，如果 viewResolvers 为空，则将 matchingBeans 作为 viewResolvers 。
    if (this.viewResolvers == null) {
        this.viewResolvers = new ArrayList<>(matchingBeans.size());
        for (ViewResolver viewResolver : matchingBeans) {
            if (this != viewResolver) { // 排除自己
                this.viewResolvers.add(viewResolver);
            }
        }
    // <1.2> 情况二，如果 viewResolvers 非空，则和 matchingBeans 进行比对，判断哪些未进行初始化，那么需要进行初始化
    } else {
        for (int i = 0; i < this.viewResolvers.size(); i++) {
            ViewResolver vr = this.viewResolvers.get(i);
            // 已存在在 matchingBeans 中，说明已经初始化，则直接 continue
            if (matchingBeans.contains(vr)) {
                continue;
            }
            // 不存在在 matchingBeans 中，说明还未初始化，则进行初始化
            String name = vr.getClass().getName() + i;
            obtainApplicationContext().getAutowireCapableBeanFactory().initializeBean(vr, name);
        }
    }
    // <1.3> 排序 viewResolvers 数组
    AnnotationAwareOrderComparator.sort(this.viewResolvers);

    // <2> 设置 cnmFactoryBean 的 servletContext 属性
    this.cnmFactoryBean.setServletContext(servletContext);
}
```

