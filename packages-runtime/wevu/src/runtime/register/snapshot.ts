import type { InternalRuntimeState } from '../types'
import {
  WEVU_PROPS_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
} from '@weapp-core/constants'
import { mergeOwnerSnapshotProps, updateOwnerSnapshot } from '../scopedSlots'

export function refreshOwnerSnapshotFromInstance(instance: InternalRuntimeState) {
  const runtime = instance.__wevu
  const ownerId = (instance as any)[WEVU_SLOT_OWNER_ID_KEY]
  if (!runtime || !ownerId || typeof runtime.snapshot !== 'function') {
    return
  }
  const snapshot = runtime.snapshot()
  const propsSource = (instance as any)[WEVU_PROPS_KEY] ?? (instance as any).properties
  mergeOwnerSnapshotProps(snapshot, propsSource, runtime)
  updateOwnerSnapshot(ownerId, snapshot, runtime.proxy)
}
