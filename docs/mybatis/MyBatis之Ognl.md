# Mybatis之Ognl



## Ognl 简介

**对象导航图语言**（Object Graph Navigation Language），简称**OGNL**，是应用于[Java](https://baike.baidu.com/item/Java)中的一个[开源](https://baike.baidu.com/item/开源)的表达式语言（Expression Language），它被集成在[Struts2](https://baike.baidu.com/item/Struts2)等框架中，作用是对[数据](https://baike.baidu.com/item/数据)进行访问，它拥有[类型](https://baike.baidu.com/item/类型)转换、访问[对象](https://baike.baidu.com/item/对象)[方法](https://baike.baidu.com/item/方法)、操作[集合](https://baike.baidu.com/item/集合)对象等功能。



大家在使用 xml 的时候，经常会用到 `<if>` 标签，难么我们在 `test` 里面写的 `id != null` 是怎么生效的呢？这些就是 `ongl` 表达式进行解析，代码如下：

```xml
<!--  查询根据id  -->
<select id="selectById2" resultType="cn.coget.test.mapper.UserDO" parameterType="java.lang.Long">
  SELECT * FROM `user`
  WHERE 1 = 1
  <if test="id != null">
    AND id = #{id}
  </if>
</select>
```



##### MyBatis 是怎么去使用Ognl 表达式的？

这里需要去了解一下 `SqlNode`，代码如下：

```java
public interface SqlNode {
  boolean apply(DynamicContext context);
}
```

说明：

- `SqlNode` 是用来解析sql 标签的，也就是 `<select> <insert> <delete><update>` 内的 `<where>` `<if>` 等...，这种标签; 解析的代码在 `org.apache.ibatis.scripting.xmltags` 这个 `package` 下。
- `DynamicContext` 用于包装解析的返回结果，这是利用，java引用的机制。



## 我们来尝试分析一个 `<if>` 标签

代码如下：

```java

/**
 * @author Clinton Begin
 */
public class IfSqlNode implements SqlNode {
  // 表达式计算器
  private final ExpressionEvaluator evaluator;
  // <if test="" 里面的这个属性
  private final String test;
  // SqlNode
  private final SqlNode contents;

  public IfSqlNode(SqlNode contents, String test) {
    this.test = test;
    this.contents = contents;
    this.evaluator = new ExpressionEvaluator();
  }

  @Override
  public boolean apply(DynamicContext context) {
    // 计算器去解析 test 信息，里面调用的是 ognl
    if (evaluator.evaluateBoolean(test, context.getBindings())) {
      contents.apply(context);
      return true;
    }
    return false;
  }
}
```

说明：

- 重点 `ExpressionEvaluator` 计算器，用 mybatis 用于解析 ognl 的一个桥梁。



##### `ExpressionEvaluator` 

```java
public class ExpressionEvaluator {

  public boolean evaluateBoolean(String expression, Object parameterObject) {
    // OgnlCache 是一个 MyBatis 缓存机制，避免二次解析，提高性能使用
    Object value = OgnlCache.getValue(expression, parameterObject);
    if (value instanceof Boolean) {
      return (Boolean) value;
    }
    if (value instanceof Number) {
      return new BigDecimal(String.valueOf(value)).compareTo(BigDecimal.ZERO) != 0;
    }
    return value != null;
  }
    
  // 略...
}
```

说明：

- 主要看 `OgnlCache` , 是一个 MyBatis 缓存机制，避免二次解析，提高性能使用。



##### OgnlCache

代码如下：

```java
public final class OgnlCache {
  /**
   *
   */
  private static final OgnlMemberAccess MEMBER_ACCESS = new OgnlMemberAccess();
  /**
   * class解析
   */
  private static final OgnlClassResolver CLASS_RESOLVER = new OgnlClassResolver();
  /**
   * 解析后缓存，便于第二次直接获取
   */
  private static final Map<String, Object> expressionCache = new ConcurrentHashMap<>();

  private OgnlCache() {
    // Prevent Instantiation of Static Class
  }

  public static Object getValue(String expression, Object root) {
    try {
      // tip: root 是 OgnlContext 转换返回，不是就创建一个 OgnlContext
      Map context = Ognl.createDefaultContext(root, MEMBER_ACCESS, CLASS_RESOLVER, null);
      // 解析表达式 并 获取value
      return Ognl.getValue(parseExpression(expression), context, root);
    } catch (OgnlException e) {
      throw new BuilderException("Error evaluating expression '" + expression + "'. Cause: " + e, e);
    }
  }

  private static Object parseExpression(String expression) throws OgnlException {
    // tip: 先从cache中获取，没有再去解析表达式
    // tip: 如 data.id，有可能是对象里面的id，也有可能是 keyMap 的key
    Object node = expressionCache.get(expression);
    if (node == null) {
      // 解析 expression 表达式
      node = Ognl.parseExpression(expression);
      // 解析的 cache，避免下一次再次解析
      expressionCache.put(expression, node);
    }
    return node;
  }
}

```

说明：

- `expressionCache` 是一个 map，用于缓存已经解析过的 **表达式**。
- `parseExpression` 方法，里面可以看到 `Ognl.parseExpression(expression)` 调用 ognl 进行解析，解析完成后放入 `expressionCache`。



> MyBaits 使用 Ognl 表达式，分析完成~



##### 补充：那怎么去调用到 IfSqlNode 呢？

```java
// XMLScriptBuilder
protected MixedSqlNode parseDynamicTags(XNode node) {
  List<SqlNode> contents = new ArrayList<>();
  NodeList children = node.getNode().getChildNodes();
  for (int i = 0; i < children.getLength(); i++) {
    XNode child = node.newXNode(children.item(i));
    if (child.getNode().getNodeType() == Node.CDATA_SECTION_NODE || child.getNode().getNodeType() == Node.TEXT_NODE) {
      String data = child.getStringBody("");
      TextSqlNode textSqlNode = new TextSqlNode(data);
      if (textSqlNode.isDynamic()) {
        contents.add(textSqlNode);
        isDynamic = true;
      } else {
        contents.add(new StaticTextSqlNode(data));
      }
    } else if (child.getNode().getNodeType() == Node.ELEMENT_NODE) { // issue #628
      String nodeName = child.getNode().getNodeName();
      // 是所有node处理器，如: if where 等...
      NodeHandler handler = nodeHandlerMap.get(nodeName);
      if (handler == null) {
        throw new BuilderException("Unknown element <" + nodeName + "> in SQL statement.");
      }
      // 调用对应的 handler 处理
      handler.handleNode(child, contents);
      isDynamic = true;
    }
  }
  return new MixedSqlNode(contents);
}
```

说明：

- SqlNode 在 MyBatis 里面，成为 `Script` ，由 `XMLScriptBuilder` 进行构建和调用。
- `nodeHandlerMap` 注册了很多 node 处理器，如：if、where 等...



## 彩蛋



1. MyBatis 是怎么调用 Ognl 表达式的？
2. MyBatis  使用 Ognl 有缓存机制吗？
