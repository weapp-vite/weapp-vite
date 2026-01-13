export type MutationOp = 'set' | 'delete'
export type MutationKind = 'property' | 'array'
export interface MutationRecord {
  root: object
  kind: MutationKind
  op: MutationOp
  /**
   * dot path (e.g. `a.b.c`); undefined when path is not reliable.
   */
  path?: string
  /**
   * Top-level keys to fallback when path is not unique.
   */
  fallbackTopKeys?: string[]
}

type MutationRecorder = (record: MutationRecord) => void

export const mutationRecorders = new Set<MutationRecorder>()

export function addMutationRecorder(recorder: MutationRecorder) {
  mutationRecorders.add(recorder)
}

export function removeMutationRecorder(recorder: MutationRecorder) {
  mutationRecorders.delete(recorder)
}
