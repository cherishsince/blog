# 组件-PropertyResolver

`PropertyResolver` 是一个 **解析属性** 的组件，在很多地方都有用到，如下：

```java

// class 类中
@Value("${spring.application.name}")
private String appcationName;

```

已经知道 `PropertyResolver` 拿来干嘛的呢，咱们就去分析他 ❀;

> 注意注意注意：这里经此只解析 `class` 属性使用，像 yml 和 xml 这种 \${} 不是他的职责！！！

### 概要

`PropertyResolver` 他就一个实现类(`PropertySourcesPropertyResolver`) 功能也很简单，就是创建我的时候给一个 `PropertySources`(他提供了属性编辑功能)，**那么你调用我的 `resolvePlaceholders()` 方法的时候就去找对应的属性，然后返回**。

> 加粗的部分就是它主要的职责！！！

###### 梳理一下：

1. 创建 `PropertyResolver` 给我一个 `PropertySources`
2. `getProperty()` 返回的是具体的 `value`
   1. `resolvePlaceholders()` 解析对应的 `value`
      1. 解析 `${xx}` (就是 `String` 的一些操作)
      2. 去 `PropertySources` 找到对应的 `value`（`PropertySources` 就是一个`map`）
   2. 通过 `ConversionService` (spring3.0 后出来的，用于替换 `PropertyEdit`)转换 value 类型(因为`resolever` 返回的都是 `String`)

> 先忽略一些细节比如：`ConversionService` 这种会有装门的文字讲解

### 开始分析

看一下关系图：

`![758d1f7d730e2987d631d830c3ea17da.png](en-resource://database/881:1)`

- `AbstractPropertyResolver` 是一个默认的实现，也是通用的实现(如果先扩展 `extends` 他就好了)。

- `PropertySourcesPropertyResolver` 就是他唯一能用的子类。

#### PropertyResolver

```java


// 是否包含某个属性
boolean containsProperty(String key);

// 获取属性值 如果找不到返回null
@Nullable
String getProperty(String key);

// 获取属性值，如果找不到返回默认值
String getProperty(String key, String defaultValue);

// 获取指定类型的属性值，找不到返回null
@Nullable
<T> T getProperty(String key, Class<T> targetType);

// 获取指定类型的属性值，找不到返回默认值
<T> T getProperty(String key, Class<T> targetType, T defaultValue);

// 获取属性值，找不到抛出异常IllegalStateException
String getRequiredProperty(String key) throws IllegalStateException;

// 获取指定类型的属性值，找不到抛出异常IllegalStateException
<T> T getRequiredProperty(String key, Class<T> targetType) throws
IllegalStateException;

// 替换文本中的占位符（${key}）到属性值，找不到不解析
String resolvePlaceholders(String text);

// 替换文本中的占位符（${key}）到属性值，找不到抛出异常IllegalArgumentException
String resolveRequiredPlaceholders(String text) throws IllegalArgumentException;

```

主要功能就两个：获取、和解析

- 获取：就是根据属性名获取 `value`值，不过 `getProperty()` 会存在解析的过程，那么就会调用自己的解析。
- 解析：检查 value 中是否存在**表达式** (就是`${}`) ，**存在就调用 `PropertyPlaceholderHelp` 这个类来进行处理，返回的是 String 的 value**

> `PropertyPlaceholderHelp` 是一个工具类，用于解析占位符，就是对 \${} 进行截取然后，返回 `value`
