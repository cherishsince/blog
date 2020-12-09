# Xml路线-1-loadBeanDefinitions



这里是 `xml` 转换 `BeanDefinition` 路线，这里层级会比较深，会用到 `spring` 里面大部分的组件配合，最终才能获得 `BeanDefinition`



###### 第一步

这里是 `AbstractXmlApplicationContext` ，实现了 xml 默认加载行为，代码如下：

```java
protected void loadBeanDefinitions(DefaultListableBeanFactory beanFactory) throws BeansException, IOException {
		// <1> 用于解析 xml，提供加载 BeanDefinitions、向 BeanFactory 注册功能
		// Create a new XmlBeanDefinitionReader for the given BeanFactory.
		XmlBeanDefinitionReader beanDefinitionReader = new XmlBeanDefinitionReader(beanFactory);

		// <2> 配置解析 BeanDefinitions 时需要的一些组件
		// Configure the bean definition reader with this context's
		// resource loading environment.
		beanDefinitionReader.setEnvironment(this.getEnvironment());
		beanDefinitionReader.setResourceLoader(this);
		// <3> 这个适用于解析xml dtd 和 xsd，最终使用的还是 java EntityResolver
		// 解析 xml 全靠它，xml 转换至 document 对象后，spring 才能创建 BeanDefinitions
		// (不太重要，可以略过，有兴趣的可以了解)
		beanDefinitionReader.setEntityResolver(new ResourceEntityResolver(this));

		// <4> 初始化所有子类，beanDefinition, 子类也可以随意修改当前 beanDefinitionReader
		// Allow a subclass to provide custom initialization of the reader,
		// then proceed with actually loading the bean definitions.
		initBeanDefinitionReader(beanDefinitionReader);
		// <5> 加载 bean，从 xml 读取配置信息
		loadBeanDefinitions(beanDefinitionReader);
	}
```



说明：

-  <1> 用于解析 xml，提供加载 BeanDefinitions、向 BeanFactory 注册功能

- <2> 配置解析 BeanDefinitions 时需要的一些组件

- <3> 这个适用于解析xml dtd 和 xsd，最终使用的还是 java EntityResolver， 解析 xml 全靠它，xml 转换至 document 对象后，spring 才能创建 BeanDefinitions (不太重要，可以略过，有兴趣的可以了解)

- <4> 初始化所有子类，beanDefinition, 子类也可以随意修改当前 beanDefinitionReader

- <5> 这是核心：加载 bean，从 xml 读取配置信息



###### 方法 loadBeanDefinitions:

```java

	protected void loadBeanDefinitions(XmlBeanDefinitionReader reader) throws BeansException, IOException {
		// tips：
		// getConfigResources  和 getConfigLocations 区别是 new ClassPathXmlApplication(xxx.xml) 时候，
		// 提供了多个构造器，一个是通过 xml，另一个可以指定 xx.class 对象，为什么呢？
		// 这里和 ClassPathResource 有关，ClassPathResource 里面有可以指定一个 class 对象，和 classLoader，用于加载资源
		// 优先使用 class，没有才用 classLoader
		
        Resource[] configResources = getConfigResources();
        if (configResources != null) {
            reader.loadBeanDefinitions(configResources);
        }
        // configLocations
        String[] configLocations = getConfigLocations();
        if (configLocations != null) {
            reader.loadBeanDefinitions(configLocations);
        }
    }
```



说明：

这里就是将，new ClassPathXmlApplication(xxx.xml) 的配置xml文件给 XmlBeanDefinitionReader 进行解析。

>  getConfigResources 和 getConfigLocations 区别？这个不太重要，有性趣的可以自己去了解一下。



###### 第二步 - 解析 location

这里主要是解析 location，两种规则 一种是表达式，一种是具体的地址，代码如下：

