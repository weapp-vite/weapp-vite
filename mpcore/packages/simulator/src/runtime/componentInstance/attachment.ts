import type { HeadlessComponentInstance } from './types'

const attachmentStates = new WeakMap<HeadlessComponentInstance, 'attaching' | 'attached'>()

export function isComponentAttached(instance: HeadlessComponentInstance) {
  return attachmentStates.get(instance) === 'attached'
}

export function hasPendingComponentAttachments(instances: Iterable<HeadlessComponentInstance>) {
  for (const instance of instances) {
    if (attachmentStates.get(instance) === 'attaching') {
      return true
    }
  }
  return false
}

export function flushComponentReady(instances: Iterable<HeadlessComponentInstance>, ready: (instance: HeadlessComponentInstance) => void) {
  const all = [...instances]
  if (hasPendingComponentAttachments(all)) {
    return false
  }
  const pending = all.filter(instance => isComponentAttached(instance) && !instance.__ready__)
  // ready 按宿主树的父先子顺序整批派发，查询重入不能提前执行后续节点的 ready。
  for (const instance of pending) {
    instance.__ready__ = true
  }
  for (const instance of pending) {
    ready(instance)
  }
  return pending.length > 0
}

export function flushComponentAttachments(
  componentCache: Map<string, HeadlessComponentInstance>,
  scopeIds: Iterable<string>,
  attach: (instance: HeadlessComponentInstance) => boolean,
): false | 'attached' | 'restart' {
  const pending = new Map<string, HeadlessComponentInstance>()
  for (const scopeId of scopeIds) {
    const instance = componentCache.get(scopeId)
    if (!instance) {
      continue
    }
    const state = attachmentStates.get(instance)
    // 绑定更新可创建新后代；父级挂载回调返回前不能抢先挂载它们。
    if (state === 'attaching') {
      return false
    }
    if (!state) {
      pending.set(scopeId, instance)
    }
  }
  // 整批先标记，防止 attached 内查询组件触发重入渲染并抢先运行兄弟生命周期。
  for (const instance of pending.values()) {
    attachmentStates.set(instance, 'attaching')
  }
  try {
    for (const [scopeId, instance] of pending) {
      if (componentCache.get(scopeId) !== instance) {
        return 'restart'
      }
      let restart: boolean
      try {
        restart = attach(instance)
      }
      finally {
        attachmentStates.set(instance, 'attached')
      }
      if (restart) {
        return 'restart'
      }
    }
  }
  finally {
    for (const instance of pending.values()) {
      if (attachmentStates.get(instance) === 'attaching') {
        attachmentStates.delete(instance)
      }
    }
  }
  return pending.size > 0 ? 'attached' : false
}
