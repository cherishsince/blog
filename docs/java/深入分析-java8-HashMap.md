# 深入分析-java8-HashMap



### 知识

- 数组 + 链表 + 红黑树
- 默认16
- 支持key null
- 允许key 覆盖
- 增加了 putIfAbsent，如果key存在就不作任何操作



### 怎么加锁？

scanAndLockForPut() 方法加锁，每次锁的是头节点。



### 怎么扩容的

- 在 Segment 里面 rehash() 方法

- 扩容只针对单个 Segment，某一个 Segment 扩容需要这个线程，将 Segment的元素重新计算一般然后放进去

- 扩容采用的是**头插法**

  

### TreeBin 是什么？

红黑树



### modCount 是什么

- modCount 每次在对 table 进行修改（扩容）等操作的时候会+1，查询不算。





