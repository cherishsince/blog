# mybatis-scan 标签解析

`<mybatis:scan>` 注解，属于 spring 非核心标签，都会采用自定义标签处理，和 spring mvc 一样；spring 自定义标签，解析需要实现 `AbstractBeanDefinitionParser` 解析器，然后通过`NamespaceHandlerSupport` 注册解析的标签；

代码如下：

```xml
// applicationContext.xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:mybatis="http://mybatis.org/schema/mybatis-spring"
       xmlns:jdbc="http://www.springframework.org/schema/jdbc"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd

     http://mybatis.org/schema/mybatis-spring http://mybatis.org/schema/mybatis-spring.xsd
     http://www.springframework.org/schema/jdbc http://www.springframework.org/schema/jdbc/spring-jdbc.xsd">

  <bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource">
    <property name="driverClassName" value="com.mysql.jdbc.Driver"></property>
    <property name="url" value="jdbc:mysql://120.78.218.163:3306/storm_sports"></property>
    <property name="username" value="root"></property>
    <property name="password" value="@D23d7a3df91cc42"></property>
  </bean>

  <bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
    <property name="dataSource" ref="dataSource" />
  </bean>

  <mybatis:scan base-package="cn.coget.test.base.mapper" />
</beans>
```

说明：

- 我们在 `applicationContext.xml` 配置了，`<mybatis:scan>` 扫描 mapper，需要注意的是需要导入 `xmlns:mybatis="http://mybatis.org/schema/mybatis-spring"` 命名空间和.xsd 标签规范，**不添加 spring 在校验 xml 的时候会不通过！！！**

##### MapperScannerBeanDefinitionParser

xml 解析器，代码如下：

```java
public class MapperScannerBeanDefinitionParser extends AbstractBeanDefinitionParser {

  // 略...

  @Override
  protected AbstractBeanDefinition parseInternal(Element element, ParserContext parserContext) {
    // 这里是配置 MapperScannerConfigurer(通过 BeanDefinitionBuilder 生产)
    BeanDefinitionBuilder builder = BeanDefinitionBuilder.genericBeanDefinition(MapperScannerConfigurer.class);
    // 获取spring默认的类加载器
    ClassLoader classLoader = ClassUtils.getDefaultClassLoader();
    // 开启属性占位符
    builder.addPropertyValue("processPropertyPlaceHolders", true);
    try {
      // 获取 annotation 属性
      String annotationClassName = element.getAttribute(ATTRIBUTE_ANNOTATION);
      if (StringUtils.hasText(annotationClassName)) {
        // 存在的话，去加载并设置到 annotationClass
        @SuppressWarnings("unchecked")
        Class<? extends Annotation> annotationClass = (Class<? extends Annotation>) classLoader
          .loadClass(annotationClassName);
        builder.addPropertyValue("annotationClass", annotationClass);
      }
      // marker-interface
      String markerInterfaceClassName = element.getAttribute(ATTRIBUTE_MARKER_INTERFACE);
      if (StringUtils.hasText(markerInterfaceClassName)) {
        Class<?> markerInterface = classLoader.loadClass(markerInterfaceClassName);
        builder.addPropertyValue("markerInterface", markerInterface);
      }
      // name-generator
      String nameGeneratorClassName = element.getAttribute(ATTRIBUTE_NAME_GENERATOR);
      if (StringUtils.hasText(nameGeneratorClassName)) {
        Class<?> nameGeneratorClass = classLoader.loadClass(nameGeneratorClassName);
        BeanNameGenerator nameGenerator = BeanUtils.instantiateClass(nameGeneratorClass, BeanNameGenerator.class);
        builder.addPropertyValue("nameGenerator", nameGenerator);
      }
      // mapper-factory-bean-class
      String mapperFactoryBeanClassName = element.getAttribute(ATTRIBUTE_MAPPER_FACTORY_BEAN_CLASS);
      if (StringUtils.hasText(mapperFactoryBeanClassName)) {
        @SuppressWarnings("unchecked")
        Class<? extends MapperFactoryBean> mapperFactoryBeanClass = (Class<? extends MapperFactoryBean>) classLoader
          .loadClass(mapperFactoryBeanClassName);
        builder.addPropertyValue("mapperFactoryBeanClass", mapperFactoryBeanClass);
      }
    } catch (Exception ex) {
      XmlReaderContext readerContext = parserContext.getReaderContext();
      readerContext.error(ex.getMessage(), readerContext.extractSource(element), ex.getCause());
    }
    // 获取 <mybatis:scan> 标签属性，并设置到 BeanDefinition
    builder.addPropertyValue("sqlSessionTemplateBeanName", element.getAttribute(ATTRIBUTE_TEMPLATE_REF));
    builder.addPropertyValue("sqlSessionFactoryBeanName", element.getAttribute(ATTRIBUTE_FACTORY_REF));
    builder.addPropertyValue("lazyInitialization", element.getAttribute(ATTRIBUTE_LAZY_INITIALIZATION));
    builder.addPropertyValue("defaultScope", element.getAttribute(ATTRIBUTE_DEFAULT_SCOPE));
    builder.addPropertyValue("basePackage", element.getAttribute(ATTRIBUTE_BASE_PACKAGE));
    // 构建出一个 MapperScannerConfigurer BeanDefinition
    return builder.getBeanDefinition();
  }

   // 略...
}
```

说明：

- `AbstractBeanDefinitionParser` 是 spring 用于解析，自定义扩展标签，
- `parseInternal` 是有，内部调用，进行解析，解析完后或得一个 `BeanDefinition` ,
- `AbstractBeanDefinitionParser` 内部会自动注册 `BeanDefinition` 所以我们解析玩返回后，会自动注册

##### NamespaceHandler

有了解析器，还需要去注册，解析器，代码如下：

```java
public class NamespaceHandler extends NamespaceHandlerSupport {

  @Override
  public void init() {
    registerBeanDefinitionParser("scan", new MapperScannerBeanDefinitionParser());
  }
}
```

说明：

- spring 是通过 NamespaceHandlerSupport 来注册，解析器。
- spring 在解析自定义标签的时候，会检查解析器，然后进行解析。

完结~
