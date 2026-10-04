import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { onTestFailed } from 'vitest'

type PhaseStatus = 'started' | 'completed' | 'failed'

/** 仅在用例失败时输出阶段与相对耗时，不记录路径、输入内容或运行凭据。 */
export function acceptanceDiagnostics(fixture: string) {
  const startedAt = performance.now()
  const phases: Array<{ phase: string, status: PhaseStatus, elapsedMs: number }> = []
  const record = (phase: string, status: PhaseStatus) => {
    phases.push({ phase, status, elapsedMs: performance.now() - startedAt })
  }
  onTestFailed(() => {
    process.stderr.write(`[acceptance-test-diagnostic] ${JSON.stringify({ fixture, elapsedMs: performance.now() - startedAt, phases })}\n`)
  })
  return {
    record,
    async run<T>(phase: string, action: () => Promise<T>): Promise<T> {
      record(phase, 'started')
      try {
        const result = await action()
        record(phase, 'completed')
        return result
      }
      catch (error) {
        record(phase, 'failed')
        throw error
      }
    },
  }
}
