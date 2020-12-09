# Sql执行过程



debug 了一下，大概执行流程如下：

1. getMapper 
2. Proxy.newInstance
3. selectById() 
4. MapperProxy#invoke 
5. cacheInvoke 
6. MapperMethod#execute
7. select or update ... 
8. convertArgsToSqlCommandParam 
9. sqlSession.selectOne
10. sqlSession.selectList
11. configuration.getMappedStatement(statement)
12. Executor#query
13.  CacheKey(二级缓存) 
14. queryFromDatabase
15. doQuery
16. prepareStatement(打开jdbc Connection)
17. PreparedStatement.execute
18. resultSetHandler.handleResultSets(ps); (处理返回值类型和java对应)



说明：

主要分为两部分，获取Mapper、创建 MapperProxy、Execute执行起调用执行、获取jdbc connection、创建 sql Statement 执行。











