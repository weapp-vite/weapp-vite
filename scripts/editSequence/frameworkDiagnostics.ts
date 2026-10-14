import { writeSync } from 'node:fs'
import process from 'node:process'

interface PhaseContext {
  mode: 'weapp-classic' | 'weapp-stateful'
  role: string
}

export type FrameworkPhase = 'source-write' | 'create-server' | 'listen' | 'runtime-start' | 'runtime-message' | 'settlement' | 'runtime-observe' | 'output-scan-before' | 'output-scan-after' | 'output-read' | 'runtime-close' | 'server-close'

export interface FrameworkPhaseEvent extends PhaseContext {
  id: number
  step: number | undefined
  phase: FrameworkPhase
  status: 'started' | 'completed' | 'failed'
  timeOrigin: number
  startedAtMs: number
  endedAtMs?: number
  elapsedMs?: number
  errorName?: string
}

export const FRAMEWORK_PHASE_PREFIX = '[edit-sequence-phase] '

class FrameworkPhaseDiagnostics {
  private sequence = 0
  private step?: number

  constructor(
    private readonly context: PhaseContext,
    private readonly observe: (event: FrameworkPhaseEvent) => void,
  ) {}

  setStep(step: number) {
    this.step = step
  }

  private emit(event: FrameworkPhaseEvent) {
    try {
      this.observe(event)
    }
    catch {
      // 旁路诊断传递失败不能替换原操作结果，也不能改变资源释放顺序。
    }
  }

  run<T>(phase: FrameworkPhase, operation: () => Promise<T>): Promise<T> {
    let event: FrameworkPhaseEvent
    try {
      event = {
        ...this.context,
        id: ++this.sequence,
        step: this.step,
        phase,
        status: 'started',
        timeOrigin: performance.timeOrigin,
        startedAtMs: performance.now(),
      }
    }
    catch {
      // 时钟不可用时沿用原操作；不能因诊断失败阻止执行或回收资源。
      return operation()
    }
    this.emit(event)
    const finish = (status: 'completed' | 'failed', error?: unknown) => {
      try {
        const endedAtMs = performance.now()
        this.emit({ ...event, status, endedAtMs, elapsedMs: endedAtMs - event.startedAtMs, ...(status === 'failed' ? { errorName: error instanceof Error ? error.name : 'non-error' } : {}) })
      }
      catch {
        // 保留已发出的开始边界；未知结束时间不能覆盖原结果或原错误。
      }
    }
    try {
      return operation().then((value) => {
        finish('completed')
        return value
      }, (error: unknown) => {
        finish('failed', error)
        throw error
      })
    }
    catch (error) {
      finish('failed', error)
      throw error
    }
  }
}

/** 私有 opt-in 阶段流由现有 collector 日志保存；停用时不读时钟或追加异步调度。 */
export function createFrameworkPhaseDiagnostics(enabled: boolean, context: PhaseContext, observe = (event: FrameworkPhaseEvent) => {
  // worker 会在正常关闭后 process.exit；同步流避免最后一个清理边界滞留在 stdout 队列。
  writeSync(process.stdout.fd, `${FRAMEWORK_PHASE_PREFIX}${JSON.stringify(event)}\n`)
}) {
  return enabled ? new FrameworkPhaseDiagnostics(context, observe) : undefined
}

/** 复用原操作与等待；不预热、不重试，不改变现有 deadline 或采样内容。 */
export function observeFrameworkPhase<T>(diagnostics: ReturnType<typeof createFrameworkPhaseDiagnostics>, phase: FrameworkPhase, operation: () => Promise<T>): Promise<T> {
  return diagnostics ? diagnostics.run(phase, operation) : operation()
}
