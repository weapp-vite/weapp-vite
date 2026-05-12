import type { ComponentPublicInstance, InternalRuntimeState, RuntimeInstance } from './types'
import {
  WEVU_PROPS_KEY,
  WEVU_SCOPED_SLOT_OWNER_SEED_KEY,
  WEVU_SCOPED_SLOT_OWNER_STORE_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
} from '@weapp-core/constants'

type OwnerSubscriber = (snapshot: Record<string, any>, proxy: ComponentPublicInstance<any, any, any> | undefined) => void

interface OwnerRecord {
  snapshot: Record<string, any>
  proxy?: ComponentPublicInstance<any, any, any>
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
) {
  const { ownerStore } = getScopedSlotGlobalStore()
  const record = ownerStore.get(ownerId) ?? { snapshot: {}, proxy, subscribers: new Set() }
  record.snapshot = snapshot
  record.proxy = proxy
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

export function resolveOwnerSnapshot(runtime: RuntimeInstance<any, any, any>) {
  const fastSnapshot = (runtime as RuntimeInstanceWithOwnerSnapshot).__wevu_cloneLatestSnapshot
  if (typeof fastSnapshot === 'function') {
    return fastSnapshot()
  }
  return typeof runtime.snapshot === 'function' ? runtime.snapshot() : {}
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
  const snapshot = resolveOwnerSnapshot(runtime)
  const propsSource = (target as any)[WEVU_PROPS_KEY] ?? (target as any).properties
  if (propsSource && typeof propsSource === 'object') {
    for (const [key, value] of Object.entries(propsSource)) {
      snapshot[key] = value
    }
  }
  updateOwnerSnapshot(ownerId, snapshot, runtime.proxy)
}
