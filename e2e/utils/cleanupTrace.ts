import process from 'node:process'

type CleanupTraceStage
  = 'stateful-dev-stop'
    | 'stateful-restore-source'
    | 'stateful-residual-dev'
    | 'stateful-residual-ide'
    | 'stateful-fixture-remove'
    | 'dev-capture'
    | 'dev-reconcile'
    | 'dev-recheck-unconfirmed'
    | 'dev-cim-snapshot'
    | 'dev-cim-identities'
    | 'dev-taskkill'
    | 'dev-ipc-exit'
    | 'dev-owned-exit'
    | 'dev-stdio-drain'

interface CleanupTraceOptions {
  defaultOnWindows?: boolean
  processCount?: number
  timeoutMs?: number
}

let sequence = 0

/** 只记录固定阶段和数值，不采集命令、路径、身份或错误正文，也不改变原操作的结果与预算。 */
export function traceCleanupStage<T>(stage: CleanupTraceStage, operation: () => Promise<T>, options: CleanupTraceOptions = {}): Promise<T> {
  const enabled = process.env.WEAPP_VITE_E2E_CLEANUP_TRACE === '1'
    || (process.env.WEAPP_VITE_E2E_CLEANUP_TRACE === undefined && options.defaultOnWindows && process.platform === 'win32')
  if (!enabled) {
    return operation()
  }
  const id = ++sequence
  const started = performance.now()
  const emit = (event: 'begin' | 'end' | 'error', completed?: boolean) => {
    try {
      process.stdout.write(`[e2e-cleanup] ${JSON.stringify({
        id,
        stage,
        event,
        elapsedMs: Math.round((performance.now() - started) * 100) / 100,
        processCount: options.processCount,
        timeoutMs: options.timeoutMs,
        completed,
      })}\n`)
    }
    catch {
      // 诊断输出失败不能替换清理首错，也不能重试或跳过被观察的操作。
    }
  }
  emit('begin')
  try {
    return operation().then((result) => {
      emit('end', typeof result === 'boolean' ? result : undefined)
      return result
    }, (error: unknown) => {
      emit('error')
      throw error
    })
  }
  catch (error) {
    emit('error')
    throw error
  }
}