```java
// AbstractBeanDefinitionReader

public int loadBeanDefinitions(String location, @Nullable Set<Resource> actualResources) throws BeanDefinitionStoreException {
		// <1> 获取 ResourceLoader，在创建 BeanDefinitionReader 时候设置的。
		ResourceLoader resourceLoader = getResourceLoader();
		if (resourceLoader == null) {
			throw new BeanDefinitionStoreException(
					"Cannot load bean definitions from location [" + location + "]: no ResourceLoader available");
		}

		//
		// location 存在两种情况
		// 第一种：表达式 classPath: **/*.xml 这种表达式，需要解析后才能
		// 第二种：已经是具体地址的 xml 路径，可以直接加载，不需要解析

		// <2> ApplicationContext 默认实现了 ResourcePatternResolver
		if (resourceLoader instanceof ResourcePatternResolver) {
			// Resource pattern matching available.
			try {
				// <2.1> 解析Resource，因为 location 可能是 classPath: **/*.xml 这种表达式，所以这里会返回多个 Resource
				Resource[] resources = ((ResourcePatternResolver) resourceLoader).getResources(location);
				// <2.2> 加载 bean definition，最终调用的是 BeanDefinitionReader -> XmlBeanDefinitionReader
				int count = loadBeanDefinitions(resources);
				if (actualResources != null) {
					Collections.addAll(actualResources, resources);
				}
				if (logger.isTraceEnabled()) {
					logger.trace("Loaded " + count + " bean definitions from location pattern [" + location + "]");
				}
				return count;
			}
			catch (IOException ex) {
				throw new BeanDefinitionStoreException(
						"Could not resolve bean definition resource pattern [" + location + "]", ex);
			}
		}

		// 第二种：已经是具体地址的 xml 路径，可以直接加载，不需要解析
		else {
			// <3.1> 这是具体的 url 可以直接解析
			// Can only load single resources by absolute URL.
			Resource resource = resourceLoader.getResource(location);
			// <3.2> 这里和 <2.2> 一样
			// 加载 bean definition
			int count = loadBeanDefinitions(resource);
			if (actualResources != null) {
				actualResources.add(resource);
			}
			if (logger.isTraceEnabled()) {
				logger.trace("Loaded " + count + " bean definitions from location [" + location + "]");
			}
			return count;
		}
	}
```



location 存在两种情况:

- 第一种：表达式 classPath: **/*.xml 这种表达式，需要解析后才能。
- 第二种：已经是具体地址的 xml 路径，可以直接加载，不需要解析。



说明：

- <1> 获取 ResourceLoader，在创建 BeanDefinitionReader 时候设置的。
- <2> ApplicationContext 默认实现了 ResourcePatternResolver。
- <2.1> 解析Resource，因为 location 可能是 classPath: **/*.xml 这种表达式，所以这里会返回多个 Resource。
- <2.2> 加载 bean definition，最终调用的是 BeanDefinitionReader -> XmlBeanDefinitionReader。
- <3.1> 这是具体的 url 可以直接解析。
- <3.2> 这里和 <2.2> 一样。



###### 第三步-加载xml文件

通过 Resource 加载文件，获取 InputSteam 来读取文件，代码如下：

```java
// XmlBeanDefinitionReader

public int loadBeanDefinitions(EncodedResource encodedResource) throws BeanDefinitionStoreException {
		// 空值检查
		Assert.notNull(encodedResource, "EncodedResource must not be null");
		if (logger.isTraceEnabled()) {
			logger.trace("Loading XML bean definitions from " + encodedResource);
		}

		// <1> 采用 ThreadLocation 实现线程安全，获取 EncodedResource (Resource 子类)
		Set<EncodedResource> currentResources = this.resourcesCurrentlyBeingLoaded.get();
		// <2> 如果是 null，创建一个 hashSet(首次进入为 null)
		if (currentResources == null) {
			currentResources = new HashSet<>(4);
			this.resourcesCurrentlyBeingLoaded.set(currentResources);
		}
		// 添加当前 encodedResource 失败时，抛出异常
		if (!currentResources.add(encodedResource)) {
			throw new BeanDefinitionStoreException(
					"Detected cyclic loading of " + encodedResource + " - check your import definitions!");
		}
		// 通过 resource 的 inputStream，失败直接异常
		try (InputStream inputStream = encodedResource.getResource().getInputStream()) {
			// InputSource 用于解析 java 的 xml的输入流
			InputSource inputSource = new InputSource(inputStream);
			// 设置字符集
			if (encodedResource.getEncoding() != null) {
				inputSource.setEncoding(encodedResource.getEncoding());
			}
			// <3> 这里开始准备去加载 BeanDefinition
			return doLoadBeanDefinitions(inputSource, encodedResource.getResource());
		}
		catch (IOException ex) {
			throw new BeanDefinitionStoreException(
					"IOException parsing XML document from " + encodedResource.getResource(), ex);
		}
		finally {
			// 处理完了，从 threadLocal 删除
			currentResources.remove(encodedResource);
			// 没有处理的资源了，使用 remove 从 threadLocal 删除
			if (currentResources.isEmpty()) {
				this.resourcesCurrentlyBeingLoaded.remove();
			}
		}
	}
```

