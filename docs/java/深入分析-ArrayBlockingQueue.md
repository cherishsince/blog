# 深入分析-ArrayBlockingQueue



### 知识

采用 ReentrantLock 的  Condition 实现，如下：

```java
   /** Condition for waiting takes */
    private final Condition notEmpty;

    /** Condition for waiting puts */
    private final Condition notFull;
```

会有两个 Condition 用来标识条件，作用就是阻塞。



（**基本常见的queue都采用这种实现**）







### Java引用类型



**强引用（Strong Reference）**



**软引用（Soft Reference）**



**弱引用（Weak Reference）**



**虚引用（Phantom Reference）**



https://www.cnblogs.com/yanggb/p/10386175.html











