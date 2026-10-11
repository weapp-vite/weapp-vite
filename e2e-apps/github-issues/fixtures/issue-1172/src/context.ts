import type { ShallowRef } from 'wevu'

export interface SlotContext {
  label: string
  count: ShallowRef<number>
  increment: () => void
  isSame: (context: unknown, count: unknown, increment: unknown) => boolean
}

export const SLOT_CONTEXT = Symbol('issue-1172-slot-context')
