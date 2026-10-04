import { AsyncLocalStorage } from 'node:async_hooks'
import process from 'node:process'

type OperationPhase = 'startup' | 'restart' | 'cleanup'
type ShutdownReason = 'SIGINT' | 'SIGTERM' | 'disconnect' | 'stdin' | 'close'
type Cleanup = () => void | Promise<void>

interface Operation {
  scope: DevShutdownScope
  phase: OperationPhase
  active: boolean
}

const operations = new AsyncLocalStorage<Operation>()

/** 获取当前开发命令的资源归属；异步回调可以继承归属，但不能继承已结束的内部操作权限。 */
export function getDevShutdownScope(): DevShutdownScope | undefined {
  return operations.getStore()?.scope
}

export interface DevShutdownOptions {
  reportError?: (error: unknown) => void
}

/** 开发命令统一持有退出请求、在途启动与资源释放，Vite 只能在全部收尾后结束进程。 */
export class DevShutdownScope {
  private readonly requested = Promise.withResolvers<void>()
  private readonly completed = Promise.withResolvers<void>()
  private readonly pending = new Set<Promise<unknown>>()
  private readonly cleanups = new Set<Cleanup>()
  private readonly errors = new Set<unknown>()
  private closing?: Promise<void>
  private failure?: unknown
  private finished = false
  private reason?: ShutdownReason

  readonly signal = this.requested.promise
  readonly done = this.completed.promise

  constructor(private readonly options: DevShutdownOptions = {}) {
    // 在任何内部操作之外注册；实际 OS 信号不能继承启动或清理的权限。
    process.on('SIGINT', this.onSigint)
    process.on('SIGTERM', this.onSigterm)
    process.on('disconnect', this.onDisconnect)
    process.stdin?.on?.('end', this.onStdinEnd)
    if (process.connected === false) {
      this.request('disconnect')
    }
  }

  get stopping(): boolean {
    return this.reason !== undefined
  }

  isInternalOperation(): boolean {
    const operation = operations.getStore()
    return operation?.scope === this && operation.active
  }

  run<T>(phase: OperationPhase, action: () => T | Promise<T>): Promise<T> {
    if (this.finished) {
      return Promise.reject(new Error('Cannot start an operation after development shutdown completed'))
    }
    // 外部已开始的 close 也必须结算，即使重启交接随后注销了旧代资源归属。
    const tracked = phase !== 'cleanup' || !this.isInternalOperation()
    const operation: Operation = { scope: this, phase, active: true }
    const task = operations.run(operation, async () => {
      try {
        return await action()
      }
      catch (error) {
        if (this.stopping) {
          this.errors.add(error)
        }
        throw error
      }
      finally {
        operation.active = false
      }
    })
    if (tracked) {
      this.pending.add(task)
      void task.finally(() => this.pending.delete(task)).catch(() => {})
    }
    return task
  }

  own(cleanup: Cleanup): () => void {
    if (this.finished) {
      throw new Error('Cannot acquire a resource after development shutdown completed')
    }
    this.cleanups.add(cleanup)
    return () => {
      this.cleanups.delete(cleanup)
    }
  }

  request(reason: ShutdownReason = 'close'): void {
    if (!this.reason) {
      this.reason = reason
      this.requested.resolve()
    }
    // 延后一轮，保证当前同步 acquisition 先登记为在途操作。
    this.closing ??= Promise.resolve().then(() => this.drain())
  }

  async close(error?: unknown): Promise<void> {
    if (error !== undefined) {
      this.errors.add(error)
    }
    this.request()
    await this.done
    if (this.errors.size) {
      throw this.failure
    }
  }

  private readonly onSigint = () => this.request('SIGINT')
  private readonly onSigterm = () => this.request('SIGTERM')
  private readonly onDisconnect = () => this.request('disconnect')
  private readonly onStdinEnd = () => this.request('stdin')

  private async drain(): Promise<void> {
    try {
      // 启动/重启失败后的局部 close 不得反向等待本 Promise。
      while (this.pending.size || this.cleanups.size) {
        if (this.pending.size) {
          const results = await Promise.allSettled([...this.pending])
          for (const result of results) {
            if (result.status === 'rejected') {
              this.errors.add(result.reason)
            }
          }
          continue
        }
        const cleanup = [...this.cleanups].at(-1)!
        this.cleanups.delete(cleanup)
        try {
          await this.run('cleanup', cleanup)
        }
        catch (error) {
          this.errors.add(error)
        }
      }
      if (this.errors.size) {
        const errors = [...this.errors]
        this.failure = errors.length === 1 ? errors[0] : new AggregateError(errors, 'Development shutdown failed', { cause: errors[0] })
        process.exitCode = 1
        // Vite 的 close 回调随后可能立即 process.exit，诊断不能留给外层 catch。
        try {
          this.options.reportError?.(this.failure)
        }
        catch (reportError) {
          // 报告器失败也不能阻止完成门禁或产生无人消费的拒绝。
          process.stderr?.write?.(`Development shutdown error: ${String(this.failure)}; reporting failed: ${String(reportError)}\n`)
        }
      }
      else if (!process.exitCode) {
        process.exitCode = this.reason === 'SIGINT' ? 130 : this.reason === 'SIGTERM' ? 143 : 0
      }
    }
    finally {
      this.finished = true
      process.off('SIGINT', this.onSigint)
      process.off('SIGTERM', this.onSigterm)
      process.off('disconnect', this.onDisconnect)
      process.stdin?.off?.('end', this.onStdinEnd)
      if (process.connected) {
        process.disconnect?.()
      }
      this.completed.resolve()
    }
  }
}

export function createDevShutdownScope(options?: DevShutdownOptions): DevShutdownScope {
  return new DevShutdownScope(options)
}
