interface ComponentTarget {
  nodeId: number
  pageId: number
}

declare const getCurrentPages: (() => Array<{ __wxWebviewId__?: number }>) | undefined

/** 在同一个 Runtime 上下文持有真实 caller，不转用其他 ContextManager 的 token。 */
export function createComponentCallerSession(this: any, expected: ComponentTarget, observerTimeout: number): any {
  // eslint-disable-next-line ts/no-this-alias -- SDK 普通函数的 this 是调试全局，需同引用核验 bridge 与 adapter。
  const root = this
  const adapter = root.__glassEaselAdapter__
  const environment = adapter?.getEnv?.()
  if (typeof environment?.getAdapterPage !== 'function') {
    throw new TypeError('Component caller backend selection is unavailable')
  }
  // 与 SDK 的 isGlassEaselPage 分支一致；此 backend 的原生 resolver 没有跨域错绑。
  if (environment.getAdapterPage(expected.pageId)) {
    return {
      backend: 'glass-easel',
      dispose: () => ({ state: 'disposed', added: false, removed: false }),
    }
  }
  const bridge = root.WeixinJSBridge
  if (!bridge || typeof bridge.addSubscribeListener !== 'function'
    || typeof bridge.removeSubscribeListener !== 'function'
    || !adapter || typeof adapter.getVirtualDOM !== 'function') {
    throw new Error('Exact component caller bridge is unavailable')
  }
  const add = bridge.addSubscribeListener
  const remove = bridge.removeSubscribeListener
  const subscribe = bridge.subscribe
  const virtualDOM = adapter.getVirtualDOM()
  const exparser = virtualDOM?.getExparser?.()
  if (typeof virtualDOM?.getNodeById !== 'function' || typeof virtualDOM.getNodeId !== 'function'
    || typeof virtualDOM.getPageId !== 'function' || typeof exparser?.Element?.getMethodCaller !== 'function') {
    throw new TypeError('Exact component caller mapping is unavailable')
  }
  let state = 'created'
  let caller: any
  let node: any
  let virtualId: string | number | undefined
  let added = false
  let removed = false
  let totalInvocations = 0
  let matchingInvocations = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const errors: string[] = []
  const eventName = 'exparserComponentInvoker'

  function identitiesMatch() {
    return root.WeixinJSBridge === bridge && root.__glassEaselAdapter__ === adapter
      && bridge.subscribe === subscribe && bridge.addSubscribeListener === add
      && bridge.removeSubscribeListener === remove && adapter.getVirtualDOM() === virtualDOM
      && virtualDOM.getExparser() === exparser
  }
  function snapshot() {
    return { state, added, removed, totalInvocations, matchingInvocations, errors: [...errors], identitiesMatch: identitiesMatch() }
  }
  function listener(message: any, sender: unknown) {
    // 清理后仍计数，不能让状态检查隐藏残留回调。
    totalInvocations += 1
    if (state !== 'armed' && state !== 'resolved') {
      return
    }
    if (message?.method !== 'resolveComponentCaller') {
      return
    }
    matchingInvocations += 1
    try {
      const args = message.params
      if (matchingInvocations !== 1 || !Array.isArray(args) || args.length !== 1
        || args[0] === null || typeof args[0] !== 'object' || Array.isArray(args[0])) {
        throw new Error('Component caller resolver payload is ambiguous')
      }
      const params = args[0]
      const id = params.nodeId
      if (!Number.isSafeInteger(message.callbackId) || message.callbackId <= 0
        || sender !== expected.pageId || params.webviewId !== expected.pageId
        || !((typeof id === 'string' && id.length > 0) || (Number.isSafeInteger(id) && id >= 0))) {
        throw new Error('Component caller resolver identity disagrees')
      }
      if (!identitiesMatch()) {
        throw new Error('Component caller bridge identity changed')
      }
      const resolvedNode = virtualDOM.getNodeById(id, expected.pageId)
      if (!resolvedNode || virtualDOM.getNodeId(resolvedNode, expected.pageId) !== id
        || virtualDOM.getPageId(resolvedNode) !== expected.pageId) {
        throw new Error('Component caller virtual node identity disagrees')
      }
      const resolvedCaller = exparser.Element.getMethodCaller(resolvedNode)
      if (!resolvedCaller || !['object', 'function'].includes(typeof resolvedCaller)) {
        throw new Error('Component caller is unavailable')
      }
      virtualId = id
      node = resolvedNode
      caller = resolvedCaller
      state = 'resolved'
    }
    catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      state = 'failed'
    }
  }
  function removeListener() {
    if (added && !removed) {
      remove.call(bridge, eventName, listener)
      removed = true
    }
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  function dispose() {
    try {
      removeListener()
      state = 'disposed'
    }
    finally {
      caller = undefined
      node = undefined
      virtualId = undefined
    }
    // 清理确认仅依赖本地所有权；宿主 getter 损坏不能撤销已完成的精确移除。
    return { state, added, removed, totalInvocations, matchingInvocations, errors: [...errors] }
  }
  return {
    backend: 'exparser',
    arm() {
      if (state !== 'created') {
        throw new Error('Component caller observer cannot be armed twice')
      }
      state = 'armed'
      // 断连后无法发送清理 RPC 时，也只移除自己登记的 callback。
      timer = setTimeout(() => {
        try {
          dispose()
        }
        catch (error) {
          errors.push(error instanceof Error ? error.message : String(error))
          state = 'failed'
        }
      }, observerTimeout)
      added = true
      add.call(bridge, eventName, listener)
      return snapshot()
    },
    snapshot,
    disarm() {
      removeListener()
      if (state !== 'resolved' || matchingInvocations !== 1 || errors.length || !identitiesMatch()) {
        throw new Error(`Exact component caller resolution failed: ${JSON.stringify(snapshot())}`)
      }
      state = 'ready'
      return snapshot()
    },
    invoke(method: string, args: any[]) {
      if (state !== 'ready' || !removed || errors.length || !identitiesMatch()) {
        throw new Error('Component caller is not ready for a single invocation')
      }
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (pages[pages.length - 1]?.__wxWebviewId__ !== expected.pageId
        || virtualDOM.getNodeById(virtualId, expected.pageId) !== node
        || virtualDOM.getNodeId(node, expected.pageId) !== virtualId
        || virtualDOM.getPageId(node) !== expected.pageId
        || exparser.Element.getMethodCaller(node) !== caller) {
        throw new Error('Component caller changed before invocation')
      }
      // 先消费调用权，再读取业务属性；getter、业务异常和 Promise 均保留宿主语义。
      state = 'dispatched'
      return caller[method](...args)
    },
    dispose,
  }
}
