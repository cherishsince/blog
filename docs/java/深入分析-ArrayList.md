# 深入分析-ArrayList



### 知识：

- 扩容：每次扩容是1.5倍(如10 规则 =10 + (10 >> 1))

- modCount 记录修改次数
- contains() 调用的是 indexOf()



### 怎么扩容？

```java
// 调用 grow 进行扩容
private void grow(int minCapacity) {
  // overflow-conscious code
  int oldCapacity = elementData.length;
  int newCapacity = oldCapacity + (oldCapacity >> 1);
  if (newCapacity - minCapacity < 0)
    newCapacity = minCapacity;
  if (newCapacity - MAX_ARRAY_SIZE > 0)
    newCapacity = hugeCapacity(minCapacity);
  // minCapacity is usually close to size, so this is a win:
  elementData = Arrays.copyOf(elementData, newCapacity);
}

```

- 扩容是1.5倍
- 最大容量是 Integer.MAX_VALUE
- 采用 Arrays.copyOf 扩容，底层调用的是 System.arraycopy





