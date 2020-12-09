# MyBatis-Spring 基础知识

**MyBatis-Spring** 这个项目用于，MyBatis 和 Spring 的融合，将 MyBatis 的 Mapper 交给 Spring 容器管理。

整合 Spring 需要一下几步：

##### 第一步：SqlSessionFactory

```xml
<bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
  <property name="dataSource" ref="dataSource" />
</bean>
```

##### 第二步：加载 mapper

```xml
// 配置单个
<bean id="userMapper" class="org.mybatis.spring.mapper.MapperFactoryBean">
  <property name="mapperInterface" value="org.mybatis.spring.sample.mapper.UserMapper" />
  <property name="sqlSessionFactory" ref="sqlSessionFactory" />
</bean>
// 一次行配置多个
<mybatis:scan base-package="org.mybatis.spring.sample.mapper" />
```

##### 第三部：配置事物

```java
<bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
  <property name="dataSource" ref="dataSource" />
  <property name="transactionFactory">
    <bean class="org.apache.ibatis.transaction.managed.ManagedTransactionFactory" />
  </property>
</bean>
```

完成以上几步，就可以采用 @Autowired 注解开始注入 Mapper 了。

完结~
