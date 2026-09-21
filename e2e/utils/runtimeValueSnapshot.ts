/** 在宿主内序列化响应式代理，避免 DevTools 协议克隆代理时丢失整个返回值。 */
export function collectRuntimeValueSnapshot(selectors: string[]): Promise<string> {
  return new Promise((resolve) => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) {
      resolve(JSON.stringify({ route: '', pageData: {}, results: [] }))
      return
    }
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
      bridgeSnapshot: globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__?.getDebugSnapshot?.(),
      results,
    })))
  })
}
