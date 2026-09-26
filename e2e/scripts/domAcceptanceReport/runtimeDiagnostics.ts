import fs from 'node:fs'
import { z } from 'zod'

const eventSchema = z.object({
  recordedAt: z.iso.datetime().optional(),
  source: z.enum(['build', 'runtime']),
  kind: z.enum(['message', 'page-snapshot', 'stats']),
  project: z.string(),
  level: z.enum(['debug', 'info', 'log', 'warn', 'error', 'exception']).optional(),
  channel: z.string().optional(),
  route: z.string().optional(),
  text: z.string().optional(),
  acceptanceScope: z.object({ id: z.string().min(1), caseId: z.string().min(1), checkpointId: z.string().min(1), boundary: z.enum(['start', 'end']) }).optional(),
}).passthrough()

export const runtimeDiagnosticSchema = z.object({
  // 兼容读取旧报告；严格验收通过独立校验拒绝缺失的真实事件时间。
  recordedAt: z.iso.datetime().nullable().optional(),
  collectedAt: z.iso.datetime().optional(),
  observedAt: z.iso.datetime(),
  caseId: z.string().nullable(),
  phase: z.enum(['case', 'outside-case']),
  scopeId: z.string().optional(),
  checkpointId: z.string().optional(),
  event: eventSchema,
})

export type RuntimeDiagnostic = z.infer<typeof runtimeDiagnosticSchema>

/** 旧事件不能以批量读取时间冒充实际发生时间。 */
export function evaluateDiagnosticTimestamps(entries: RuntimeDiagnostic[]): string[] {
  return entries.flatMap((entry) => {
    if (!entry.recordedAt || !entry.collectedAt || entry.event.recordedAt !== entry.recordedAt
      || entry.observedAt !== entry.recordedAt
      || !Number.isFinite(Date.parse(entry.recordedAt)) || !Number.isFinite(Date.parse(entry.collectedAt))
      || Date.parse(entry.recordedAt) > Date.parse(entry.collectedAt)) {
      return ['IDE diagnostic event is missing a valid recordedAt/collectedAt boundary']
    }
    return []
  })
}

export class RuntimeDiagnosticJournal {
  readonly entries: RuntimeDiagnostic[] = []
  readonly errors: string[] = []
  private offset: number
  private partial = ''
  private scope: { id: string, caseId: string, checkpointId: string } | undefined

  constructor(private readonly file: string | undefined, private readonly requireJournal = false) {
    this.offset = file && fs.existsSync(file) ? fs.statSync(file).size : 0
  }

  collect(caseId: string | null, finished = false) {
    if (!this.file) {
      if (finished && this.requireJournal) {
        this.errors.push('Strict DOM acceptance requires a configured IDE diagnostic event journal')
      }
      return
    }
    if (!fs.existsSync(this.file)) {
      if (this.offset) {
        this.errors.push('IDE diagnostic event journal disappeared during acceptance')
      }
      else if (finished && this.requireJournal) {
        this.errors.push('Strict DOM acceptance requires an existing IDE diagnostic event journal')
      }
      return
    }
    const buffer = fs.readFileSync(this.file)
    if (buffer.length < this.offset) {
      this.errors.push('IDE diagnostic event journal was truncated during acceptance')
      this.offset = 0
      this.partial = ''
    }
    const lines = (this.partial + buffer.subarray(this.offset).toString('utf8')).split(/\r?\n/)
    this.offset = buffer.length
    this.partial = lines.pop() ?? ''
    for (const line of lines.filter(line => line.trim())) {
      try {
        const event = eventSchema.parse(JSON.parse(line))
        if (event.acceptanceScope) {
          const boundary = event.acceptanceScope
          if (boundary.boundary === 'start') {
            if (this.scope) {
              this.errors.push('IDE diagnostic scopes overlap')
            }
            this.scope = boundary
          }
          else {
            if (!this.scope || ['id', 'caseId', 'checkpointId'].some(key => Reflect.get(this.scope!, key) !== Reflect.get(boundary, key))) {
              this.errors.push('IDE diagnostic scope ended without its matching start')
            }
            this.scope = undefined
          }
        }
        const owner = this.scope?.caseId ?? caseId
        const collectedAt = new Date().toISOString()
        const entry: RuntimeDiagnostic = { recordedAt: event.recordedAt ?? null, collectedAt, observedAt: event.recordedAt ?? collectedAt, caseId: owner, phase: owner ? 'case' : 'outside-case', scopeId: this.scope?.id, checkpointId: this.scope?.checkpointId, event }
        this.entries.push(entry)
        if (this.requireJournal) {
          this.errors.push(...evaluateDiagnosticTimestamps([entry]))
        }
      }
      catch {
        this.errors.push('IDE diagnostic event journal contains an invalid record')
      }
    }
    if (finished && this.partial.trim()) {
      this.errors.push('IDE diagnostic event journal ends with an incomplete record')
    }
    if (finished && this.scope) {
      this.errors.push('IDE diagnostic scope did not finish')
    }
  }
}
