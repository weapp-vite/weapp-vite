import type { OperationErrorCategory } from './errors'
import { classifyOperationError, OPERATION_TIMEOUT_CODE } from './errors'

export * from './errors'
export * from './login'

export interface OperationStepOptions<T> {
  stage?: string
  waitForExit?: boolean
  disposeLate?: (value: T) => void | Promise<void>
}

export interface OperationDiagnostics {
  version: 1
  inner?: OperationDiagnostics
  category?: OperationErrorCategory
  stage: string
  lastSuccessfulStage?: string
  elapsedMs: number
  remainingMs: number
  attempts: number
  pendingOperations: number
  cleanup: Array<{ resource: string, status: 'released' | 'failed' | 'pending' }>
}

const errorDiagnostics = new WeakMap<Error, OperationDiagnostics>()

/** 一次操作共享绝对截止时间；超时取消底层 I/O，并隔离迟到结果。 */
export class OperationLifecycle {
  readonly controller = new AbortController()
  readonly signal = this.controller.signal
  readonly deadlineAt: number
  private cleanupDeadlineAt: number
  private readonly startedAt = performance.now()
  private readonly pendingExits = new Set<Promise<unknown>>()
  private readonly cleanups = new Map<() => void | Promise<void>, string>()
  private readonly cleanupResults: OperationDiagnostics['cleanup'] = []
  private readonly timeoutError: Error
  private stage = 'initialization'
  private lastSuccessfulStage?: string
  private attempts = 0
  private lastFailure: unknown

  constructor(timeoutMs: number, label: string, signal?: AbortSignal) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError('Operation timeout must be a positive finite number')
    }
    this.deadlineAt = this.startedAt + timeoutMs
    this.cleanupDeadlineAt = this.deadlineAt
    this.timeoutError = Object.assign(new Error(`Timeout in ${label} after ${timeoutMs}ms`), { code: OPERATION_TIMEOUT_CODE })
    if (signal) {
      const abort = () => this.controller.abort(signal.reason)
      if (signal.aborted) {
        abort()
      }
      else {
        signal.addEventListener('abort', abort, { once: true })
        this.detachParent = () => signal.removeEventListener('abort', abort)
      }
    }
  }

  private detachParent = () => {}

  get timedOut() {
    return this.signal.aborted && this.signal.reason === this.timeoutError
  }

  get diagnostics(): OperationDiagnostics {
    return {
      version: 1,
      stage: this.stage,
      lastSuccessfulStage: this.lastSuccessfulStage,
      elapsedMs: Math.max(0, performance.now() - this.startedAt),
      remainingMs: Math.max(0, this.deadlineAt - performance.now()),
      attempts: this.attempts,
      pendingOperations: this.pendingExits.size,
      cleanup: this.cleanupResults.map(entry => ({ ...entry })),
    }
  }

  attempt() {
    this.throwIfAborted()
    this.attempts += 1
  }

  recordFailure(error: unknown) {
    if (error !== this.timeoutError) {
      this.lastFailure = error
    }
  }

  throwIfAborted() {
    if (!this.signal.aborted && performance.now() >= this.deadlineAt) {
      this.controller.abort(this.timeoutError)
    }
    this.signal.throwIfAborted()
  }

  remainingMs(cap = Number.POSITIVE_INFINITY) {
    this.throwIfAborted()
    return Math.max(1, Math.min(cap, Math.ceil(this.deadlineAt - performance.now())))
  }

  own(cleanup: () => void | Promise<void>, resource = 'resource') {
    this.cleanups.set(cleanup, resource)
    if (this.signal.aborted) {
      this.release(cleanup, resource)
    }
    this.throwIfAborted()
    return () => this.cleanups.delete(cleanup)
  }

  private release(cleanup: () => void | Promise<void>, resource: string) {
    this.cleanups.delete(cleanup)
    const entry: OperationDiagnostics['cleanup'][number] = { resource, status: 'pending' }
    this.cleanupResults.push(entry)
    try {
      // 同步释放立即执行；异步清理最多消耗总 deadline 中的剩余预算。
      const result = cleanup()
      return Promise.resolve(result).then(() => {
        entry.status = 'released'
      }, () => {
        entry.status = 'failed'
      })
    }
    catch {
      entry.status = 'failed'
      return Promise.resolve()
    }
  }

  async step<T>(factory: () => Promise<T>, options: OperationStepOptions<T> = {}): Promise<T> {
    this.throwIfAborted()
    const stage = options.stage
    if (stage) {
      this.stage = stage
    }
    let removeAbort = () => {}
    const aborted = new Promise<never>((_resolve, reject) => {
      const onAbort = () => reject(this.signal.reason)
      this.signal.addEventListener('abort', onAbort, { once: true })
      removeAbort = () => this.signal.removeEventListener('abort', onAbort)
    })
    const operation = (async () => {
      this.throwIfAborted()
      return await factory()
    })().then(async (value) => {
      try {
        this.throwIfAborted()
      }
      catch (error) {
        await options.disposeLate?.(value)
        throw error
      }
      if (stage) {
        this.lastSuccessfulStage = stage
      }
      return value
    })
    if (options.waitForExit) {
      this.pendingExits.add(operation)
    }
    void operation.finally(() => this.pendingExits.delete(operation)).catch(() => {})
    try {
      return await Promise.race([operation, aborted])
    }
    finally {
      removeAbort()
    }
  }

  async phase<T>(timeoutMs: number, label: string, factory: (phase: OperationLifecycle) => Promise<T>) {
    const phase = new OperationLifecycle(this.remainingMs(timeoutMs), label, this.signal)
    phase.cleanupDeadlineAt = Math.min(this.deadlineAt, phase.deadlineAt + 250)
    return await this.step(() => phase.run(() => phase.step(() => factory(phase), { waitForExit: true })), { stage: label, waitForExit: true })
  }

  async pause(ms: number) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await this.step(() => new Promise<void>((resolve) => {
        timer = setTimeout(resolve, Math.min(ms, this.remainingMs()))
      }))
    }
    finally {
      clearTimeout(timer)
    }
  }

  private async cleanup() {
    const pending = [...this.pendingExits, ...[...this.cleanups].map(([cleanup, resource]) => this.release(cleanup, resource))]
    if (!pending.length) {
      return
    }
    if (performance.now() >= this.cleanupDeadlineAt) {
      await Promise.resolve()
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        Promise.allSettled(pending),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, Math.max(0, Math.min(250, this.cleanupDeadlineAt - performance.now()))) }),
      ])
    }
    finally {
      clearTimeout(timer)
    }
  }

  async run<T>(factory: (lifecycle: OperationLifecycle) => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      timer = setTimeout(() => this.controller.abort(this.timeoutError), this.remainingMs())
      return await this.step(() => factory(this))
    }
    catch (error) {
      this.controller.abort(error)
      await this.cleanup()
      if (error === this.timeoutError && this.lastFailure !== undefined) {
        Object.defineProperty(error, 'cause', { value: this.lastFailure, configurable: true })
      }
      if (error instanceof Error && Object.isExtensible(error)) {
        const inner = errorDiagnostics.get(error)
        const operation = { ...this.diagnostics, category: classifyOperationError(error), ...(inner ? { inner } : {}) }
        errorDiagnostics.set(error, operation)
        Object.assign(error, { operation })
      }
      throw error
    }
    finally {
      clearTimeout(timer)
      this.detachParent()
      this.cleanups.clear()
    }
  }
}
