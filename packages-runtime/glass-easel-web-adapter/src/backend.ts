import * as glassEasel from 'glass-easel'

// 官方 DOM backend 的委托监听绑定到 document.body，生命周期属于整个文档。
// 每个文档只初始化一个桥，避免多个 root/adapter 重复派发同一浏览器事件。
const documentBackends = new WeakMap<Document, glassEasel.CurrentWindowBackendContext>()

export function getDocumentBackend(): glassEasel.CurrentWindowBackendContext {
  if (typeof document === 'undefined' || typeof glassEasel.CurrentWindowBackendContext !== 'function') {
    throw new Error('glass-easel Web backend is unavailable in this environment')
  }
  let backend = documentBackends.get(document)
  if (!backend) {
    backend = new glassEasel.CurrentWindowBackendContext()
    backend.onEvent((element, ...args) => {
      if (glassEasel.Element.isAttached(element)) {
        return glassEasel.Event.triggerBackendEvent(element, ...args)
      }
    })
    documentBackends.set(document, backend)
  }
  return backend
}
