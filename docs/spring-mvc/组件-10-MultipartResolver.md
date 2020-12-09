# 组件-10-MultipartResolver

`MultipartResolver` 用于解析，容类型( `Content-Type` )为 `multipart/*` 的请求的解析器接口。一般用于文件上传，二进制的操作。

代码如下：

```java
// MultipartResolver.java
public interface MultipartResolver {
    /**
     * 是否为 multipart 请求
     */
    boolean isMultipart(HttpServletRequest request);
    /**
     * 将 HttpServletRequest 请求封装成 MultipartHttpServletRequest 对象
     */
    MultipartHttpServletRequest resolveMultipart(HttpServletRequest request) throws MultipartException;
    /**
     * 清理处理 multipart 产生的资源，例如临时文件
     *
     */
    void cleanupMultipart(MultipartHttpServletRequest request);
}
```



## 类图

MultipartResolver 的体系结构如下：

![MultipartResolver 类图](http://static2.iocoder.cn/images/Spring/2022-06-16/01.png)

一共有两块：

- 上半部分，MultipartRequest 接口及其实现类
- 下半部分，MultipartResolver 接口以及其实现类