import type { ComponentPublicInstance, InternalRuntimeState, RuntimeInstance } from './types'

type OwnerSubscriber = (snapshot: Record<string, any>, proxy: ComponentPublicInstance<any, any, any> | undefined) => void

interface OwnerRecord {
  snapshot: Record<string, any>
  proxy?: ComponentPublicInstance<any, any, any>
  subscribers: Set<OwnerSubscriber>
}

const ownerStore = new Map<string, OwnerRecord>()
let ownerSeed = 0

export function allocateOwnerId() {
  ownerSeed += 1
  return `wv${ownerSeed}`
}

export function updateOwnerSnapshot(
  ownerId: string,
  snapshot: Record<string, any>,
  proxy: ComponentPublicInstance<any, any, any> | undefined,
) {
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
  ownerStore.delete(ownerId)
}

export function subscribeOwner(ownerId: string, subscriber: OwnerSubscriber) {
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
  return ownerStore.get(ownerId)?.proxy
}

export function getOwnerSnapshot(ownerId: string) {
  return ownerStore.get(ownerId)?.snapshot
}

export function attachOwnerSnapshot(
  target: InternalRuntimeState,
  runtime: RuntimeInstance<any, any, any>,
  ownerId: string,
) {
  try {
    ;(runtime.state as any).__wvOwnerId = ownerId
  }
  catch {
    // 忽略写入异常
  }
  try {
    ;(target as any).__wvOwnerId = ownerId
  }
  catch {
    // 忽略写入异常
  }
  const snapshot = typeof runtime.snapshot === 'function' ? runtime.snapshot() : {}
  const propsSource = (target as any).__wevuProps ?? (target as any).properties
  if (propsSource && typeof propsSource === 'object') {
    for (const [key, value] of Object.entries(propsSource)) {
      snapshot[key] = value
    }
  }
  updateOwnerSnapshot(ownerId, snapshot, runtime.proxy)
}
