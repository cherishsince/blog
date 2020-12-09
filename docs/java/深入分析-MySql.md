# 深入分析-MySql

### 四大特性（ACID）

##### 原子性（Atomicity）

原子性是指事务包含的**所有操作要么全部成功，要么全部失败回滚**。失败回滚的操作事务，将不能对事务有任何影响。

##### 一致性（Consistency）

一致性是指事务必须使数据库从一个**一致性状态**变换到另一个一致性状态，也就是说一个事务执行之前和执行之后都必须处于一致性状态。

例如：A 和 B 进行转账操作，A 有 200 块钱，B 有 300 块钱；当 A 转了 100 块钱给 B 之后，他们 2 个人的总额还是 500 块钱，不会改变。

##### 隔离性（Isolation）

隔离性是指当多个用户并发访问数据库时，比如**同时访问一张表**，数据库每一个用户开启的事务，不能被其他事务所做的操作干扰(也就是事务之间的隔离)，多个并发事务之间，应当相互隔离。
　　例如同时有 T1 和 T2 两个并发事务，从 T1 角度来看，T2 要不在 T1 执行之前就已经结束，要么在 T1 执行完成后才开始。将多个事务隔离开，每个事务都不能访问到其他事务操作过程中的状态；就好比上锁操作，只有一个事务做完了，另外一个事务才能执行。

##### 持久性（Durability）

持久性是指事务的操作，一旦提交，对于数据库中数据的改变是永久性的，即使数据库发生故障也不能丢失已提交事务所完成的改变。

### 隔离级别导致的问题

- 脏读：
- 不可重复读：
- 幻读：

### 隔离级别

- **Read Uncommitted（读取未提交内容）**
- **Read Committed（读取提交内容）**
- **Repeatable Read（可重读）**
- **Serializable（可串行化）**

链接 https://blog.csdn.net/zhouym_/article/details/90381606

### 存储引擎

- InnoDb
- MyISAM

### 防止 sql 注入

PreparedStatement.set(): #{} 替换为 ？

### sql 去重

##### distinct 去重(可以单列，和多列)

```sql
select distinct(name) from talk_test;
```

##### group by（group by + count + min）

```sql
select * from (select key,value, min(id) from xxx group by key,value )
```

### 聚合函数

- vg
- max
- min
- sum
- ount

### 时间格式化

##### date_format(date,format), time_format(time,format)

```sql
select date_format('2008-08-08 22:23:01', '%Y%m%d%H%i%s');
```

##### str_to_date(str, format)

```sql
select str_to_date('08/09/2008', '%m/%d/%Y'); -- 2008-08-09
select str_to_date('08/09/08' , '%m/%d/%y'); -- 2008-08-09
select str_to_date('08.09.2008', '%m.%d.%Y'); -- 2008-08-09
select str_to_date('08:09:30', '%h:%i:%s'); -- 08:09:30
select str_to_date('08.09.2008 08:09:30', '%m.%d.%Y %h:%i:%s'); -- 2008-08-09 08:09:30
```

##### to_days(date), from_days(days)

```sql
select to_days('0000-00-00'); -- 0
select to_days('2008-08-08'); -- 733627
```
