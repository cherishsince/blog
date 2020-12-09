# 组件-8-MessageSource

`MessageSource` 用于国际化，大家需要先了解一下 `java.util.ResourceBundle`，这个是 `java `用来处理国际化，标准的公共类，具体使用如下：

```java
 public static void main(String args[]) {
     ResourceBundle bundle = ResourceBundle.getBundle("my", new Locale("zh", "CN"));
     String cancel = bundle.getString("cancelKey");
     System.out.println(cancel);

     bundle = ResourceBundle.getBundle("my", Locale.US);
     cancel = bundle.getString("cancelKey");
     System.out.println(cancel);

     bundle = ResourceBundle.getBundle("my", Locale.getDefault());
     cancel = bundle.getString("cancelKey");
     System.out.println(cancel);

     bundle = ResourceBundle.getBundle("my", Locale.GERMAN);
     cancel = bundle.getString("cancelKey");
     System.out.println(cancel);
     bundle = ResourceBundle.getBundle("my");
     for (String key : bundle.keySet()) {
         System.out.println(bundle.getString(key));
     }
 }
```

说明：

`ResourceBundle` 用于获取对于的 `key` 的 `value` ，`ResourceBundle` 的值怎么来呢？是通过另外一个类，进行创建的 `ResourceBundle.Control` ，这里分 `java.class` 和 `java.properties` 加载方式，就是可以通过 `properties` 和 `class` 配置国际化，

// 略 代码...



##### ResourceBundleMessageSource

spring 的 `ResourceBundleMessageSource` 是用于 `propertis ` 文及加载，继承了 `ResourceBundle.Control` 并重写 `newBundle()` ，这样才能加载 MessageSource 配置的 **国际化目录** 。

```java
// ResourceBundleMessageSource.MessageSourceControl

@Override
@Nullable
public ResourceBundle newBundle(String baseName, Locale locale, String format, ClassLoader loader, boolean reload)
    throws IllegalAccessException, InstantiationException, IOException {
    // <1> 这里只处理 properties 文件
    // Special handling of default encoding
    if (format.equals("java.properties")) {
        String bundleName = toBundleName(baseName, locale);
        final String resourceName = toResourceName(bundleName, "properties");
        final ClassLoader classLoader = loader;
        final boolean reloadFlag = reload;
        InputStream inputStream;
        try {
            inputStream = AccessController.doPrivileged((PrivilegedExceptionAction<InputStream>) () -> {
                InputStream is = null;
                if (reloadFlag) {
                    URL url = classLoader.getResource(resourceName);
                    if (url != null) {
                        URLConnection connection = url.openConnection();
                        if (connection != null) {
                            connection.setUseCaches(false);
                            is = connection.getInputStream();
                        }
                    }
                }
                else {
                    is = classLoader.getResourceAsStream(resourceName);
                }
                return is;
            });
        }
        catch (PrivilegedActionException ex) {
            throw (IOException) ex.getException();
        }
        if (inputStream != null) {
            String encoding = getDefaultEncoding();
            if (encoding != null) {
                try (InputStreamReader bundleReader = new InputStreamReader(inputStream, encoding)) {
                    return loadBundle(bundleReader);
                }
            }
            else {
                try (InputStream bundleStream = inputStream) {
                    return loadBundle(bundleStream);
                }
            }
        }
        else {
            return null;
        }
    }
    else {
        // Delegate handling of "java.class" format to standard Control
        return super.newBundle(baseName, locale, format, loader, reload);
    }
}
```

说明：

- <1> 这里只处理 properties 文件。



##### MessageSource

`Spring` 的 `MessageSource ` 就是采用 `java ` 的  `ResourceBundle ` 进行处理的，国际化可分为两种配置，`java.class` 和 `java.properties`，类图如下：

![这里写图片描述](https://img-blog.csdn.net/20180114213555035?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvbXVwZW5nZmVpNjY4OA==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)



Spring 里面采用 `ResourceBundleMessageSource` 来配置 `.properties` 文件， `MessageSource` 示例如下: 

```XML

<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
	   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	   xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd">

	<!--  message source  -->
	<bean id="messageSource" class="org.springframework.context.support.ResourceBundleMessageSource">
        <!--  <1> 这只国际化目录  -->
		<property name="defaultEncoding" value="UTF-8" />
        <property name="basename" value="messageSource.lan" />
		<property name="useCodeAsDefaultMessage" value="true" />
        <!--  <2>  -->
        <!--  lan 文件分为  -->
        <!--  lan.properties  -->
        <!--  lan_en_US.properties  -->
        <!--  lan_zh_CN.properties  -->
	</bean>
</beans>
```

```java
public static void main(String[] args) {
    ClassPathXmlApplicationContext context = new ClassPathXmlApplicationContext("messageSource/message-source.xml");
    System.err.println(context.getMessage("appName", null, Locale.getDefault()));
    System.err.println(context.getMessage("appName", null, Locale.CANADA));
    System.err.println(context.getMessage("appName", null, Locale.US));
}
```

说明：

- <1> 这只国际化目录。
- <2> 这是 lan 国际化目录，properties 属性文件目录。





ps：完结~





