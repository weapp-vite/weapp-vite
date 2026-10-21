import { performance } from 'node:perf_hooks'

export interface TimingRecord {
  name: string
  startedAt: string
  durationMs: number
  status: 'passed' | 'failed'
  error?: string
}

/** 记录阶段耗时；记录失败不能掩盖原阶段错误。 */
export async function measurePhase<T>(name: string, operation: () => Promise<T>, sink?: (record: TimingRecord) => void): Promise<T> {
  const startedAt = new Date().toISOString()
  const started = performance.now()
  try {
    const value = await operation()
    sink?.({ name, startedAt, durationMs: performance.now() - started, status: 'passed' })
    return value
  }
  catch (error) {
    try {
      sink?.({ name, startedAt, durationMs: performance.now() - started, status: 'failed', error: error instanceof Error ? error.message : String(error) })
    }
    catch {
      // 失败阶段的原始异常拥有优先权。
    }
    throw error
  }
}