说明：

- <1> 采用 ThreadLocation 实现线程安全，获取 EncodedResource (Resource 子类)。
- <2> 如果是 null，创建一个 hashSet(首次进入为 null)。

-  <3> 这里开始准备去加载 BeanDefinition。





###### 第三步-加载document、注册BeanDefinition

这里就是 加载document、注册BeanDefinition 这里代码不多，核心解析还在里面，代码如下：

```java 
// XmlBeanDefinitionReader

protected int doLoadBeanDefinitions(InputSource inputSource, Resource resource)
			throws BeanDefinitionStoreException {
		try {
		    // <1> 通过 InputSource 加载 Document(这里采用DocumentLoader组件)
			Document doc = doLoadDocument(inputSource, resource);
			// <2> 注册BeanDefinition，这里其实分为两步，解析BeanDefinition，然后注册
			int count = registerBeanDefinitions(doc, resource);
			if (logger.isDebugEnabled()) {
				logger.debug("Loaded " + count + " bean definitions from " + resource);
			}
			return count;
		}
		catch (BeanDefinitionStoreException ex) {
			throw ex;
		}
		catch (SAXParseException ex) {
			throw new XmlBeanDefinitionStoreException(resource.getDescription(),
					"Line " + ex.getLineNumber() + " in XML document from " + resource + " is invalid", ex);
		}
		catch (SAXException ex) {
			throw new XmlBeanDefinitionStoreException(resource.getDescription(),
					"XML document from " + resource + " is invalid", ex);
		}
		catch (ParserConfigurationException ex) {
			throw new BeanDefinitionStoreException(resource.getDescription(),
					"Parser configuration exception parsing XML from " + resource, ex);
		}
		catch (IOException ex) {
			throw new BeanDefinitionStoreException(resource.getDescription(),
					"IOException parsing XML document from " + resource, ex);
		}
		catch (Throwable ex) {
			throw new BeanDefinitionStoreException(resource.getDescription(),
					"Unexpected exception parsing XML document from " + resource, ex);
		}
	}
```

说明：

- <1> 通过 InputSource 加载 Document(这里采用DocumentLoader组件)。
- <2> 注册BeanDefinition，这里其实分为两步，解析BeanDefinition，然后注册。



###### 第四步-获取Document

TODO 不太重要，暂时跳过。



###### 第10步-注册BeanDefinition

这里其实不太规范，Document 和 BeanDefinition 解析过程也在里面，分开会比较好~

```java
// XmlBeanDefinitionReader

public int registerBeanDefinitions(Document doc, Resource resource) throws BeanDefinitionStoreException {
	    // <1> 通过 BeanUtils instantiateClass 创建对象，用于读取 BeanDefinition document
		BeanDefinitionDocumentReader documentReader = createBeanDefinitionDocumentReader();
		// <2> 获取已注册的 beanDefinition 数量，用于计算返回使用
		int countBefore = getRegistry().getBeanDefinitionCount();
		// <3> Document 解析过程就在这里面，解析和注册放到一起了(分成两个觉得会更好)。
		// 1、createReaderContext(resource) 创建 readerContext 上下文，这里只是为了做一下包装相当于一个BusinessObject(BO)
		documentReader.registerBeanDefinitions(doc, createReaderContext(resource));
		// <4> 这里已经完成注册了，里面记录的是注册的数量。
		return getRegistry().getBeanDefinitionCount() - countBefore;
	}
```

说明：

- <1> 通过 BeanUtils instantiateClass 创建对象，用于读取 BeanDefinition document
- <2> 获取已注册的 beanDefinition 数量，用于计算返回使用
- <3> Document 解析过程就在这里面，解析和注册放到一起了(分成两个觉得会更好)，
  - createReaderContext(resource) 创建 readerContext 上下文，这里只是为了做一下包装相当于一个BusinessObject(BO)
- <4> 这里已经完成注册了，里面记录的是注册的数量。



##### 第11步-解析BeanDefinition

解析 `BeanDefinition` 是用过 `DefaultBeanDefinitionDocumentReader` 来进行解析的，里面使用的是 `BeanDefinitionParserDelegate` 委派模式，为什么呢？

