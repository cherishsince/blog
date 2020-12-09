# MyBatis-Spring 线程安全

mybatis-spring 解决 SqlSession 线程安全是通过 `TransactionSynchronizationManager` ，可以 `bindResource` 将 `SqlSessionHolder` 放入 ThreadLocal，每次获取的时候，直接 get() 就可以获取，代码如下：

```java
// TransactionSynchronizationManager
// 略...
public static void bindResource(Object key, Object value) throws IllegalStateException {
    Object actualKey = TransactionSynchronizationUtils.unwrapResourceIfNecessary(key);
    Assert.notNull(value, "Value must not be null");
    Map<Object, Object> map = resources.get();
    // set ThreadLocal Map if none found
    if (map == null) {
        map = new HashMap<>();
        resources.set(map);
    }
    Object oldValue = map.put(actualKey, value);
    // Transparently suppress a ResourceHolder that was marked as void...
    if (oldValue instanceof ResourceHolder && ((ResourceHolder) oldValue).isVoid()) {
        oldValue = null;
    }
    if (oldValue != null) {
        throw new IllegalStateException("Already value [" + oldValue + "] for key [" +
                                        actualKey + "] bound to thread [" + Thread.currentThread().getName() + "]");
    }
    if (logger.isTraceEnabled()) {
        logger.trace("Bound value [" + value + "] for key [" + actualKey + "] to thread [" +
                     Thread.currentThread().getName() + "]");
    }
}

@Nullable
private static Object doGetResource(Object actualKey) {
    Map<Object, Object> map = resources.get();
    if (map == null) {
        return null;
    }
    Object value = map.get(actualKey);
    // Transparently remove ResourceHolder that was marked as void...
    if (value instanceof ResourceHolder && ((ResourceHolder) value).isVoid()) {
        map.remove(actualKey);
        // Remove entire ThreadLocal if empty...
        if (map.isEmpty()) {
            resources.remove();
        }
        value = null;
    }
    return value;
}
// 略...
```

说明：

- `resources.get()` 就是获取当前保存 `SqlSessionHolder` ，然后再返回。
- 重点重点：这里解决的是，线程安全问题，每个线程只能拿到当前的这个 `SqlSession`，**`MyBatis` 的 `SqlSession` 不安全是应为多个线程，如果拿到用一个 SqlSession 操作(一个 SqlSession 里面只有一个 jdbc `connection`)，就会共享一个 jdbc connection，所以就会出问题。**

完结~
