# 深入分析-HashMap

HashMap 分 java7、java8 两个版本，java8 对 HashMap 进行了优化。

- Java7: 数组 + 链表

- java8: 数组 + [链表 + 红黑树]

基本属性(不区分 java7、java8)：

```java
// maximum_capacity 最大容量 1073741824(10亿多)
static final int MAXIMUM_CAPACITY = 1 << 30;
// 加载因子 0.75
static final float DEFAULT_LOAD_FACTOR = 0.75f;
// 在初始化的时候给的 空Entiry
static final Entry<?,?>[] EMPTY_TABLE = {};
// 保存我们的数据(扩容是当前 table.length * 2)
transient Entry<K,V>[] table = (Entry<K,V>[]) EMPTY_TABLE;
// 当前 map 的大小
transient int size;
// 什么时候需要扩容(假设扩容为16，loadFactor = (int)16 * 0.75))
final float loadFactor;
// 修改次数(添加、删除、覆盖不算)
transient int modCount;
```

- 加载因子：0.75
- 扩容：当前的大小 \* 2 (是 table.length，扩容的时候是 loadFactor 还没到 table.length)
- 最大容量：1 << 30 次幂
- 初始化在：首次 put 方法调用才会初始化

- key 可以相同：允许覆盖
- 允许 key 为 null
- 默认大小：java7 为 16，java8 也是 16，不过 8 是在 put()的时候 resize()里面
- 非现场安全的(可以采用 Collections.synchronizedMap(null) 进行换行为线程安全的)
- 是头插入法：hash 冲突的时候，新的 node 会在最前面

### 什么时候初始化呢？

HashMap 我们在 new 的时候不会去初始化容量，**只是将一个空的 Entry 给 table 属性**。

```java
// HashMap.class

// put方法
public V put(K key, V value) {
  if (table == EMPTY_TABLE) {
    inflateTable(threshold);
  }

  // 略...
}

// inflateTable
private void inflateTable(int toSize) {
  // Find a power of 2 >= toSize
  int capacity = roundUpToPowerOf2(toSize);

  threshold = (int) Math.min(capacity * loadFactor, MAXIMUM_CAPACITY + 1);
  table = new Entry[capacity];
  initHashSeedAsNeeded(capacity);
}

// 扩容2倍，的小一个的2次幂 如：10得到8、20得到18
private static int roundUpToPowerOf2(int number) {
  // assert number >= 0 : "number must be non-negative";
  return number >= MAXIMUM_CAPACITY
    ? MAXIMUM_CAPACITY
    : (number > 1) ? Integer.highestOneBit((number - 1) << 1) : 1;
}
```

- HashMap 初始化：是在首次的 put 才会进行。

### 怎么计算 key 的位置呢？

通过 key 的 hashCode，然后和 table.length 计算位置。

```java
// HashMap
 public V put(K key, V value) {
   if (table == EMPTY_TABLE) {
     inflateTable(threshold);
   }
   if (key == null)
     return putForNullKey(value);
   // 获取key的hashCode值
   int hash = hash(key);
   // 通过hash和table.length计算index位置
   int i = indexFor(hash, table.length);
   for (Entry<K,V> e = table[i]; e != null; e = e.next) {
     Object k;
     if (e.hash == hash && ((k = e.key) == key || key.equals(k))) {
       V oldValue = e.value;
       e.value = value;
       e.recordAccess(this);
       return oldValue;
     }
   }

   modCount++;
   addEntry(hash, key, value, i);
   return null;
 }

// 计算 hash
final int hash(Object k) {
  int h = hashSeed;
  if (0 != h && k instanceof String) {
    // java8移除
    return sun.misc.Hashing.stringHash32((String) k);
  }

  h ^= k.hashCode();

  // This function ensures that hashCodes that differ only by
  // constant multiples at each bit position have a bounded
  // number of collisions (approximately 8 at default load factor).
  h ^= (h >>> 20) ^ (h >>> 12);
  return h ^ (h >>> 7) ^ (h >>> 4);
}

// 计算出 index
static int indexFor(int h, int length) {
  // assert Integer.bitCount(length) == 1 : "length must be a non-zero power of 2";
  return h & (length-1);
}
```