`BeanDefinition` 解析可分为 默认解析 和 扩展，那么 `SpringFramework `(`<import> <beans> <bean>`) 是默认的，像 `<context:component-scan>` 这种都是属于扩展，需要专门的解析器。

```java
// DefaultBeanDefinitionDocumentReader

protected void doRegisterBeanDefinitions(Element root) {

		// <1> 记录一下 old delegate，这里只是一个临时的保存，方法最后面会重新设置回去
		// 作用：是为了保留 this.delegate 是默认的 BeanDefinitionParserDelegate
		BeanDefinitionParserDelegate parent = this.delegate;
		// <2> 创建一个新的 delegate，每次解析都创建一个新的
		this.delegate = createDelegate(getReaderContext(), root, parent);

	  // <3> 检查是 xml头(dtd、xsd) 只有是 http://www.springframework.org/schema/beans 下的标签才可以
		if (this.delegate.isDefaultNamespace(root)) {
			// <3.1> 这里就是获取 namespace 空间 <bean profile="dev"> 用于区分环境
			// 检查 profile 标记环境加载 dev prod
			String profileSpec = root.getAttribute(PROFILE_ATTRIBUTE);
			if (StringUtils.hasText(profileSpec)) {
				// <3.2> 就是字符串分割，不过空的会过滤掉 “,; ”
				String[] specifiedProfiles = StringUtils.tokenizeToStringArray(
						profileSpec, BeanDefinitionParserDelegate.MULTI_VALUE_ATTRIBUTE_DELIMITERS);
				// <3.3> 如果所有 profiles 都无效，则不注册
				// We cannot use Profiles.of(...) since profile expressions are not supported
				// in XML config. See SPR-12458 for details.
				if (!getReaderContext().getEnvironment().acceptsProfiles(specifiedProfiles)) {
					if (logger.isDebugEnabled()) {
						logger.debug("Skipped XML bean definition file due to specified profiles [" + profileSpec +
								"] not matching: " + getReaderContext().getResource());
					}
					return;
				}
			}
		}

		// <4> 钩子，跳过(读取前)
		preProcessXml(root);
		// <5> 解析 beanDefinitions
		parseBeanDefinitions(root, this.delegate);
		// <6> 钩子，跳过(读取后)
		postProcessXml(root);

		// <7> 将 old 的 delegate 返回去，始终都只保留默认的
		this.delegate = parent;
	}
```

说明：

- <1> 记录一下 old delegate，这里只是一个临时的保存，方法最后面会重新设置回去，作用：是为了保留 this.delegate 是默认的 BeanDefinitionParserDelegate。

-  <2> 创建一个新的 delegate，每次解析都创建一个新的。
- <3> 检查是 xml头(dtd、xsd) 只有是 http://www.springframework.org/schema/beans 下的标签才可以。
  - <3.1> 这里就是获取 namespace 空间 `<bean profile="dev">` 用于区分环境，检查 profile 标记环境加载 dev prod。
  - <3.2> 就是字符串分割，不过空的会过滤掉 “,; ”。
  - <3.3> 如果所有 profiles 都无效，则不注册。

- <4> 钩子，跳过(读取前)。
- <5> 解析 beanDefinitions。
- <6> 钩子，跳过(读取后)。
- <7> 将 old 的 delegate 返回去，始终都只保留默认的。



**isDefaultNamespace 是指啥?**

isDefaultNamespace 的  http://www.springframework.org/schema/beans 如下:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
	   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	   xmlns:context="http://www.springframework.org/schema/context"
	   xmlns:my="http://www.example.org/schema/my-tag"
	   xsi:schemaLocation="
	   http://www.example.org/schema/my-tag
       http://www.example.org/schema/my-tag.xsd
       http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd
       http://www.springframework.org/schema/context
       https://www.springframework.org/schema/context/spring-context.xsd
">
```

就是 `xmlns=""` 东西~



**parseBeanDefinitions 开始解析了**

看一下 parseBeanDefinitions，代码如下：

```java
// DefaultBeanDefinitionDocumentReader

