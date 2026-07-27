import type { ComponentPublicInstance, InternalRuntimeState, RuntimeInstance } from './types'
import {
  WEVU_PROPS_KEY,
  WEVU_SCOPED_SLOT_OWNER_SEED_KEY,
  WEVU_SCOPED_SLOT_OWNER_STORE_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_OWNER_PROXY_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'

type OwnerSubscriber = (snapshot: Record<string, any>, proxy: ComponentPublicInstance<any, any, any> | undefined) => void

interface OwnerRecord {
  snapshot: Record<string, any>
  proxy?: ComponentPublicInstance<any, any, any>
  target?: InternalRuntimeState
  subscribers: Set<OwnerSubscriber>
}

type RuntimeInstanceWithOwnerSnapshot = RuntimeInstance<any, any, any> & {
  __wevu_cloneLatestSnapshot?: () => Record<string, any>
}

function getScopedSlotGlobalStore() {
  const globalObject = globalThis as Record<string, any>
  if (!(globalObject[WEVU_SCOPED_SLOT_OWNER_STORE_KEY] instanceof Map)) {
    globalObject[WEVU_SCOPED_SLOT_OWNER_STORE_KEY] = new Map<string, OwnerRecord>()
  }
  if (typeof globalObject[WEVU_SCOPED_SLOT_OWNER_SEED_KEY] !== 'number') {
    globalObject[WEVU_SCOPED_SLOT_OWNER_SEED_KEY] = 0
  }
  return {
    globalObject,
    ownerStore: globalObject[WEVU_SCOPED_SLOT_OWNER_STORE_KEY] as Map<string, OwnerRecord>,
  }
}

export function allocateOwnerId() {
  const { globalObject } = getScopedSlotGlobalStore()
  globalObject[WEVU_SCOPED_SLOT_OWNER_SEED_KEY] += 1
  return `wv${globalObject[WEVU_SCOPED_SLOT_OWNER_SEED_KEY]}`
}

export function updateOwnerSnapshot(
  ownerId: string,
  snapshot: Record<string, any>,
  proxy: ComponentPublicInstance<any, any, any> | undefined,
  target?: InternalRuntimeState,
) {
  const { ownerStore } = getScopedSlotGlobalStore()
  const record = ownerStore.get(ownerId) ?? { snapshot: {}, proxy, subscribers: new Set() }
  record.snapshot = snapshot
  record.proxy = proxy
  record.target = target ?? record.target
  ownerStore.set(ownerId, record)
  if (record.subscribers.size) {
    for (const subscriber of record.subscribers) {
      try {
        subscriber(snapshot, proxy)
      }
      catch {
        // 忽略订阅回调错误
      }
    }
  }
}

export function removeOwner(ownerId: string) {
  const { ownerStore } = getScopedSlotGlobalStore()
  ownerStore.delete(ownerId)
}

export function subscribeOwner(ownerId: string, subscriber: OwnerSubscriber) {
  const { ownerStore } = getScopedSlotGlobalStore()
  const record = ownerStore.get(ownerId) ?? { snapshot: {}, proxy: undefined, subscribers: new Set() }
  record.subscribers.add(subscriber)
  ownerStore.set(ownerId, record)
  return () => {
    const current = ownerStore.get(ownerId)
    if (!current) {
      return
    }
    current.subscribers.delete(subscriber)
  }
}

export function getOwnerProxy(ownerId: string) {
  const { ownerStore } = getScopedSlotGlobalStore()
  return ownerStore.get(ownerId)?.proxy
}

export function getOwnerSnapshot(ownerId: string) {
  const { ownerStore } = getScopedSlotGlobalStore()
  return ownerStore.get(ownerId)?.snapshot
}

export function getOwnerTarget(ownerId: string) {
  const { ownerStore } = getScopedSlotGlobalStore()
  return ownerStore.get(ownerId)?.target
}

export function resolveOwnerSnapshot(runtime: RuntimeInstance<any, any, any>) {
  const fastSnapshot = (runtime as RuntimeInstanceWithOwnerSnapshot).__wevu_cloneLatestSnapshot
  if (typeof fastSnapshot === 'function') {
    return fastSnapshot()
  }
  return typeof runtime.snapshot === 'function' ? runtime.snapshot() : {}
}

const OWNER_SNAPSHOT_PROTOCOL_KEYS = new Set([
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_OWNER_PROXY_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
])

export function mergeOwnerSnapshotProps(
  snapshot: Record<string, any>,
  propsSource: unknown,
) {
  if (!propsSource || typeof propsSource !== 'object') {
    return
  }
  for (const [key, value] of Object.entries(propsSource as Record<string, any>)) {
    if (OWNER_SNAPSHOT_PROTOCOL_KEYS.has(key)) {
      continue
    }
    snapshot[key] = value
  }
}

export function attachOwnerSnapshot(
  target: InternalRuntimeState,
  runtime: RuntimeInstance<any, any, any>,
  ownerId: string,
) {
  try {
    ;(runtime.state as any)[WEVU_SLOT_OWNER_ID_KEY] = ownerId
  }
  catch {
    // 忽略写入异常
  }
  try {
    ;(target as any)[WEVU_SLOT_OWNER_ID_KEY] = ownerId
  }
  catch {
    // 忽略写入异常
  }
  try {
    const data = (target as any).data
    if (data && typeof data === 'object') {
      data[WEVU_SLOT_OWNER_ID_KEY] = ownerId
    }
  }
  catch {
    // 忽略 owner id 同步异常
  }
  const snapshot = resolveOwnerSnapshot(runtime)
  const propsSource = (target as any)[WEVU_PROPS_KEY] ?? (target as any).properties
  mergeOwnerSnapshotProps(snapshot, propsSource)
  updateOwnerSnapshot(ownerId, snapshot, runtime.proxy, target)
}