- **每次扩容的时候，都需要重新计算 Node 在 table 的位置**
- 通过 key 的 hashCode，然后和 table.length 计算位置。

### HashCode 是怎么来的？

如下代码：

```java
/*
 * 这段注释：<1>
 * (This is typically implemented by converting the internal
 * address of the object into an integer, but this implementation
 * technique is not required by the
 * Java&trade; programming language.)
 *
 * @return  a hash code value for this object.
 * @see     java.lang.Object#equals(java.lang.Object)
 * @see     java.lang.System#identityHashCode
 */
public native int hashCode();
```

意思是：hash 值来源于这个对象的 **内部地址转换成的整型值。**

**这里我们可以得出，java 的 hashCode 是唯一的。**

###### JVM-HashCode 生成规则

- 随机数
- 内存地址
- 敏感测试
- 自增序列
- 利用位移生成随机数(默认)

> 详细了解(Java7): https://zhuanlan.zhihu.com/p/33915892

###### HashCode 可以说是惟一的，为什么还会有 Hash 冲突呢？

hashCode 需要从一个二进制的地址转换为一个极小值，肯定会有 hash 碰撞，不过可以通过不同的算法来降低 hash 碰撞的概率，不过需要考虑性能和优势。

### 如何解决 Hash 碰撞

- 开放地址法： 开放地执法有一个公式:Hi=(H(key)+di) MOD m i=1,2,…,k(k<=m-1)
  基本思想：当发生地址冲突时，按照某种方法继续探测哈希表中的其他存储单元，直到找到空位置为止。
- rehash(再 hash 法)：使用第二个或第三个...计算地址，知道无冲突。比如：按首字母进行 hash 冲突了，则按照首字母第二位，进行 hash 寻址。
- 链地址法(拉链法)默认的：创建一个链表数组，数组中每一格就是一个链表。若遇到哈希冲突，则将冲突的值加到链表中即可。

详细地址：https://www.jianshu.com/p/5a97034ff247

### 怎么扩容转义链表数据的？

```java
// HashMap
void transfer(Entry[] newTable, boolean rehash) {
  int newCapacity = newTable.length;
  for (Entry<K,V> e : table) {
    while(null != e) {
      Entry<K,V> next = e.next;
      if (rehash) {
        e.hash = null == e.key ? 0 : hash(e.key);
      }
      // <1> 计算新的位置
      int i = indexFor(e.hash, newCapacity);
      e.next = newTable[i];
      newTable[i] = e;
      // <2> 链表的下一个元素，再次计算(Hash冲突，扩容后可能也不冲突了)
      e = next;
    }
  }
}
```

- <1>: 采用的一个循环，不为 null 的进行 hash 运算计算，newTable 的位置，然后保存。
- <2>: hash 冲突的元素，也需要重新计算位置，扩容后可能链表后的元素又不冲突了。

### HashMap 中的 hashSeed 是做什么的？

