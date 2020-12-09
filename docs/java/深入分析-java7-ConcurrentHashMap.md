# 深入分析-java7-ConcurrentHashMap



知识：

- Segments: 最大容量 1 << 16
- HashEntry[]：数组最大容量 1 << 30 (和HashMap一样)
- value：不能为空
- 存储结构：分段锁，Segment继承了 ReentrantLock 
- new ConcurrentHashMap: 默认会初始化一个空的 Segment
- Segment 内的 HashEntry<k, v>[] 最小是 2 个
- 在扩容中，这 Segment 里面的数据不能操作（可以读取）。



### 怎么扩容的

```java
// ConcurrentHashMap.class
private void rehash(HashEntry<K,V> node) {
  HashEntry<K,V>[] oldTable = table;
  // 旧的长度
  int oldCapacity = oldTable.length;
  // 扩容一倍
  int newCapacity = oldCapacity << 1;
  threshold = (int)(newCapacity * loadFactor);
  // 创建新的table
  HashEntry<K,V>[] newTable =
    (HashEntry<K,V>[]) new HashEntry[newCapacity];
  int sizeMask = newCapacity - 1;
  for (int i = 0; i < oldCapacity ; i++) {
    HashEntry<K,V> e = oldTable[i];
    if (e != null) {
      HashEntry<K,V> next = e.next;
      int idx = e.hash & sizeMask;
      if (next == null)   //  Single node on list
        newTable[idx] = e;
      else { // Reuse consecutive sequence at same slot
        HashEntry<K,V> lastRun = e;
        int lastIdx = idx;
        // <1> 不知道为什么，获取 lastNode 然后，计算lastNode在newTable未知，然后设置进去
        for (HashEntry<K,V> last = next;
             last != null;
             last = last.next) {
          int k = last.hash & sizeMask;
          if (k != lastIdx) {
            lastIdx = k;
            lastRun = last;
          }
        }
        newTable[lastIdx] = lastRun;
        // <2> 这个for是头插法，会将 node 的每个节点重新计算 index 下表，然后再设置到 newTable
        // Clone remaining nodes
        for (HashEntry<K,V> p = e; p != lastRun; p = p.next) {
          V v = p.value;
          int h = p.hash;
          int k = h & sizeMask;
          HashEntry<K,V> n = newTable[k];
          newTable[k] = new HashEntry<K,V>(h, p.key, v, n);
        }
      }
    }
  }
  int nodeIndex = node.hash & sizeMask; // add the new node
  node.setNext(newTable[nodeIndex]);
  newTable[nodeIndex] = node;
  table = newTable;
}

```

- **扩容修改的是 Segment 内部的 HashEntry<k, v>[]，不会改变 Segment 大小。**
- 每个 HashEntry 都有加载因子，达到是出发调用这个方法。
- 在扩容中，这 Segment 里面的数据不能操作（可以读取）。
- 扩容采用，头插法 并会将每个 node 重新计算 newTable 未知然后设置进去。



### 怎么获取Lock的

```java
// ConcurrentHashMap.class
private HashEntry<K,V> scanAndLockForPut(K key, int hash, V value) {
  HashEntry<K,V> first = entryForHash(this, hash);
  HashEntry<K,V> e = first;
  HashEntry<K,V> node = null;
  int retries = -1; // negative while locating node
  // <1> 尝试加锁
  while (!tryLock()) {
    HashEntry<K,V> f; // to recheck first below
    // <2> 获取 node 最后一个元素
    if (retries < 0) {
      if (e == null) {
        if (node == null) // speculatively create node
          node = new HashEntry<K,V>(hash, key, value, null);
        retries = 0;
      }
      else if (key.equals(e.key))
        retries = 0;
      else
        e = e.next;
    }
    // <3> 最大 tryLock 次数
    else if (++retries > MAX_SCAN_RETRIES) {
      lock();
      break;
    }
    // <4> node 变更，再次检查
    else if ((retries & 1) == 0 &&
             (f = entryForHash(this, hash)) != first) {
      e = first = f; // re-traverse if entry changed
      retries = -1;
    }
  }
  return node;
}
```

- Segment 继承了 ReentrantLock 所以在调用 tryLock() 的时候，这一段已经被锁住了；
- <1> 其他线程循环 tryLock()，最大次数为 2



