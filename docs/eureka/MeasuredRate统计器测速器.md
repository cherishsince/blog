# MeasuredRate测速器

**MeasuredRate** 是一个**测速器，或者是统计器**，在某一个时间段统计一个次数。代码如下：

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
- **lastBucket** 和 **currentBucket** 是一个 `AtomicLong` 那么在设置值的时候是，CAS机制能够保证线程安全。
- **lastBucket** 是上一次统计的数据，**currentBucket **是当前统计的数据。
- **start()**  是一个比较重要的方法，会定时调用这个 TaskTimer，将当前统计的数据，放到 **lastBucket**  并清空 **currentBucket**。



完结~



