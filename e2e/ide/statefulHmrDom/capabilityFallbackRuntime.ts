import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'

const REQUEST_TIMEOUT = 2_500

interface RuntimeKeys {
  client: string
  bridge: string
  control: string
}

/** 诊断读取各自保留失败，不把协议错误写成空页面或已重载。 */
export async function observeCapabilityDiagnostic(read: () => Promise<unknown>) {
  const startedAt = new Date().toISOString()
  try {
    const value = await read()
    return { status: 'fulfilled', startedAt, finishedAt: new Date().toISOString(), value }
  }
  catch (error) {
    return {
      status: 'rejected',
      startedAt,
      finishedAt: new Date().toISOString(),
      error: { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error) },
    }
  }
}

function readRuntime(keys: RuntimeKeys) {
  const runtime = globalThis as any
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const page = pages[pages.length - 1] as any
  const present = (host: any) => ({
    client: Boolean(host?.[keys.client]),
    bridge: Boolean(host?.[keys.bridge]),
    control: Boolean(host?.[keys.control]),
    phase: host?.[keys.client]?.getTransportState?.().phase ?? null,
  })
  return {
    getCurrentPagesAvailable: typeof getCurrentPages === 'function',
    pageCount: pages.length,
    marker: page?.data?.marker ?? null,
    count: page?.data?.count ?? null,
    input: page?.data?.input ?? null,
    identity: page?.__capabilityIdentity ?? null,
    pageId: page?.__wxWebviewId__ ?? page?.__webviewId__ ?? page?.pageId ?? null,
    route: page?.route ?? page?.__route__ ?? null,
    global: present(runtime),
    host: present(runtime.wx),
    timeOrigin: runtime.performance?.timeOrigin ?? null,
    appEnvironment: runtime.__wxConfig?.envVersion ?? null,
    baseLibraryVersion: runtime.__wxConfig?.SDKVersion ?? null,
  }
}

async function readFrameValue(element: any, provider: string, field: 'text' | 'value') {
  if (provider !== 'devtools') {
    return field === 'text' ? await element.text() : await element.attribute('value')
  }
  // 原生 Element 的公开读取沿用连接默认超时；诊断只借用其既有协议入口显式限定本次请求。
  if (typeof element.send !== 'function') {
    throw new TypeError('Native frame element has no bounded diagnostic protocol entry')
  }
  const method = field === 'text' ? 'getDOMProperties' : 'getAttributes'
  const result = await element.send(`Element.${method}`, { names: [field === 'text' ? 'innerText' : 'value'] }, { timeout: REQUEST_TIMEOUT })
  const values: unknown = result?.[field === 'text' ? 'properties' : 'attributes']
  if (!Array.isArray(values) || values.length !== 1) {
    throw new TypeError(`Native frame ${field} diagnostic returned an invalid protocol response`)
  }
  return values[0]
}

async function capturePageFrame(session: any, provider: string) {
  const page = await session.currentPage({ retries: 1, timeout: REQUEST_TIMEOUT, pageStackFallback: false, appFunctionFallback: false })
  if (!page) {
    return { source: provider === 'devtools' ? 'devtools-page-frame' : 'headless-page', status: 'unavailable' }
  }
  return {
    source: provider === 'devtools' ? 'devtools-page-frame' : 'headless-page',
    pageId: page.pageId,
    route: page.path,
    nodes: await Promise.all(['.marker', '.count', '.input'].map(async selector => ({
      selector,
      result: await observeCapabilityDiagnostic(async () => {
        const elements = await page.$$(selector, { fallback: false, timeout: REQUEST_TIMEOUT })
        return await Promise.all(elements.map(async (element: any) => {
          const [text, value] = await Promise.all([
            observeCapabilityDiagnostic(async () => await readFrameValue(element, provider, 'text')),
            selector === '.input' ? observeCapabilityDiagnostic(async () => await readFrameValue(element, provider, 'value')) : undefined,
          ])
          return { text, ...(selector === '.input' ? { value } : {}) }
        }))
      }),
    }))),
  }
}

async function captureNativeContext(session: any, provider: string, keys: RuntimeKeys) {
  if (provider !== 'devtools') {
    return { status: 'unavailable', reason: 'provider has no native AppService context' }
  }
  if (typeof session.CDP !== 'function') {
    return { status: 'unavailable', reason: 'session has no CDP diagnostic entry' }
  }
  const cdp = session.CDP()
  const events: Array<Record<string, unknown>> = []
  const unsubscribe = cdp.onEvent((domain: string, event: string, params: any) => {
    if (domain !== 'Runtime') {
      return
    }
    if (event === 'executionContextCreated') {
      const context = params?.context
      events.push({ event, recordedAt: new Date().toISOString(), id: context?.id, uniqueId: context?.uniqueId, name: context?.name, auxData: { isDefault: context?.auxData?.isDefault, type: context?.auxData?.type, frameId: context?.auxData?.frameId } })
    }
    else if (event === 'executionContextDestroyed' || event === 'executionContextsCleared') {
      events.push({ event, recordedAt: new Date().toISOString(), executionContextId: params?.executionContextId, executionContextUniqueId: params?.executionContextUniqueId })
    }
  })
  let enabled: unknown
  let runtime: unknown
  let cleanup: unknown
  try {
    enabled = await observeCapabilityDiagnostic(async () => await cdp.sendCommand('Runtime', 'enable', {}, { timeout: REQUEST_TIMEOUT }))
    runtime = await observeCapabilityDiagnostic(async () => await cdp.sendCommand('Runtime', 'evaluate', {
      expression: `(${readRuntime.toString()})(${JSON.stringify(keys)})`,
      returnByValue: true,
      silent: true,
    }, { timeout: REQUEST_TIMEOUT }))
  }
  finally {
    cleanup = await observeCapabilityDiagnostic(async () => unsubscribe())
  }
  return {
    source: 'native-appservice-cdp',
    enabled,
    runtime,
    events,
    cleanup,
    note: '仅观察本次失败采样期间的上下文事件；没有事件不能证明上下文或运行代次未改变。',
  }
}

/** 并列采样真实节点、App.callFunction 包装状态与原生上下文，不重连、导航或更改业务状态。 */
export async function captureCapabilityRuntime(session: any, provider: string) {
  const keys = { client: WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, bridge: WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, control: WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY }
  const [frame, appFunction, nativeContext] = await Promise.all([
    observeCapabilityDiagnostic(async () => await capturePageFrame(session, provider)),
    observeCapabilityDiagnostic(async () => await session.evaluateWithOptions(readRuntime, { timeout: REQUEST_TIMEOUT }, keys)),
    observeCapabilityDiagnostic(async () => await captureNativeContext(session, provider, keys)),
  ])
  return { frame, appFunction, nativeContext }
}
