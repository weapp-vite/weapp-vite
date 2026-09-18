import type { HeadlessComponentInstance } from './types'

const discardedReady = new WeakMap<object, Map<string, HeadlessComponentInstance>>()

/** 初始模板分支被 props 替换时，微信仍发送 ready，但不发送 attached 或 detached。 */
export function scheduleDiscardedComponentReady(cache: object, scopeId: string, instance: HeadlessComponentInstance) {
  const pending = discardedReady.get(cache) ?? new Map<string, HeadlessComponentInstance>()
  pending.set(scopeId, instance)
  discardedReady.set(cache, pending)
}

export function flushDiscardedComponentReady(cache: object, pageScopeId: string, ready: (instance: HeadlessComponentInstance) => void) {
  const pending = discardedReady.get(cache)
  if (!pending) {
    return
  }
  const current = [...pending].filter(([scopeId]) => scopeId.startsWith(`${pageScopeId}/`))
  for (const [scopeId, instance] of current) {
    pending.delete(scopeId)
    instance.__ready__ = true
  }
  for (const [, instance] of current) {
    ready(instance)
  }
  if (!pending.size) {
    discardedReady.delete(cache)
  }
}