protected void parseBeanDefinitions(Element root, BeanDefinitionParserDelegate delegate) {
		// <1> 默认命名空间，执行如下，检查是不是 http://www.springframework.org/schema/beans，下的标签
		if (delegate.isDefaultNamespace(root)) {
			// <2> 处理所有子节点，进行解析，里面还存在 递归情况，没有子节点就不会进入 for，一般root节点会有的
			NodeList nl = root.getChildNodes();
			for (int i = 0; i < nl.getLength(); i++) {
				Node node = nl.item(i);
				if (node instanceof Element) {
					Element ele = (Element) node;
					// <2.1> 默认命名空间，执行如下，检查是不是 http://www.springframework.org/schema/beans，下的标签
					if (delegate.isDefaultNamespace(ele)) {
						parseDefaultElement(ele, delegate);
					} else {
						// <2.2> 自定义 或 扩展标签 解析，扩展的 BeanDefinition 解析全在里面了
						// 这里调用 parseCustomElement 原因是，默认的标签下，有自定义标签情况
						delegate.parseCustomElement(ele);
					}
				}
			}
		} else {
			// <3> 不是默认命名空间执行(自定义 或 扩展标签 解析) 
			// 如：<tx:annotation-driven> <component-scan>
			delegate.parseCustomElement(root);
		}
	}

```

说明：

- <1> 默认命名空间，执行如下，检查是不是 http://www.springframework.org/schema/beans，下的标签。
- <2> 处理所有子节点，进行解析，里面还存在 递归情况，没有子节点就不会进入 for，一般root节点会有的
  -  <2.1> 默认命名空间，执行如下，检查是不是 http://www.springframework.org/schema/beans，下的标签。
  - <2.2> 自定义 或 扩展标签 解析，扩展的 BeanDefinition 解析全在里面了，这里调用 parseCustomElement 原因是，默认的标签下，有自定义标签情况。
- <3> 不是默认命名空间执行(自定义 或 扩展标签 解析) ，如：`<tx:annotation-driven>` `<component-scan>`。



##### 第11.1-默认解析

解析的过程，还在里面，这里只是做了一下分类，然后才调用解析的过程，代码如下：

```java
// DefaultBeanDefinitionDocumentReader

private void parseDefaultElement(Element ele, BeanDefinitionParserDelegate delegate) {
		// <1> 不同的标签，调用不同的解析规则
		if (delegate.nodeNameEquals(ele, IMPORT_ELEMENT)) {
			// 解析import
			importBeanDefinitionResource(ele);
		} else if (delegate.nodeNameEquals(ele, ALIAS_ELEMENT)) {
			// 解析alias
			processAliasRegistration(ele);
		} else if (delegate.nodeNameEquals(ele, BEAN_ELEMENT)) {
			// 解析bean
			processBeanDefinition(ele, delegate);
		} else if (delegate.nodeNameEquals(ele, NESTED_BEANS_ELEMENT)) {
			// 解析beans 这是一个递归
			doRegisterBeanDefinitions(ele);
		}
	}
```

说明：

- <1> 不同的标签，调用不同的解析规则。



##### 第11.1.1 processBeanDefinition

这里分为四部步，第一步解析 BeanDefinition，第二步进行 BeanDefinition 修饰，第三步进行注册 BeanDefinition，最后发送注册通知。

```java
  // DefaultBeanDefinitionDocumentReader

	protected void processBeanDefinition(Element ele, BeanDefinitionParserDelegate delegate) {
		// <1> 创建 beanDefinition，并解析 xml 文件属性 设置到 beanDefinition
		// bdHolder 里面就是 BeanDefinition，
		BeanDefinitionHolder bdHolder = delegate.parseBeanDefinitionElement(ele);
		if (bdHolder != null) {
			// <2> 装饰 BeanDefinition，一般用于自定义标签
			bdHolder = delegate.decorateBeanDefinitionIfRequired(ele, bdHolder);
			try {
				// <3> 注册 BeanDefinition
				// Register the final decorated instance.
				BeanDefinitionReaderUtils.registerBeanDefinition(bdHolder, getReaderContext().getRegistry());
			} catch (BeanDefinitionStoreException ex) {
				getReaderContext().error("Failed to register bean definition with name '" +
						bdHolder.getBeanName() + "'", ele, ex);
			}

			// <4> 注册完后，发送通知
			// Send registration event.
			getReaderContext().fireComponentRegistered(new BeanComponentDefinition(bdHolder));
		}
	}
```

说明：

- <1> 创建 beanDefinition，并解析 xml 文件属性 设置到 beanDefinition，bdHolder 里面就是 BeanDefinition。
- <2> 装饰 BeanDefinition，一般用于自定义标签
- <3> 注册 BeanDefinition
- <4> 注册完后，发送通知



##### 第11.2-bean标签解析

`<bean>` 解析，我们来看一下代码：

```java
// DefaultBeanDefinitionDocumentReader

