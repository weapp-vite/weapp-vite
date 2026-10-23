import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import { performance } from 'node:perf_hooks'

export type WorkspaceHmrStagePhase = 'update' | 'restore' | 'repeat' | 'cleanup'

export interface WorkspaceHmrStageTiming {
  phase: WorkspaceHmrStagePhase
  step: string
  startedAtMs: number
  endedAtMs?: number
  elapsedMs?: number
  remainingBeforeMs?: number
  remainingAfterMs?: number
  status: 'running' | 'complete' | 'failed'
  errorName?: string
  errorCode?: string
}

export interface WorkspaceHmrStageReport {
  stageTimings?: WorkspaceHmrStageTiming[]
  failedStage?: { phase: WorkspaceHmrStagePhase, step: string }
  cleanupFailedStage?: { phase: 'cleanup', step: string }
}

export type WorkspaceHmrStageObserver = <T>(step: string, action: () => T | Promise<T>) => Promise<T>

/** 只记录原有操作，不创建预算、改变错误或让清理结果覆盖正式验收阶段。 */
export function createWorkspaceHmrStageRecorder(report: WorkspaceHmrStageReport) {
  const startedAt = performance.now()
  const timings = report.stageTimings ??= []
  return {
    phase(phase: WorkspaceHmrStagePhase, budget?: WorkspaceHmrAuditBudget): WorkspaceHmrStageObserver {
      return async (step, action) => {
        const timing: WorkspaceHmrStageTiming = {
          phase,
          step,
          startedAtMs: performance.now() - startedAt,
          ...(budget ? { remainingBeforeMs: budget.deadline - Date.now() } : {}),
          status: 'running',
        }
        timings.push(timing)
        try {
          const value = await action()
          timing.status = 'complete'
          return value
        }
        catch (error) {
          timing.status = 'failed'
          if (error instanceof Error) {
            timing.errorName = error.name
          }
          if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
            timing.errorCode = error.code
          }
          if (phase === 'cleanup') {
            report.cleanupFailedStage ??= { phase, step }
          }
          else {
            report.failedStage ??= { phase, step }
          }
          throw error
        }
        finally {
          timing.endedAtMs = performance.now() - startedAt
          timing.elapsedMs = timing.endedAtMs - timing.startedAtMs
          if (budget) {
            timing.remainingAfterMs = budget.deadline - Date.now()
          }
        }
      }
    },
  }
}
