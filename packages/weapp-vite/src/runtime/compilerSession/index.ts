import type { InitializeCompilerContextOptions } from './context'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { retainWatcherService } from '../watcherPlugin'
import { initializeCompilerContext } from './context'

export type CompilerSessionState = 'created' | 'preparing' | 'ready' | 'building' | 'watching' | 'closing' | 'closed'

/** CLI 和宿主插件共用的资源所有者；只等待并关闭本会话创建的资源。 */
export class CompilerSession {
  state: CompilerSessionState = 'created'
  readonly context = createCompilerContextInstance()
  private readonly pending = new Set<Promise<unknown>>()
  private readonly cleanup = new Set<() => void | Promise<void>>()
  private readonly release = retainWatcherService(this.context.watcherService)
  private closing?: Promise<void>

  get isClosing() {
    return this.state === 'closing' || this.state === 'closed'
  }

  onClose(cleanup: () => void | Promise<void>) {
    if (this.isClosing) {
      throw new Error('[weapp-vite] 关闭中的会话不能接管新资源。')
    }
    this.cleanup.add(cleanup)
  }

  private track<T>(operation: () => Promise<T>): Promise<T> {
    const task = Promise.resolve().then(operation)
    this.pending.add(task)
    void task.then(() => this.pending.delete(task), () => this.pending.delete(task))
    return task
  }

  initialize(options: InitializeCompilerContextOptions) {
    if (this.state !== 'created') {
      throw new Error(`[weapp-vite] 无法从 ${this.state} 状态初始化会话。`)
    }
    this.state = 'preparing'
    return this.track(async () => {
      const context = await initializeCompilerContext(this.context, options)
      if (this.state !== 'preparing') {
        throw new Error('[weapp-vite] 编译会话已关闭。')
      }
      this.state = 'ready'
      return context
    })
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state !== 'ready' && this.state !== 'building' && this.state !== 'watching') {
      return Promise.reject(new Error(`[weapp-vite] 无法从 ${this.state} 状态执行编译任务。`))
    }
    if (this.state === 'ready') {
      this.state = 'building'
    }
    return this.track(operation)
  }

  close(): Promise<void> {
    return this.closing ??= (async () => {
      this.state = 'closing'
      await Promise.allSettled([...this.pending])
      const errors: unknown[] = []
      try {
        for (const cleanup of [...this.cleanup].reverse()) {
          try {
            await cleanup()
          }
          catch (error) {
            errors.push(error)
          }
        }
        this.cleanup.clear()
        try {
          await this.release()
        }
        catch (error) {
          errors.push(error)
        }
      }
      finally {
        this.state = 'closed'
      }
      if (errors.length) {
        throw new AggregateError(errors, 'Compiler session resource cleanup failed')
      }
    })()
  }
}
