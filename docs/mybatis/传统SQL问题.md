# 传统SQL问题



- jdbc 底层没有使用连接处，操作数据库需要频繁的创建和销毁链接，消耗资源很大。
- 原生jdbc 在代码中，一旦我们修改sql就需要，java需要重新编译，不利于维护。
- 使用 PreparedStatement 预编译的话，对设置参数 ?, ?, ? 这种占位序号不利于维护。
- 返回 result 结果也需要，挨个set到我们的 dataobject中。





##### 数据库

DQL DML DDL