public BeanDefinitionHolder parseBeanDefinitionElement(Element ele, @Nullable BeanDefinition containingBean) {
		// <1> 解析 id 和 name 属性
		String id = ele.getAttribute(ID_ATTRIBUTE);
		String nameAttr = ele.getAttribute(NAME_ATTRIBUTE);

		// <2> 解析别名集合，解析 aliases 别名，tokenizeToStringArray 就是字符串分割(不过会出去空的元素)
		List<String> aliases = new ArrayList<>();
		if (StringUtils.hasLength(nameAttr)) {
			String[] nameArr = StringUtils.tokenizeToStringArray(nameAttr, MULTI_VALUE_ATTRIBUTE_DELIMITERS);
			aliases.addAll(Arrays.asList(nameArr));
		}

		// <3> 优先用id，没有则用 aliases(第一个aliases)
		String beanName = id;
		// 如果 beanName = null，那么就从 aliases 中去除第 0 个给 beanName
		if (!StringUtils.hasText(beanName) && !aliases.isEmpty()) {
			beanName = aliases.remove(0);
			if (logger.isTraceEnabled()) {
				logger.trace("No XML 'id' specified - using '" + beanName +
						"' as bean name and " + aliases + " as aliases");
			}
		}

		// tips: containingBean 是一个 beanDefinition
		// <4> 检查 name 唯一性(this.usedNames)，默认情况 containingBean 是 null
		if (containingBean == null) {
			checkNameUniqueness(beanName, aliases, ele);
		}

		// <5> 创建了一个 beanDefinition，并解析 xml 属性，设置到 beanDefinition，如果解析失败返回 null
		AbstractBeanDefinition beanDefinition = parseBeanDefinitionElement(ele, beanName, containingBean);
		if (beanDefinition != null) {

			// tips:
			// <6> 检查 beanName = null 的情况，那么就需要去生成一个名字
			// 这里只解析 bean，没有beanName的情况，只有在<bean> 标签上没有设置，才会进入这里
			if (!StringUtils.hasText(beanName)) {
				try {
					if (containingBean != null) {
						// <6.1> 根据 beanDefinition 生成唯一 beanName
						beanName = BeanDefinitionReaderUtils.generateBeanName(
								beanDefinition, this.readerContext.getRegistry(), true);
					}
					else {
                        // <6.2> 生成 beanName，获取 beanDefinition.getBeanClassName() 没有就获取 parent 的，还没有就 获取beanFactory 的
                        // 生成规则 BeanDefinitionReaderUtils.generateBeanName

						// 两种规则区别
						// isInnerBean=true，采用的是 ObjectUtils.getIdentityHexString
						// isInnerBean=false，是一个唯一的计数器每次+1，如果 obj#1, obj#2

						beanName = this.readerContext.generateBeanName(beanDefinition);
						// Register an alias for the plain bean class name, if still possible,
						// if the generator returned the class name plus a suffix.
						// This is expected for Spring 1.2/2.0 backwards compatibility.
						String beanClassName = beanDefinition.getBeanClassName();
                        if (beanClassName != null &&
								beanName.startsWith(beanClassName) && beanName.length() > beanClassName.length() &&
								!this.readerContext.getRegistry().isBeanNameInUse(beanClassName)) {
							aliases.add(beanClassName);
						}
					}
					if (logger.isTraceEnabled()) {
						logger.trace("Neither XML 'id' nor 'name' specified - " +
								"using generated bean name [" + beanName + "]");
					}
				}
				catch (Exception ex) {
					error(ex.getMessage(), ele);
					return null;
				}
			}
			// <7> 将aliases list 转换为 array
			String[] aliasesArray = StringUtils.toStringArray(aliases);
			// <8> 创建 BeanDefinitionHolder 返回
			return new BeanDefinitionHolder(beanDefinition, beanName, aliasesArray);
		}
		return null;
	}

