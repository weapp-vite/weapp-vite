/** 在宿主内序列化响应式代理，避免 DevTools 协议克隆代理时丢失整个返回值。 */
export function collectRuntimeValueSnapshot(selectors: string[], includeState = false): Promise<string> {
  return new Promise((resolve) => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) {
      resolve(JSON.stringify({ route: '', pageData: {}, results: [] }))
      return
    }
    const bridge = (globalThis as typeof globalThis & {
      __WEAPP_VITE_STATEFUL_HMR_BRIDGE__?: { getDebugSnapshot?: (includeState: boolean) => unknown }
    }).__WEAPP_VITE_STATEFUL_HMR_BRIDGE__
    const query = wx.createSelectorQuery().in(page)
    const fields = JSON.parse('{"size":true}')
    for (const selector of selectors) {
      query.select(selector).fields(fields)
    }
    query.exec(results => resolve(JSON.stringify({
      route: page.route,
      pageData: page.data,
      runtimeState: (page as any).__wevu?.state,
      setupState: (page as any).__wevu?.setupState,
      bridgeSnapshot: bridge?.getDebugSnapshot?.(includeState),
      ...(includeState
        ? {
            pageIdentity: {
              pageId: (page as any).__wxWebviewId__ ?? (page as any).__webviewId__ ?? page.data?.__webviewId__,
              propertyKeys: Object.keys((page as any).properties ?? {}),
              propertiesShareData: (page as any).properties === page.data,
              runtimePresent: Boolean((page as any).__wevu),
            },
          }
        : {}),
      results,
    })))
  })
}
