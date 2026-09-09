import type { HeadlessComponentInstance } from './types'

const attachmentStates = new WeakMap<HeadlessComponentInstance, 'attaching' | 'attached'>()

export function isComponentAttached(instance: HeadlessComponentInstance) {
  return attachmentStates.get(instance) === 'attached'
}

export function hasPendingComponentAttachments(instances: Iterable<HeadlessComponentInstance>) {
  return [...instances].some(instance => attachmentStates.get(instance) === 'attaching')
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
  instances: Iterable<HeadlessComponentInstance>,
  attach: (instance: HeadlessComponentInstance) => void,
) {
  const pending = [...instances].filter(instance => !attachmentStates.has(instance))
  // 整批先标记，防止 attached 内查询组件触发重入渲染并抢先运行兄弟生命周期。
  for (const instance of pending) {
    attachmentStates.set(instance, 'attaching')
  }
  try {
    for (const instance of pending) {
      try {
        attach(instance)
      }
      finally {
        attachmentStates.set(instance, 'attached')
      }
    }
  }
  finally {
    for (const instance of pending) {
      if (attachmentStates.get(instance) === 'attaching') {
        attachmentStates.delete(instance)
      }
    }
  }
  return pending.length > 0
}