```



说明：

- <1> 解析 id 和 name 属性。
- <2> 解析别名集合，解析 aliases 别名，tokenizeToStringArray 就是字符串分割(不过会出去空的元素)。
- <3> 优先用id，没有则用 aliases(第一个aliases)。

- <4> 检查 name 唯一性(this.usedNames)，默认情况 containingBean 是 null。
- <5> 创建了一个 beanDefinition，**并解析 xml 属性，设置到 beanDefinition**，如果解析失败返回 null。
- <6> 检查 beanName = null 的情况，那么就需要去生成一个名字，这里只解析 bean，没有beanName的情况，只有在`<bean>` 标签上没有设置，才会进入这里。
  - <6.1> 根据 beanDefinition 生成唯一 beanName。
  - <6.2> 生成 beanName，获取 beanDefinition.getBeanClassName() 没有就获取 parent 的，还没有就 获取beanFactory 的，生成规则 BeanDefinitionReaderUtils.generateBeanName；

- <7> 将aliases list 转换为 array。
- <8> 创建 BeanDefinitionHolder 返回。



##### 第11.3-将xml解析成AbstractBeanDefinition

这里会创建 `AbstractBeanDefinition`，这里就是做真正的解析了，创建失败的时候返回 null。

```java
	public AbstractBeanDefinition parseBeanDefinitionElement(
			Element ele, String beanName, @Nullable BeanDefinition containingBean) {
		// <1> 这是一个状态，标记这个 beanName 是不是在解析中。
		this.parseState.push(new BeanEntry(beanName));

		// <2> 解析 class 属性
		String className = null;
		if (ele.hasAttribute(CLASS_ATTRIBUTE)) {
			className = ele.getAttribute(CLASS_ATTRIBUTE).trim();
		}

		// <3> 解析 xml parent，可以覆盖子类的属性(可以理解为基础和覆盖)
		String parent = null;
		if (ele.hasAttribute(PARENT_ATTRIBUTE)) {
			parent = ele.getAttribute(PARENT_ATTRIBUTE);
		}

		try {
			// <4> 创建 AbstractBeanDefinition 其实就可以认为是一个 BeanDefinition
			AbstractBeanDefinition bd = createBeanDefinition(className, parent);
			// <5> 解析 xml 属性，这里面就将 xml 设置到 AbstractBeanDefinition 中
			parseBeanDefinitionAttributes(ele, beanName, containingBean, bd);
			// 解析 description
			bd.setDescription(DomUtils.getChildElementValueByTagName(ele, DESCRIPTION_ELEMENT));

			// tips:
			// 开始解析 <bean> 属性，然后放到 db中

			// 解析 <bean> 标签下的 <meta> 标签
			parseMetaElements(ele, bd);
			// <lookup-method>
			parseLookupOverrideSubElements(ele, bd.getMethodOverrides());
			// <replaced-method>
			parseReplacedMethodSubElements(ele, bd.getMethodOverrides());
			// 解析 构造函数 参数
			parseConstructorArgElements(ele, bd);
			// 解析 property 属性
			parsePropertyElements(ele, bd);
			// 解析 Qualifier 标识(spring 多实现，需要用不同别名注入 @Qualifier 注解一样)
			parseQualifierElements(ele, bd);
			// 上下文的 context
			bd.setResource(this.readerContext.getResource());
			// <6> 这里就是 ele，会将原始的 element 保存到 BeanDefinition 里面
			bd.setSource(extractSource(ele));

			return bd;
		} catch (ClassNotFoundException ex) {
			error("Bean class [" + className + "] not found", ele, ex);
		} catch (NoClassDefFoundError err) {
			error("Class that bean class [" + className + "] depends on not found", ele, err);
		} catch (Throwable ex) {
			error("Unexpected failure during bean definition parsing", ele, ex);
		} finally {
			this.parseState.pop();
		}

		return null;
	}
```

说明：

- <1> 这是一个状态，标记这个 beanName 是不是在解析中。
- <2> 解析 class 属性。
- <3> 解析 xml parent，可以覆盖子类的属性(可以理解为基础和覆盖)。
- <4> 创建 AbstractBeanDefinition 其实就可以认为是一个 BeanDefinition。
- <5> 解析 xml 属性，**这里面就将 xml 设置到 AbstractBeanDefinition 中**。
- <6> 这里就是 ele，会将原始的 element 保存到 BeanDefinition 里面。



> 注意：这里就不再做深入的解析了，再深入其实作用不大，需要大家自己主动去分析~~
>
> 注意：这里就不再做深入的解析了，再深入其实作用不大，需要大家自己主动去分析~~
>
> 注意：这里就不再做深入的解析了，再深入其实作用不大，需要大家自己主动去分析~~





ps：完结~