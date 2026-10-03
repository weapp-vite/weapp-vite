import type { SequenceInput } from './driver'
import type { SequenceErrorEvidence } from './errorEvidence'

export interface SequenceWorkerRequest extends Omit<SequenceInput, 'signal'> {
  id: number
}

export type SequenceWorkerMessage
  = | SequenceWorkerRequest
    | { type: 'cancel', id: number, reason: SequenceErrorEvidence }
    | { type: 'close' }
