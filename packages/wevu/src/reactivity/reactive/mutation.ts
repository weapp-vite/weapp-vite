export type MutationOp = 'set' | 'delete'
export type MutationKind = 'property' | 'array'
export interface MutationRecord {
  root: object
  kind: MutationKind
  op: MutationOp
  /**
   * 点路径（例如 `a.b.c`）；当路径不可靠时为 undefined。
   */
  path?: string
  /**
   * 当路径不唯一时回退使用的顶层键列表。
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
