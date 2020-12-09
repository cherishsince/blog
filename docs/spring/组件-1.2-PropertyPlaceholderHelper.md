# 组件解析-PropertyPlaceholderHelper

这个类的功能，和字面意思一样哈，用于 `解析属性的占位符`，`Spring` 解析 `${xxx}` 全靠它了，一个比较关键的部分，也是一个很独立，可以单独使用的一个 `class`。


##### 构造器

咱们看一下他的构造器，相信大家就能理解了~

```java

// PropertyPlaceholderHelper

public PropertyPlaceholderHelper(String placeholderPrefix, String placeholderSuffix) {      
     this(placeholderPrefix, placeholderSuffix, null, true);
}

```

是不是想到点什么？和你想的一样，`${ }` 咱们可以差分为 `${` 和 `}` 两个部分，它实际代码也是这样的。

```java

// PropertyPlaceholderHelperTests

private final PropertyPlaceholderHelper helper = new PropertyPlaceholderHelper("${", "}");

```
甚至我们还可以自定义，`#{}`、`##`、`{}` 都可以，后面如果我们有需要用到自定义的解析器，就不用自己写了，直接 `new PropertyPlaceholderHelper()`；

#### 他是怎么工作的呢？

给大家贴一段代码，这就是他的核心代码，简单的就是字符串的一些处理~

```java
	protected String parseStringValue(
			String value, PlaceholderResolver placeholderResolver, @Nullable Set<String> visitedPlaceholders) {

		// tops: placeholderPrefix 时构造的时候传入的，我们已 ${} 距离

		// 获取 ${ 占位符
		int startIndex = value.indexOf(this.placeholderPrefix);
		if (startIndex == -1) {
			return value;
		}

		// 解析的 value 值
		StringBuilder result = new StringBuilder(value);
		while (startIndex != -1) {
			// 在 startIndex 上查找， } 结束符
			int endIndex = findPlaceholderEndIndex(result, startIndex);
			// 找到了，就进来
			if (endIndex != -1) {
				// 截取 ${} 占位符的内容
				String placeholder = result.substring(startIndex + this.placeholderPrefix.length(), endIndex);
				// 原本的占位符
				String originalPlaceholder = placeholder;
				if (visitedPlaceholders == null) {
					visitedPlaceholders = new HashSet<>(4);
				}
				if (!visitedPlaceholders.add(originalPlaceholder)) {
					throw new IllegalArgumentException(
							"Circular placeholder reference '" + originalPlaceholder + "' in property definitions");
				}
				// 递归接续解析，如果解析 ${ 返回 -1 这里，返回的就是 placeholder 占位符
				// tips: 如果只有一级 ${} 那么会返回 placeholder
				// Recursive invocation, parsing placeholders contained in the placeholder key.
				placeholder = parseStringValue(placeholder, placeholderResolver, visitedPlaceholders);
				// 获取 placeholder 对应的 value
				// Now obtain the value for the fully resolved key...
				String propVal = placeholderResolver.resolvePlaceholder(placeholder);
				// properties 没解析到，进入
				if (propVal == null && this.valueSeparator != null) {
					int separatorIndex = placeholder.indexOf(this.valueSeparator);
					if (separatorIndex != -1) {
						String actualPlaceholder = placeholder.substring(0, separatorIndex);
						String defaultValue = placeholder.substring(separatorIndex + this.valueSeparator.length());
						propVal = placeholderResolver.resolvePlaceholder(actualPlaceholder);
						if (propVal == null) {
							propVal = defaultValue;
						}
					}
				}
				// properties 解析到了，进入
				if (propVal != null) {
					// tips：这里继续递归，场景是，从 properties 里面解析到的值，还存在 placeholder 占位符情况
					// Recursive invocation, parsing placeholders contained in the
					// previously resolved placeholder value.
					propVal = parseStringValue(propVal, placeholderResolver, visitedPlaceholders);
					// 开始替换结果 ${} 替换为对应的 value
					result.replace(startIndex, endIndex + this.placeholderSuffix.length(), propVal);
					if (logger.isTraceEnabled()) {
						logger.trace("Resolved placeholder '" + placeholder + "'");
					}
					// tips: 这里是为了 while == -1 退出条件, 所以在此检查 ${ 开始符号
					startIndex = result.indexOf(this.placeholderPrefix, startIndex + propVal.length());
				} else if (this.ignoreUnresolvablePlaceholders) {
					// Proceed with unprocessed value.
					startIndex = result.indexOf(this.placeholderPrefix, endIndex + this.placeholderSuffix.length());
				} else {
					throw new IllegalArgumentException("Could not resolve placeholder '" +
							placeholder + "'" + " in value \"" + value + "\"");
				}
				visitedPlaceholders.remove(originalPlaceholder);
			} else {
				startIndex = -1;
			}
		}
		return result.toString();
	}

```



说明：

- 解析 `value `中是否存在 `${}` 存在就开始 submit 截取

- 然后通过 `PlaceholderResolver.resolvePlaceholder()` 解析出对应的 `value ` 值

- 还没完，这里有一层 **递归** ，就是再次检查 `value` 是否存在 `${} `，存在递归调用

  

####  PlaceholderResolver

```java
		// SystemPropertyUtils

		private static class SystemPropertyPlaceholderResolver implements PropertyPlaceholderHelper.PlaceholderResolver {

		private final String text;

		public SystemPropertyPlaceholderResolver(String text) {
			this.text = text;
		}

		@Override
		@Nullable
		public String resolvePlaceholder(String placeholderName) {
			try {
				String propVal = System.getProperty(placeholderName);
				if (propVal == null) {
					// Fall back to searching the system environment.
					propVal = System.getenv(placeholderName);
				}
				return propVal;
			}
			catch (Throwable ex) {
				System.err.println("Could not resolve placeholder '" + placeholderName + "' in [" +
						this.text + "] as system property: " + ex);
				return null;
			}
		}
	}

```



-  `PlaceholderResolver.resolvePlaceholder()` 就是获取 `properties` 属性的 key 获取 value 值然后就返回了~



ps：完结~