# TypeHandler分析



`TypeHandler` 是用于 **类型处理**，**ORM 框架的一大核心，处理 jdbc 和 编程语言之间的类型转换**，`TypeHandler`  处理两部分数据；

- 第一部分：通过 `mapper` 操作数据库，编程语言类型，转数据库类型。
- 第二部分：查询后返回的数据库类型，转换为编程语言类型。



##### TypeHandler接口

```java

/**
 * 类型处理
 *
 * @author Clinton Begin
 */
public interface TypeHandler<T> {

  /**
   * 设置 PreparedStatement 的指定参数
   *
   * Java Type => JDBC Type
   *
   * @param ps PreparedStatement 对象
   * @param i 参数占位符的位置
   * @param parameter 参数
   * @param jdbcType JDBC 类型
   * @throws SQLException 当发生 SQL 异常时
   */
  void setParameter(PreparedStatement ps, int i, T parameter, JdbcType jdbcType) throws SQLException;

  /**
   * 获得 ResultSet 的指定字段的值
   *
   * JDBC Type => Java Type
   *
   * @param rs ResultSet 对象
   * @param columnName 字段名
   * @return 值
   * @throws SQLException 当发生 SQL 异常时
   */
  T getResult(ResultSet rs, String columnName) throws SQLException;

  /**
   * 获得 ResultSet 的指定字段的值
   *
   * JDBC Type => Java Type
   *
   * @param rs ResultSet 对象
   * @param columnIndex 字段位置
   * @return 值
   * @throws SQLException 当发生 SQL 异常时
   */
  T getResult(ResultSet rs, int columnIndex) throws SQLException;

  /**
   * 获得 CallableStatement 的指定字段的值
   *
   * JDBC Type => Java Type
   *
   * @param cs CallableStatement 对象，支持调用存储过程
   * @param columnIndex 字段位置
   * @return 值
   * @throws SQLException
   */
  T getResult(CallableStatement cs, int columnIndex) throws SQLException;
}
```

说明：

- 定义了，Statement 怎么去设置参数，和 Statement怎么去获取参数。
- 还有 `CallableStatement` 用于存储过程的处理方式。
- TypeHandler默认扩展了Java所有基础类型(BooleanTypeHandler、LongTypeHandler 等)。





完结~





## 彩蛋

1. TypeHandler 是用来做什么的？
2. TypeHandler 默认扩展了，哪些类型处理器？