# 容器周期-20-doGetBean

容器生命周期 `doGetBean()`，调用这个方法的时候，才会创建并初始化这个 `Bean` ，还有相关的 `PostProcessor` 调用，以及相关的容器生命周期管理。



##### AbstractBeanFactory#doGetBean(xxx)

Spring 的 Bean 创建都会调用 `AbstractAutowireCapableBeanFactory#createBean(xxx)` 这个方法，我们看如下代码：

```java
// AbstractBeanFactory#doGetBean(xxx)

// 省略代码...

// <10> 创建Singleton 对象
// Create bean instance.
if (mbd.isSingleton()) {
  // <10.1> tips: 创建 singleton 调用的是 createBean 子类，这里指向的是 AbstractAutowireCapableBeanFactory
  // 实现了一个匿名的 ObjectFactory 返回一个 object 对象
  sharedInstance = getSingleton(beanName, () -> {
    try {
      // <10.2> 调用 AbstractAutowireCapableBeanFactory 进行创建
      return createBean(beanName, mbd, args);
    } catch (BeansException ex) {
      // Explicitly remove instance from singleton cache: It might have been put there
      // eagerly by the creation process, to allow for circular reference resolution.
      // Also remove any beans that received a temporary reference to the bean.
      destroySingleton(beanName);
      throw ex;
    }
  });
  // <10.3> 创建后的 object 对象，并不能直接使用，还需要经过 getObjectForBeanInstance 处理
  bean = getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
}

// <11> 创建原型(prototype) 实例，每次都创建一个新的
else if (mbd.isPrototype()) {
  // <11.1> 这个用于保存创建的实例
  // 这是一个原型->创建一个新实例。
  // It's a prototype -> create a new instance.
  Object prototypeInstance = null;
  try {
    // <11.2> 创建之前，钩子方法
    beforePrototypeCreation(beanName);
    // <11.3> 也是调用 AbstractAutowireCapableBeanFactory 不过不缓存，所以没都会去调用，创建一个新的对象
    prototypeInstance = createBean(beanName, mbd, args);
  } finally {
    // <11.4> 创建之后 钩子方法
    afterPrototypeCreation(beanName);
  }
  // <11.5> 创建后的 object 对象，并不能直接使用，还需要经过 getObjectForBeanInstance 处理
  bean = getObjectForBeanInstance(prototypeInstance, name, beanName, mbd);
}

// <12> 如果不是 singleton 和 prototype 的话，需要委托给相应的实现类来处理
else {
  // <12.1> 获取 scope 看看是啥，需要通过 scope 调用对于的类，进行创建实例对象
  String scopeName = mbd.getScope();
  final Scope scope = this.scopes.get(scopeName);
  // <12.2> 没有 scope 是不行的
  if (scope == null) {
    throw new IllegalStateException("No Scope registered for scope name '" + scopeName + "'");
  }
  try {
    // <12.3> 调用 Scope 接口的 get() 方法，创建对象
    // 匿名实现了 ObjectFactory，最终调用了 AbstractAutowireCapableBeanFactory 来创建对象
    // 可以说和 prototype 没啥区别
    Object scopedInstance = scope.get(beanName, () -> {
      // <12.3> 创建之前，钩子方法
      beforePrototypeCreation(beanName);
      try {
        // <23.4> 也是调用 AbstractAutowireCapableBeanFactory 不过不缓存，所以没都会去调用，创建一个新的对象
        return createBean(beanName, mbd, args);
      } finally {
        // <23.5> 创建之前，钩子方法
        afterPrototypeCreation(beanName);
      }
    });

    // <12.6> 创建后的 object 对象，并不能直接使用，还需要经过 getObjectForBeanInstance 处理
    bean = getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
  } 
}

// 省略代码...
```

说明：

- <10> 创建Singleton 对象。
- <11> 创建原型(prototype) 实例，每次都创建一个新的。
- <12> 如果不是 singleton 和 prototype 的话，需要委托给相应的实现类来处理。

**注意**：以上三种创建方式，都会调用 `AbstractAutowireCapableBeanFactory#createBean(xxx)` 这个方法创建对象。



##### 创建 Bean 实例-AbstractAutowireCapableBeanFactory#createBean(xxx)







