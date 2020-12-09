# MyBatisPlus 怎么 Sql 模板

`MyBatisPlus` 向 `BaseMapper` 里面的方法，是怎么实现的？

##### SqlMethod 枚举

`SqlMethod` 里面定义了很多 sql 模板，

```java
// SqlMethod
// 略...

/**
 * 插入
 */
INSERT_ONE("insert", "插入一条数据（选择字段插入）", "<script>\nINSERT INTO %s %s VALUES %s\n</script>"),
UPSERT_ONE("upsert", "Phoenix插入一条数据（选择字段插入）", "<script>\nUPSERT INTO %s %s VALUES %s\n</script>"),

/**
 * 查询
 */
SELECT_BY_ID("selectById", "根据ID 查询一条数据", "SELECT %s FROM %s WHERE %s=#{%s} %s"),
SELECT_BY_MAP("selectByMap", "根据columnMap 查询一条数据", "<script>SELECT %s FROM %s %s\n</script>"),
SELECT_BATCH_BY_IDS("selectBatchIds", "根据ID集合，批量查询数据", "<script>SELECT %s FROM %s WHERE %s IN (%s) %s</script>"),
SELECT_ONE("selectOne", "查询满足条件一条数据", "<script>%s SELECT %s FROM %s %s %s\n</script>"),

// 略...
```

##### ISqlInjector 注入器

官方说明：https://baomidou.com/guide/sql-injector.html

代码如下：

```java
/**
 * SQL 自动注入器接口
 *
 * @author hubin
 * @since 2016-07-24
 */
public interface ISqlInjector {

    /**
     * 检查SQL是否注入(已经注入过不再注入)
     *
     * @param builderAssistant mapper 信息
     * @param mapperClass      mapper 接口的 class 对象
     */
    void inspectInject(MapperBuilderAssistant builderAssistant, Class<?> mapperClass);
}
```

说明：

- `MapperBuilderAssistant` 用于构建 `Mapper` ，里面提供了一些工具，

- `BaseMapper` 注入是在 `DefaultSqlInjector`

  ```java
  public class DefaultSqlInjector extends AbstractSqlInjector {

      @Override
      public List<AbstractMethod> getMethodList(Class<?> mapperClass) {
          return Stream.of(
              new Insert(),
              new Delete(),
              new DeleteByMap(),
              new DeleteById(),
              new DeleteBatchByIds(),
              new Update(),
              new UpdateById(),
              new SelectById(),
              new SelectBatchByIds(),
              new SelectByMap(),
              new SelectOne(),
              new SelectCount(),
              new SelectMaps(),
              new SelectMapsPage(),
              new SelectObjs(),
              new SelectList(),
              new SelectPage()
          ).collect(toList());
      }
  }
  ```

##### 注入器在什么时候调用的

```java
// MybatisMapperAnnotationBuilder
// 略...
if (GlobalConfigUtils.isSupperMapperChildren(configuration, type)) {
    // 从 GlobalConfig 获取配置的注入器，然后注入
    parserInjector();
}
void parserInjector() {
    GlobalConfigUtils.getSqlInjector(configuration).inspectInject(assistant, type);
}
// 略...
```

说明：

- `parserInjector` 解析注入器，然后 **调用注入器进行注入** 。

完结~
