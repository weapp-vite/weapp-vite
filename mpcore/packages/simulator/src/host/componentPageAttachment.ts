type Attachment = (this: Record<string, any>) => void

const definitionAttachments = new WeakMap<object, Attachment>()
const instanceAttachments = new WeakMap<object, Attachment>()
const attachingInstances = new WeakSet<object>()

export function isComponentPageAttaching(instance: object) {
  return attachingInstances.has(instance)
}

export function registerComponentPageAttachment(definition: object, attach: Attachment) {
  definitionAttachments.set(definition, attach)
}

export function bindComponentPageAttachment(instance: object, definition: object) {
  const attach = definitionAttachments.get(definition)
  if (attach) {
    instanceAttachments.set(instance, attach)
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
