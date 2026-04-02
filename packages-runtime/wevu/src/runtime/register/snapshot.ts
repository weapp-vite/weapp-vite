import type { InternalRuntimeState } from '../types'
import { updateOwnerSnapshot } from '../scopedSlots'

export function refreshOwnerSnapshotFromInstance(instance: InternalRuntimeState) {
  const runtime = instance.__wevu
  const ownerId = (instance as any).__wvOwnerId
  if (!runtime || !ownerId || typeof runtime.snapshot !== 'function') {
    return
  }
  const snapshot = runtime.snapshot()
  const propsSource = (instance as any).__wevuProps ?? (instance as any).properties
  if (propsSource && typeof propsSource === 'object') {
    for (const [key, value] of Object.entries(propsSource)) {
      snapshot[key] = value
    }
  }
  updateOwnerSnapshot(ownerId, snapshot, runtime.proxy)
}
