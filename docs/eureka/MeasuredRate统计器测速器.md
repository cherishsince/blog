# MeasuredRate 测速器

### 概述

`MeasuredRate` 是一个**测速器，或者是统计器**，在某一个时间段统计一个次数 (`eureka` 里面大量使用 `Timer` 和 **耗时统计**)，Eureka 主要使用再一下几个地方：

1. 每分钟心跳的次数，做自我保护使用。
2. 最后一分钟的复制次数，这个用于集群复制，只是做一个统计，用于监听。

### 开始分析

代码如下：

```java
/**
 * 实用程序类，用于获取过去X毫秒内的计数。
 * <p>
 * Utility class for getting a count in last X milliseconds.
 *
 * @author Karthik Ranganathan,Greg Kim
 */
public class MeasuredRate {
    private static final Logger logger = LoggerFactory.getLogger(MeasuredRate.class);
    /**
     * 上一次统计的次数
     */
    private final AtomicLong lastBucket = new AtomicLong(0);
    /**
     * 当前统计的次数
     */
    private final AtomicLong currentBucket = new AtomicLong(0);

    private final long sampleInterval;
    /**
     * 定时器
     */
    private final Timer timer;
    /**
     * 是否激活(start 的时候激活)
     */
    private volatile boolean isActive;

    /**
     * @param sampleInterval in milliseconds
     */
    public MeasuredRate(long sampleInterval) {
        this.sampleInterval = sampleInterval;
        this.timer = new Timer("Eureka-MeasureRateTimer", true);
        this.isActive = false;
    }

    public synchronized void start() {
        if (!isActive) {
            timer.schedule(new TimerTask() {

                @Override
                public void run() {
                    try {
                        // 将当前存储桶清零，并保存到 lastBucket
                        // Zero out the current bucket.
                        lastBucket.set(currentBucket.getAndSet(0));
                    } catch (Throwable e) {
                        logger.error("Cannot reset the Measured Rate", e);
                    }
                }
            }, sampleInterval, sampleInterval);
            isActive = true;
        }
    }

    public synchronized void stop() {
        if (isActive) {
            timer.cancel();
            isActive = false;
        }
    }

    /**
     * 获取上一次统计的 count
     * <p>
     * Returns the count in the last sample interval.
     */
    public long getCount() {
        return lastBucket.get();
    }

    /**
     * 次数 +1
     * <p>
     * Increments the count in the current sample interval.
     */
    public void increment() {
        currentBucket.incrementAndGet();
    }
}
```

说明：

- **MeasuredRate** 统计用的是 Java 的 Timer，在某一段时间内进行统计，在初始化的时候可以设置统计时间(毫秒)。
- **lastBucket** 和 **currentBucket** 是一个 `AtomicLong` 那么在设置值的时候是，CAS 机制能够保证线程安全。
- **lastBucket** 是上一次统计的数据，**currentBucket **是当前统计的数据。
- **start()** 是一个比较重要的方法，会定时调用这个 TaskTimer，将当前统计的数据，放到 **lastBucket** 并清空 **currentBucket**。

### 续租每分钟次数

代码如下：

```java
// AbstractInstanceRegistry
public boolean renew(String appName, String id, boolean isReplication) {
    // 略...

    // <2> 续租每分钟次数 +1
    renewsLastMin.increment();
    // <3> 设置 租约最后更新时间（续租）
    leaseToRenew.renew();
    return true;
}
```

说明：

- eureka server 在每次续约的时候，每次都会+1，用于统计。

完结~

## 问答

1. `Eureka` 的自我保护，是怎么去统计的？

   通过 `MeasuredRate` 进行统计，每次 `renew()` 续约的时候，都会进行+1

2. `Eureka` 中的 `MeasuredRate` 主要用在那些地方？

   两个地方，1.续约次数统计 2.集群复制的统计

​
