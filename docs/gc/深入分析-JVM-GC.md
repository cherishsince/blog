# 深入分析-JVM-GC





### 垃圾收集器

    ![image-20200909090511960](/Users/sin/Library/Application Support/typora-user-images/image-20200909090511960.png)

- 收集器分为两种 **新生代、老年代** ，垃圾回收发生在 新时代称为 MinorGC，发生在 老年代称为 FullGC。

- 新生代，回收算法是 复制法。



### 回收算法

- 复制法
- 标记法
- 标记移动发



### Java引用Refresh

- 强引用(StrongReference)
- 软引用(SoftReference)
- 弱引用(WeakReference)



### 配置GC大小

- -XX:NewRadio
- -Xmn
- -XX:NewSize/MaxNewSize



### 垃圾回收策略



    ![image-20200909092647891](/Users/sin/Library/Application Support/typora-user-images/image-20200909092647891.png)



    ![image-20200909092635827](/Users/sin/Library/Application Support/typora-user-images/image-20200909092635827.png)

    ![image-20200909092658125](/Users/sin/Library/Application Support/typora-user-images/image-20200909092658125.png)





### 垃圾回收 Stop The World 现象







### CMS垃圾回收器工作示意图



    ![image-20200909093845385](/Users/sin/Library/Application Support/typora-user-images/image-20200909093845385.png)







