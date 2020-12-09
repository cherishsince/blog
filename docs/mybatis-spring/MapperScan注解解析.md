# MapperScan 注解解析

想使用 `@MapperScan` 来注册 `mapper` ，需要先开启 **spring 注解功能** ，代码如下:

```java
@Configuration
@MapperScan(basePackages = "cn.coget.test.base.mapper")
public class MyBatisScanConfig {
}
```

开启 spring 注解功能：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xmlns:mybatis="http://mybatis.org/schema/mybatis-spring"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:jdbc="http://www.springframework.org/schema/jdbc"
       xsi:schemaLocation="
     http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
     http://www.springframework.org/schema/tx http://www.springframework.org/schema/tx/spring-tx.xsd
     http://mybatis.org/schema/mybatis-spring http://mybatis.org/schema/mybatis-spring.xsd
     http://www.springframework.org/schema/context https://www.springframework.org/schema/context/spring-context.xsd
     http://www.springframework.org/schema/jdbc http://www.springframework.org/schema/jdbc/spring-jdbc.xsd">

  <bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource">
    <property name="driverClassName" value="com.mysql.jdbc.Driver"></property>
    <property name="url" value="jdbc:mysql://120.78.218.163:3306/storm_sports"></property>
    <property name="username" value="root"></property>
    <property name="password" value="@D23d7a3df91cc42"></property>
  </bean>

  <bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
    <property name="dataSource" ref="dataSource"/>
  </bean>

  <!--  开启spring注解功能  -->
  <context:component-scan base-package="cn.coget.test" />
</beans>

```

说明：

- 开启 spring 注解功能后，mybatis 的注解才生效。

##### @MapperScan 注解是怎么解析 mapper 的

```java
// MapperScannerRegistrar
public class MapperScannerRegistrar implements ImportBeanDefinitionRegistrar, ResourceLoaderAware {
// 略...

  @Override
  public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
    // importingClassMetadata 就是 @Import 标签，将属性合并
    AnnotationAttributes mapperScanAttrs = AnnotationAttributes
        .fromMap(importingClassMetadata.getAnnotationAttributes(MapperScan.class.getName()));
    // registerBeanDefinitions 就是注册 beanDefinition
    // 获取注解信息，配置 MapperScannerConfigurer 生产 beanDefinition(和 xml没有啥区别)
    if (mapperScanAttrs != null) {
      registerBeanDefinitions(importingClassMetadata, mapperScanAttrs, registry,
          generateBaseBeanName(importingClassMetadata, 0));
    }
  }

// 略...
}
```

说明：

- ImportBeanDefinitionRegistrar 提供了，注册 BeanDefinition 功能，用户扩展，很多框架都采用这种方式来注册自己。
- registerBeanDefinitions 解析注解属性，注册 beanDefinition。

##### mapper 注册解析

@MapperScan 注解解析了，还只是获得了一些配置信息，这个时候 mapper 还没注册，mapper 通过 spring 的 `ClassPathBeanDefinitionScanner` 来进行扫描的，mybatis 是实现 `BeanDefinitionRegistryPostProcessor` 来进行注册的，代码如下：

```java
// MapperScannerConfigurer
@Override
public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
  if (this.processPropertyPlaceHolders) {
    processPropertyPlaceHolders();
  }
  // 创建 ClassPathMapperScanner 扫描 mapper
  ClassPathMapperScanner scanner = new ClassPathMapperScanner(registry);
  scanner.setAddToConfig(this.addToConfig);
  scanner.setAnnotationClass(this.annotationClass);
  scanner.setMarkerInterface(this.markerInterface);
  scanner.setSqlSessionFactory(this.sqlSessionFactory);
  scanner.setSqlSessionTemplate(this.sqlSessionTemplate);
  scanner.setSqlSessionFactoryBeanName(this.sqlSessionFactoryBeanName);
  scanner.setSqlSessionTemplateBeanName(this.sqlSessionTemplateBeanName);
  scanner.setResourceLoader(this.applicationContext);
  scanner.setBeanNameGenerator(this.nameGenerator);
  scanner.setMapperFactoryBeanClass(this.mapperFactoryBeanClass);
  if (StringUtils.hasText(lazyInitialization)) {
    scanner.setLazyInitialization(Boolean.valueOf(lazyInitialization));
  }
  if (StringUtils.hasText(defaultScope)) {
    scanner.setDefaultScope(defaultScope);
  }
  // 调用过滤器
  scanner.registerFilters();
  // 扫描 package
  scanner.scan(
      StringUtils.tokenizeToStringArray(this.basePackage, ConfigurableApplicationContext.CONFIG_LOCATION_DELIMITERS));
}
```

说明：

- 实现了 `BeanDefinitionRegistryPostProcessor` ，这里调用了 `scanner` 扫描器，进行扫描 `package` 下的 mapper。
- 调用 `scanner.scan` 扫描并注册，因为 `ClassPathBeanDefinitionScanner` 自带注册 `BeanDefinition` 。

完结~
