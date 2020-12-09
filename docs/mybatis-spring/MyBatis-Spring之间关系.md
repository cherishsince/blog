# MyBatis-Spring 之间关系

#### SqlSessionTemplate

`SqlSessionTemplate` 是 `MyBatis-Spring` 特有的，他依赖 `SqlSessionFactory` 创建。

```java
// SqlSessionDaoSupport
public void setSqlSessionFactory(SqlSessionFactory sqlSessionFactory) {
  if (this.sqlSessionTemplate == null || sqlSessionFactory != this.sqlSessionTemplate.getSqlSessionFactory()) {
    this.sqlSessionTemplate = createSqlSessionTemplate(sqlSessionFactory);
  }
}
```

说明：

- `SqlSessionTemplate` 是在，创建 `SqlSessionFactoryBean` 时候创建。
- `SqlSessionTemplate` 继承了 `SqlSessionDaoSupport` ，在设置 `setSqlSessionFactory` 创建 teamplate。
