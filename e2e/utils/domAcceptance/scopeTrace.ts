import type { DomProvider, DomScope } from './types'
import { performance } from 'node:perf_hooks'
import process from 'node:process'

const traceCheckpointsEnv = 'WEAPP_VITE_E2E_DOM_SCOPE_TRACE_CHECKPOINTS'
let nextTraceId = 0

type ScopeTraceStage = 'attempt' | 'route' | 'scope-query' | 'scope-filter' | 'scope-candidate' | 'node-query' | 'node-assertions' | 'final-route'

interface ScopeTraceDetails {
  attempt: number
  nodeIndex?: number
  scopeIndex?: number
  scope?: DomScope
  selector?: string
  candidateIndex?: number
  candidateCount?: number
}

interface ScopeTraceResult {
  count?: number
  status?: 'passed' | 'failed'
  error?: string
}

/** 仅为显式列出的检查点记录现有查询，不增加查询、改变断言或调整原预算。 */
export function createDomScopeTrace(checkpoint: string, provider: DomProvider, deadline: number) {
  const enabled = process.env[traceCheckpointsEnv]?.split(',').map(value => value.trim()).includes(checkpoint)
  if (!enabled) {
    return undefined
  }
  const traceId = ++nextTraceId
  const started = performance.now()
  function write(event: Record<string, unknown>) {
    try {
      process.stdout.write(`[dom-scope-trace] ${JSON.stringify({
        checkpoint,
        provider,
        traceId,
        recordedAt: new Date().toISOString(),
        elapsedMs: performance.now() - started,
        remainingMs: Math.max(0, deadline - Date.now()),
        ...event,
      })}\n`)
    }
    catch {
      // 诊断输出失败不能覆盖原查询结果或原始异常。
    }
  }
  return {
    start(stage: ScopeTraceStage, details: ScopeTraceDetails) {
      const spanStarted = performance.now()
      write({ stage, event: 'begin', ...details })
      return {
        end(result: ScopeTraceResult = {}) {
          write({ stage, event: 'end', ...details, durationMs: performance.now() - spanStarted, ...result })
        },
      }
    },
  }
}
