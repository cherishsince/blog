# 组件-8-Event和Listener

我们了解一下 Spring 的事件，时间采用的是 **观察者模式** ，组成部分是 `Event`、`Listener`、`管理器` 分为这三部分，我们看一下 `Spring` 的这三个部分：

##### 第一部分 ApplicationEvent

```java
// ApplicationEvent
public abstract class ApplicationEvent extends EventObject {
	/**
	 * 这里设置 serialVersionUID 为了版本兼容(1.2开始)
	 */
	private static final long serialVersionUID = 7099057708183571937L;
	/**
	 * event发生的时间
	 */
	private final long timestamp;
	/**
	 * 创建一个新的 ApplicationEvent
	 */
	public ApplicationEvent(Object source) {
		super(source);
		this.timestamp = System.currentTimeMillis();
	}
	/**
	 * 返回这个 event 系统时间(毫秒)
	 */
	public final long getTimestamp() {
		return this.timestamp;
	}
}
```

说明：

这里记录了 `Event` 发生时候的时间， **特别注意** `extends` 了一个 `java.util.EventObject` ，使用了 `java` 的 `EventObject	` 里面保存了一个 `object 类型的 source` 代码如下：

```java
public class EventObject implements java.io.Serializable {

    private static final long serialVersionUID = 5516075349620653480L;
	// <1> transient 是序列化的时候，不处理这个属性
    protected transient Object  source;

    public EventObject(Object source) {
        if (source == null)
            throw new IllegalArgumentException("null source");

        this.source = source;
    }

    public Object getSource() {
        return source;
    }

    public String toString() {
        return getClass().getName() + "[source=" + source + "]";
    }
}
```

说明：

- <1> transient 是序列化的时候，不处理这个属性。



##### 第二部分 ApplicationListener

```java
// ApplicationListener
public interface ApplicationListener<E extends ApplicationEvent> extends EventListener {

	/**
	 * 处理一个 application event
	 */
	void onApplicationEvent(E event);
}
```

说明：

这里就一个 `onApplicationEvent` 方法，用于处理一个 `Event` 事件。



##### 第三部分 ApplicationEventMulticaster

这是一个 `Spring` 事件的管理器，用于事件的处理，代码如下：

```java
// ApplicationEventMulticaster
public interface ApplicationEventMulticaster {
	/**
	 * 添加一个 Listener
	 */
	void addApplicationListener(ApplicationListener<?> listener);
	/**
	 * 添加一个 ListenerBean
	 */
	void addApplicationListenerBean(String listenerBeanName);
	/**
	 * 删除一个 Listener
	 */
	void removeApplicationListener(ApplicationListener<?> listener);
	/**
	 * 删除一个 ListenerBean
	 */
	void removeApplicationListenerBean(String listenerBeanName);
	/**
	 * 删除所有 multicaster listener。
	 * 删除 listener后，multicaster 程序将不会对事件通知执行任何操作，直到注册了新的侦听器为止。
	 */
	void removeAllListeners();
	/**
	 * 将应用程序 Event 给适当的 Listener。
	 */
	void multicastEvent(ApplicationEvent event);
	/**
	 * 将应用程序 Event 给适当的 Listener。
	 */
	void multicastEvent(ApplicationEvent event, @Nullable ResolvableType eventType);
}
```

说明：

可以看出，有对 Listener 增加、删除、获取等功能，以及 event 的事件通知，都在这里面实现，简单点就是对所有的 Listener 进行 for 循环遍历调用 onApplicationEvent 方法通知对于的 Listener，

我们看一下他的关系图


    
    ![image-20200624100853013](C:\Users\Sin\AppData\Roaming\Typora\typora-user-images\image-20200624100853013.png)



我们正常使用的是 `SimpleApplicationEventMulticaster` 进行事件的处理，里面逻辑很简单，有兴趣的可以瞅瞅~





ps：完结~

