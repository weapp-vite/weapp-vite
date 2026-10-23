import type { DomProvider, DomQuery, DomScope } from './types'

interface QueryTrace {
  target: 'page' | 'scope' | 'scope-descendant' | 'node-descendant' | 'session'
  selector: string
  query?: DomQuery
  startedMs: number
  durationMs?: number
  count?: number
  failed?: boolean
}

interface AttemptTrace {
  attempt: number
  startedMs: number
  remainingMs: number
  durationMs?: number
  queries: QueryTrace[]
  droppedQueries: number
  scopes: Array<{ scope: DomScope, candidates: number, matches: number }>
  error?: { message: string, atMs: number, remainingMs: number, usedAsLastError: boolean }
}

/** 只采集既有操作的时间与数量，失败后统一输出，避免诊断触发新查询或微任务。 */
export class DomCheckpointTrace {
  private readonly startedAt: number
  private readonly attempts: AttemptTrace[] = []
  private totalAttempts = 0
  private current!: AttemptTrace
  private activeQuery?: QueryTrace

  constructor(private readonly deadline: number, private readonly timeout: number) {
    this.startedAt = deadline - timeout
  }

  beginAttempt() {
    const now = Date.now()
    this.current = {
      attempt: ++this.totalAttempts,
      startedMs: now - this.startedAt,
      remainingMs: this.deadline - now,
      queries: [],
      droppedQueries: 0,
      scopes: [],
    }
    this.attempts.push(this.current)
    if (this.attempts.length > 16) {
      this.attempts.shift()
    }
  }

  beginQuery(target: QueryTrace['target'], selector: string, query?: DomQuery) {
    const entry: QueryTrace = { target, selector, query, startedMs: Date.now() - this.startedAt }
    this.activeQuery = entry
    // 保留首批页面查询及最近的组件查询，避免大型页面诊断无限增长。
    if (this.current.queries.length >= 128) {
      this.current.queries.splice(16, 1)
      this.current.droppedQueries++
    }
    this.current.queries.push(entry)
  }

  endQuery(count?: number) {
    if (this.activeQuery) {
      this.activeQuery.durationMs = Date.now() - this.startedAt - this.activeQuery.startedMs
      this.activeQuery.count = count
      this.activeQuery = undefined
    }
  }

  scope(scope: DomScope, candidates: number, matches: number) {
    this.current.scopes.push({ scope, candidates, matches })
  }

  fail(error: unknown, now: number, usedAsLastError: boolean) {
    if (this.activeQuery) {
      this.activeQuery.durationMs = now - this.startedAt - this.activeQuery.startedMs
      this.activeQuery.failed = true
      this.activeQuery = undefined
    }
    this.current.durationMs = now - this.startedAt - this.current.startedMs
    this.current.error = {
      message: error instanceof Error ? error.message : String(error),
      atMs: now - this.startedAt,
      remainingMs: this.deadline - now,
      usedAsLastError,
    }
  }

  report(checkpoint: string, provider: DomProvider) {
    try {
      // eslint-disable-next-line no-console
      console.error('[dom-checkpoint-failure-trace]', JSON.stringify({
        checkpoint,
        provider,
        startedAt: new Date(this.startedAt).toISOString(),
        timeoutMs: this.timeout,
        elapsedMs: Date.now() - this.startedAt,
        totalAttempts: this.totalAttempts,
        droppedAttempts: this.totalAttempts - this.attempts.length,
        attempts: this.attempts,
      }))
    }
    catch {
      // 诊断输出失败不能覆盖原始 DOM 断言错误。
    }
  }
}
