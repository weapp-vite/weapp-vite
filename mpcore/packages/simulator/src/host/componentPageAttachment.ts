type Attachment = (this: Record<string, any>) => void

const definitionAttachments = new WeakMap<object, Attachment>()
const instanceAttachments = new WeakMap<object, Attachment>()
const attachingInstances = new WeakSet<object>()
const instanceStyleIsolation = new WeakMap<object, string>()
const componentPageInstances = new WeakSet<object>()

export function isComponentPageInstance(instance: object) {
  return componentPageInstances.has(instance)
}

export function getComponentPageStyleIsolation(instance: object) {
  return instanceStyleIsolation.get(instance)
}

export function isComponentPageAttaching(instance: object) {
  return attachingInstances.has(instance)
}

export function registerComponentPageAttachment(definition: object, attach: Attachment) {
  definitionAttachments.set(definition, attach)
}

export function bindComponentPageAttachment(instance: object, definition: object) {
  const attach = definitionAttachments.get(definition)
  if (attach) {
    componentPageInstances.add(instance)
    instanceAttachments.set(instance, attach)
    const options = (definition as { options?: { styleIsolation?: unknown } }).options
    if (typeof options?.styleIsolation === 'string') {
      instanceStyleIsolation.set(instance, options.styleIsolation)
    }
  }
}

export function attachComponentPage(instance: Record<string, any>) {
  const attach = instanceAttachments.get(instance)
  if (!attach) {
    return false
  }
  // 查询或 setData 可能重入渲染；每个页面实例只挂载一次。
  instanceAttachments.delete(instance)
  attachingInstances.add(instance)
  try {
    attach.call(instance)
  }
  finally {
    attachingInstances.delete(instance)
  }
  return true
}
