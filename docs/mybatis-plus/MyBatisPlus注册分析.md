# MyBatisPlus 注册分析

`MyBatis-Plus` 整合 spring 是和 `MyBatis-Spring` 是差不多的，MyBatis-Plus 其实很多都是复制 `MyBatis-Spring`的，只是在其中做了一些自定义的修改。

```java
/**
 * 拷贝类 {@link SqlSessionFactoryBean} 修改方法 buildSqlSessionFactory() 加载自定义
 * <p> MybatisXmlConfigBuilder </p>
 * <p> 移除 sqlSessionFactoryBuilder 属性,强制使用 `new MybatisSqlSessionFactoryBuilder()` </p>
 * <p> 移除 environment 属性,强制使用 `MybatisSqlSessionFactoryBean.class.getSimpleName()` </p>
 *
 * @author hubin
 * @since 2017-01-04
 */
public class MybatisSqlSessionFactoryBean implements FactoryBean<SqlSessionFactory>, InitializingBean, ApplicationListener<ApplicationEvent> {
}
```

说明：

- 这是 `MyBatis-Plus` 源码注释说明，这些基本就很清晰了。
- 无谓就是修改一些 `Configuation` 配置，使用自己的配置。

> 比较简单，有看过 MyBatis-Spring 的基本可以忽略了。

完结~
