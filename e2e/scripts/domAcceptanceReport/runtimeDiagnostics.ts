import fs from 'node:fs'
import { z } from 'zod'

const eventSchema = z.object({
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
  observedAt: z.iso.datetime(),
  caseId: z.string().nullable(),
  phase: z.enum(['case', 'outside-case']),
  scopeId: z.string().optional(),
  checkpointId: z.string().optional(),
  event: eventSchema,
})

export type RuntimeDiagnostic = z.infer<typeof runtimeDiagnosticSchema>

export class RuntimeDiagnosticJournal {
  readonly entries: RuntimeDiagnostic[] = []
  readonly errors: string[] = []
  private offset: number
  private partial = ''
  private scope: { id: string, caseId: string, checkpointId: string } | undefined

  constructor(private readonly file: string | undefined) {
    this.offset = file && fs.existsSync(file) ? fs.statSync(file).size : 0
  }

  collect(caseId: string | null, finished = false) {
    if (!this.file) {
      return
    }
    if (!fs.existsSync(this.file)) {
      if (this.offset) {
        this.errors.push('IDE diagnostic event journal disappeared during acceptance')
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
        this.entries.push({ observedAt: new Date().toISOString(), caseId: owner, phase: owner ? 'case' : 'outside-case', scopeId: this.scope?.id, checkpointId: this.scope?.checkpointId, event })
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
