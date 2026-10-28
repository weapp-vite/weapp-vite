import type { RuntimeScheduler } from '../../kernel/scheduler'
import type { HeadlessWxCallbackOption } from './core'

const queues = new WeakMap<object, StartupNavigationQueue>()

/** 冷启动先完成 App 与首屏装载，再顺序提交启动钩子请求的导航。 */
export class StartupNavigationQueue {
  private collecting = false
  private readonly pending: Array<() => void> = []

  constructor(private readonly scheduler: RuntimeScheduler) {}

  capture(operation: () => void) {
    this.collecting = true
    try {
      operation()
    }
    catch (error) {
      this.pending.length = 0
      throw error
    }
    finally {
      this.collecting = false
    }
  }

  run<TOption extends HeadlessWxCallbackOption>(option: TOption | undefined, operation: (option: TOption | undefined) => unknown) {
    if (!this.collecting) {
      const submitted = option && { ...option }
      // 先退出当前调用栈再提交宿主任务，让当前页面的 ready 与路由完成先交付。
      this.scheduler.queueMicrotask(() => {
        this.scheduler.setTimeout(() => operation(submitted), 0)
      })
      return
    }
    // 队列已保证退出 App 启动栈；提交导航时直接交付回调，先于目标页的 ready。
    const scheduler = this.scheduler
    const isolate = <T extends (...args: any[]) => void>(callback: T | undefined) => callback
      ? function (this: unknown, ...args: Parameters<T>) {
        try {
          callback.apply(this, args)
        }
        catch (error) {
          // 业务回调异常交给原有诊断通道，不能被宿主误判成导航失败。
          scheduler.setTimeout(() => {
            throw error
          }, 0)
        }
      }
      : undefined
    const submitted = option && {
      ...option,
      success: isolate(option.success),
      fail: isolate(option.fail),
      complete: isolate(option.complete),
    }
    this.pending.push(() => {
      operation(submitted)
    })
  }

  flush() {
    const pending = this.pending.splice(0)
    for (const operation of pending) {
      operation()
    }
  }
}

/** 内部绑定保持 driver 的公开形状不变，两种 runtime 共享启动调度。 */
export function bindStartupNavigation<T extends object>(driver: T, queue: StartupNavigationQueue): T {
  queues.set(driver, queue)
  return driver
}

export function runNavigationApi<TOption extends HeadlessWxCallbackOption>(
  driver: object,
  option: TOption | undefined,
  operation: (option: TOption | undefined) => unknown,
) {
  const queue = queues.get(driver)
  return queue ? queue.run(option, operation) : operation(option)
}
