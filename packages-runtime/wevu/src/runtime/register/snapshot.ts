import type { InternalRuntimeState } from '../types'
import { getScopedSlotMountState, runtimeCapabilityRegistry } from '../capabilities'

export function refreshOwnerSnapshotFromInstance(instance: InternalRuntimeState) {
  const state = getScopedSlotMountState(instance)
  if (state) {
    runtimeCapabilityRegistry.scopedSlots?.refresh(instance, state)
  }
}
