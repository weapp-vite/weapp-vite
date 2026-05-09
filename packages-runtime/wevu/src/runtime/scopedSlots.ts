import type { ComponentPublicInstance, InternalRuntimeState, RuntimeInstance } from './types'
import {
  WEVU_GENERIC_SLOT_OWNER_ID_ATTR,
  WEVU_GENERIC_SLOT_OWNER_ID_PROP,
  WEVU_PROPS_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
} from '@weapp-core/constants'
import { toPlain } from './diff'

type OwnerSubscriber = (snapshot: Record<string, any>, proxy: ComponentPublicInstance<any, any, any> | undefined) => void

interface OwnerRecord {
  snapshot: Record<string, any>
  proxy?: ComponentPublicInstance<any, any, any>
  subscribers: Set<OwnerSubscriber>
}

type RuntimeInstanceWithOwnerSnapshot = RuntimeInstance<any, any, any> & {
  __wevu_collectOwnerSnapshot?: () => Record<string, any>
  __wevu_cloneLatestSnapshot?: () => Record<string, any>
}

const ownerStore = new Map<string, OwnerRecord>()
let ownerSeed = 0
let fallbackSlotOwnerId = ''

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

export function rememberSlotOwnerId(ownerId: unknown) {
  if (typeof ownerId === 'string' && ownerId) {
    fallbackSlotOwnerId = ownerId
  }
}

export function clearFallbackSlotOwnerId() {
  fallbackSlotOwnerId = ''
}

export function getFallbackSlotOwnerId() {
  return fallbackSlotOwnerId
}

export function resolveOwnerSnapshot(runtime: RuntimeInstance<any, any, any>, options: { full?: boolean } = {}) {
  const runtimeWithOwnerSnapshot = runtime as RuntimeInstanceWithOwnerSnapshot
  const snapshot = options.full && typeof runtimeWithOwnerSnapshot.__wevu_collectOwnerSnapshot === 'function'
    ? runtimeWithOwnerSnapshot.__wevu_collectOwnerSnapshot()
    : typeof runtimeWithOwnerSnapshot.__wevu_cloneLatestSnapshot === 'function'
      ? runtimeWithOwnerSnapshot.__wevu_cloneLatestSnapshot()
      : typeof runtime.snapshot === 'function'
        ? runtime.snapshot()
        : {}
  const proxy = runtime.proxy
  if (!proxy || typeof proxy !== 'object') {
    return snapshot
  }
  const seen = new WeakMap<object, any>()
  for (const key of Reflect.ownKeys(proxy)) {
    if (typeof key !== 'string') {
      continue
    }
    let value: unknown
    try {
      value = (proxy as any)[key]
    }
    catch {
      continue
    }
    if (typeof value === 'function') {
      continue
    }
    const plain = toPlain(value, seen)
    if (plain !== undefined) {
      snapshot[key] = plain
    }
  }
  return snapshot
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
  const snapshot = resolveOwnerSnapshot(runtime, { full: true })
  const propsSource = (target as any)[WEVU_PROPS_KEY] ?? (target as any).properties
  if (propsSource && typeof propsSource === 'object') {
    for (const [key, value] of Object.entries(propsSource)) {
      snapshot[key] = value
    }
    rememberSlotOwnerId(
      (propsSource as any)[WEVU_SLOT_OWNER_ID_PROP]
      || (propsSource as any)[WEVU_GENERIC_SLOT_OWNER_ID_PROP]
      || (propsSource as any)[WEVU_GENERIC_SLOT_OWNER_ID_ATTR],
    )
  }
  updateOwnerSnapshot(ownerId, snapshot, runtime.proxy)
}
