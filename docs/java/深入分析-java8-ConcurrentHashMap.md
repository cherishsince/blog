# 深入分析-java8-ConcurrentHashMap





### 知识

- 数组 + 链表 + 红黑树（链表 >=8 的时候，会转换为红黑树）





### 是怎么多线程扩容的？

>  代码略...



##### 扩容分为两种

- 普通的Node
- TreeBin(红黑树)

因为java8里面扩容会整体调整，可能扩容的时候还不是一个红黑树，只是一个链表。



##### 普通Node扩容

```java
if (fh >= 0) {
  int runBit = fh & n;
  Node<K,V> lastRun = f;
  for (Node<K,V> p = f.next; p != null; p = p.next) {
    int b = p.hash & n;
    if (b != runBit) {
      runBit = b;
      lastRun = p;
    }
  }
  if (runBit == 0) {
    ln = lastRun;
    hn = null;
  }
  else {
    hn = lastRun;
    ln = null;
  }
  // <1>
  for (Node<K,V> p = f; p != lastRun; p = p.next) {
    int ph = p.hash; K pk = p.key; V pv = p.val;
    if ((ph & n) == 0)
      ln = new Node<K,V>(ph, pk, pv, ln);
    else
      hn = new Node<K,V>(ph, pk, pv, hn);
  }
  // ln lastNode
  // hn headerNode
  // <2> lastNode 放到扩容的当前未知
  setTabAt(nextTab, i, ln);
  // <3> headNode 放到扩容的最后面
  setTabAt(nextTab, i + n, hn);
  setTabAt(tab, i, fwd);
  advance = true;
}
```



- 扩容会采用 synchronized 锁住 **头节点** 
- <1> 可以看出，是一并转移的，node没有进过 hash计算 index位置
- <2> <3> 扩容很有意思，将old的数据，移到新的table，头在新的table最尾处



##### 















### ForwardingNode 是什么？

```java
  // ConcurrentHashMap.class
  static final class ForwardingNode<K,V> extends Node<K,V> {
        final Node<K,V>[] nextTable;
        ForwardingNode(Node<K,V>[] tab) {
            super(MOVED, null, null, null);
            this.nextTable = tab;
        }
    
    // 略...
  }
```

- ConcurrentHashMap 是多线程扩容的，那么扩容完成后，会创建一个 ForwardingNode 放到旧的地方，替换原来的 Node，因为 ForwardingNode 里面保存新的 table 引用，所以 ForwardingNode 继承了 Node，重写了find() 方法。



### TreeBin 是什么？

TreeBin 是 ConcurrentHashMap 里面用来保存红黑树的。





