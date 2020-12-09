# 深入分析-ExecutorService

ExecutorService 中提供了，我们业务需要的一些任务执行工具，比如 invokerALL 和 invokerAny 方法。

像数据聚合，和请求并发调用，都可以采用这种方式。

### Future

##### get()方法

方法 get（）将阻止执行，直到任务完成。但是我们不必担心，因为我们的示例只是在确保任务完成后才调用 get（）。因此，在这种情况下，future.get（）将始终立即返回。

##### 使用 cancel()取消 Future

假设我们已经触发了一项任务，但由于某种原因，我们不再关心结果了。我们可以使用 Future.cancel（boolean）告诉执行程序停止操作并中断其底层线程：

```java
Future<Integer> future = new SquareCalculator().calculate(4);
boolean canceled = future.cancel(true);
```

### invokeAll 方法

```java
public <T> List<Future<T>> invokeAll(Collection<? extends Callable<T>> tasks,
                                     long timeout, TimeUnit unit)
    throws InterruptedException {
    // 任务不能为空
    if (tasks == null || unit == null)
        throw new NullPointerException();
    // <1> 转换为微秒
    long nanos = unit.toNanos(timeout);
    // <2> 创建 Futuer 任务回调
    List<Future<T>> futures = new ArrayList<Future<T>>(tasks.size());
    // 是否结束标识
    boolean done = false;
    try {
        // <3> task 转换为 Futuer任务
        for (Callable<T> t : tasks)
            futures.add(newTaskFor(t));

        long lastTime = System.nanoTime();

        // Interleave time checks and calls to execute in case
        // executor doesn't have any/much parallelism.
        Iterator<Future<T>> it = futures.iterator();
        while (it.hasNext()) {
            // <4> 调用线程池 execute 添加任务
            execute((Runnable)(it.next()));
            long now = System.nanoTime();
            nanos -= now - lastTime;
            lastTime = now;
            // 超时时间为 0 直接返回
            if (nanos <= 0)
                return futures;
        }

        // 迭代 Futuer 任务
        for (Future<T> f : futures) {
            // <5> 检查任务是否完成，并检查超时时间
            if (!f.isDone()) {
                // 超时时间 = 0，直接返回
                if (nanos <= 0)
                    return futures;
                try {
                    // <6> 有超时时间，调用 f.get()
                    f.get(nanos, TimeUnit.NANOSECONDS);
                } catch (CancellationException ignore) {
                } catch (ExecutionException ignore) {
                } catch (TimeoutException toe) {
                    return futures;
                }
                long now = System.nanoTime();
                nanos -= now - lastTime;
                lastTime = now;
            }
        }
       // <7> 完成任务
        done = true;
        return futures;
    } finally {
        // <8> 没有完成的任务，要关闭。
        if (!done)
            for (Future<T> f : futures)
                f.cancel(true);
    }
}
```

- 采用 Futuer 任务的形式，回调任务。
- 任务分为两部分 1、转换为 Futuer 2、添加到 Execute 去执行 3、回调所有 Futuer 任务。

### invokeAny

```java
/**
 * the main mechanics of invokeAny.
 */
private <T> T doInvokeAny(Collection<? extends Callable<T>> tasks,
                        boolean timed, long nanos)
    throws InterruptedException, ExecutionException, TimeoutException {
    // 任务不能为空
    if (tasks == null)
        throw new NullPointerException();
    // <1> 任务大小
    int ntasks = tasks.size();
    if (ntasks == 0)
        throw new IllegalArgumentException();
    // Futuer 任务
    List<Future<T>> futures= new ArrayList<Future<T>>(ntasks);
    ExecutorCompletionService<T> ecs =
        new ExecutorCompletionService<T>(this);

    // For efficiency, especially in executors with limited
    // parallelism, check to see if previously submitted tasks are
    // done before submitting more of them. This interleaving
    // plus the exception mechanics account for messiness of main
    // loop.

    try {
        // Record exceptions so that if we fail to obtain any
        // result, we can throw the last exception we got.
        ExecutionException ee = null;
        long lastTime = timed ? System.nanoTime() : 0;
        Iterator<? extends Callable<T>> it = tasks.iterator();

        // Start one task for sure; the rest incrementally
        futures.add(ecs.submit(it.next()));
        --ntasks;
        int active = 1;

        for (;;) {
            // <1> 里面是一个 BlockingQueue 没有任务是返回 null
            Future<T> f = ecs.poll();
            if (f == null) {
                // <2> 大于0 代表还有数据，继续添加任务
                if (ntasks > 0) {
                    --ntasks;
                    futures.add(ecs.submit(it.next()));
                    // <3> 激活数量
                    ++active;
                }
                else if (active == 0)
                    // <4> 没有任务就退出
                    break;
                else if (timed) {
                   // <5> poll 超时动作，直接退出(单个任务)，一般不会进，只有任务 =0 进入
                   // 如果超过这个时间，还没有任务过来，直接 timeOut 异常
                    f = ecs.poll(nanos, TimeUnit.NANOSECONDS);
                    if (f == null)
                        throw new TimeoutException();
                    long now = System.nanoTime();
                    nanos -= now - lastTime;
                    lastTime = now;
                }
                else
                    f = ecs.take();
            }
            // <5> 获取 Futuer 任务数据
            if (f != null) {
                --active;
                try {
                    return f.get();
                } catch (ExecutionException eex) {
                    ee = eex;
                } catch (RuntimeException rex) {
                    ee = new ExecutionException(rex);
                }
            }
        }

        if (ee == null)
            ee = new ExecutionException();
        throw ee;

    } finally {
        for (Future<T> f : futures)
            f.cancel(true);
    }
}
```

- **invokeAny 不是一次性提交所有任务，而是挨个尝试，只要有一个成功就返回。**
