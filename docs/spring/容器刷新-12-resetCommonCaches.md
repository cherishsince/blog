# 容器刷新-12-resetCommonCaches

重置我们的cache，刷新完了，就把一些没用的 cache，清理掉节省空间，代码如下：

```java
// AbstractApplicationContext
protected void resetCommonCaches() {
	// <1> 清理一下缓存
	ReflectionUtils.clearCache();
	AnnotationUtils.clearCache();
	ResolvableType.clearCache();
	CachedIntrospectionResults.clearClassLoader(getClassLoader());
}
```

######  方法分析-ReflectionUtils.clearCache()

```java
// ReflectionUtils
public static void clearCache() {
  // <1> 清理 method 和 fields 缓存
  declaredMethodsCache.clear();
  declaredFieldsCache.clear();
}
```

###### 方法分析-AnnotationUtils.clearCache()

```java
// AnnotationUtils
public static void clearCache() {
  // <1> 清理 Annotation 类型的映射缓存
  AnnotationTypeMappings.clearCache();
  // <2> 清理 Annotations 扫描的缓存
  AnnotationsScanner.clearCache();
}
```

###### 方法分析-ResolvableType.clearCache()

```java
// ResolvableType
public static void clearCache() {
  // <1> ResolvableType 是对反射的 type 扩展，cache 是扫描后的功能，所以需要清理
  cache.clear();
  SerializableTypeWrapper.cache.clear();
}
```



ps：完结~