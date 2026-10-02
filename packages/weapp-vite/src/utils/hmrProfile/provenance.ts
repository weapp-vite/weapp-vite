import type { ChangeEvent } from '../../types'

export interface HmrProfileSourceEvent {
  eventId: string
  event?: ChangeEvent
  file?: string
  receivedAtMs: number
}

export interface HmrProfileProvenance {
  buildId?: string
  batchId?: string
  sourceEvents?: HmrProfileSourceEvent[]
  batchWaitMs?: number
  queueWaitMs?: number
}

export interface HmrProfileRecordMetadata extends HmrProfileProvenance {
  schemaVersion: 1
  sessionId: string
  status: 'complete' | 'failed' | 'incomplete'
  elapsedMs?: number
  clock: {
    durations: 'performance.now'
    timestamp: 'UTC'
    timeOrigin: number
  }
  correlation: 'known' | 'unknown'
  estimates: { buildCoreMs: 'residual-overlapping-phases' }
}