```java
// HashMap.class
final int hash(Object k) {
  int h = hashSeed;
  if (0 != h && k instanceof String) {
    return sun.misc.Hashing.stringHash32((String) k);
  }

  h ^= k.hashCode();

  // This function ensures that hashCodes that differ only by
  // constant multiples at each bit position have a bounded
  // number of collisions (approximately 8 at default load factor).
  h ^= (h >>> 20) ^ (h >>> 12);
  return h ^ (h >>> 7) ^ (h >>> 4);
}

// HashMap.class
final boolean initHashSeedAsNeeded(int capacity) {
  boolean currentAltHashing = hashSeed != 0;
  boolean useAltHashing = sun.misc.VM.isBooted() &&
    (capacity >= Holder.ALTERNATIVE_HASHING_THRESHOLD);
  boolean switching = currentAltHashing ^ useAltHashing;
  if (switching) {
    hashSeed = useAltHashing
      ? sun.misc.Hashing.randomHashSeed(this)
      : 0;
  }
  return switching;
}

// sun.misc.Hashing.randomHashSeed
public static int randomHashSeed(Object var0) {
  int var1;
  if (VM.isBooted()) {
    // <1> 线程安全的随机数int
    var1 = ThreadLocalRandom.current().nextInt();
  } else {
    // 根据 HashMap.class + 当前线程 + 线程id + 时间戳 + 空闲内存
    int[] var2 = new int[]{System.identityHashCode(Hashing.class), System.identityHashCode(var0), System.identityHashCode(Thread.currentThread()), (int)Thread.currentThread().getId(), (int)(System.currentTimeMillis() >>> 2), (int)(System.nanoTime() >>> 5), (int)(Runtime.getRuntime().freeMemory() >>> 4)};
    var1 = murmur3_32(var2);
  }

  return 0 != var1 ? var1 : 1;
}
```

- hashSeed 只会在 hash() 这个地方使用

- randomHashSeed 意思 ”随机 hash 起点“ ，就是重新计算 hash 的一个起点\*\*

- hashSeed 标识默认为 0，第一次扩容（不是初始化）会调用 randomHashSeed 随机 hash 起点，在 hash 中会到(sun.misc.Hashing.stringHash32((String) k); )

> 简单理解就是，hash 冲突的优化操作

### Iterator 是怎么获取元素的？

```java
// HashIterator.class
HashIterator() {
  expectedModCount = modCount;
  if (size > 0) { // advance to first entry
    Entry[] t = table;
    // <1>
    while (index < t.length && (next = t[index++]) == null)
      ;
  }
}

final Entry<K,V> nextEntry() {
  if (modCount != expectedModCount)
    throw new ConcurrentModificationException();
  Entry<K,V> e = next;
  if (e == null)
    throw new NoSuchElementException();

  // <2> 这是核心代码
  if ((next = e.next) == null) {
    Entry[] t = table;
    // <3> 寻找下一个链表元素(这个是计算下一个 next 是否存在)
    while (index < t.length && (next = t[index++]) == null)
      ;
  }
  current = e;
  return e;
}
```

- <1> 初始化的时候，就算计算 next 是否存在。
- <2> <3> 是计算下一个 entity 对象是否存在了，这个方法作用是，获取当前的 Entry，计算下一个 Entry。

### Null 的 key 是存在 HashMap 的那个地方？

```java
// HashMap.class
private V putForNullKey(V value) {
  // <1> table[0] 首个
  for (Entry<K,V> e = table[0]; e != null; e = e.next) {
    // <2> 每次都是覆盖
    if (e.key == null) {
      V oldValue = e.value;
      e.value = value;
      e.recordAccess(this);
      return oldValue;
    }
  }
  modCount++;
  addEntry(0, null, value, 0);
  return null;
}
```

- 如果 null 为 key，hashMap 会将 null 默认放到 0
- null 不存在 hash 冲突如果相同的 null 作为 key，只会覆盖 value

## 扩展知识

```java
// highest(最高) 第一个 bit(进制的 bit 意思，一个8b=1byte)
// 获取高位，低一位的2次幂（如：10得到8、20得到18）
public static int highestOneBit(int i) {
  // HD, Figure 3-1
  i |= (i >>  1);
  i |= (i >>  2);
  i |= (i >>  4);
  i |= (i >>  8);
  i |= (i >> 16);
  return i - (i >>> 1);
}

// 如上有一个规律

// 1000 0010
// >> 1
// 0100 0001
// |
// 1100 0011
// >> 2
// 0011 0000
// |
// 1111 0011

// >> 4 8 6 略
// 就是找到当前值，第一位的2次幂，10找到的是8，向移动然后通过 | 补1，最后就是我们想要的值
```
