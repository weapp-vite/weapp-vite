import type { DomCheckpoint, DomPage } from '../../utils/domAcceptance/types'

export const CLASSIC_WXS_RELOAD_CHECKPOINT: DomCheckpoint = {
  id: 'classic-wxs:app-reloaded',
  route: '/pages/reactivity/index',
  action: 'classic WXS 更新触发全量刷新，验收启动页；随后复用 session 重新进入目标页，不要求保留页面状态',
  nodes: [{ selector: '.title', text: 'Reactivity' }],
}

// headless 当前只提供导航与 WXS 求值 API，没有 IDE 编译自动刷新事件，不能替代此检查。
// 对应 API 覆盖在 simulator/test/wxs.test.ts 与 e2e/browser.e2e.test.ts；更新后的文本仍需 IDE 验收。
export async function waitForClassicWxsReload(miniProgram: { currentPage: () => Promise<DomPage | null | undefined> }) {
  const deadline = Date.now() + 20_000
  let lastError: unknown
  let lastRoute: string | undefined
  while (Date.now() < deadline) {
    try {
      const page = await miniProgram.currentPage()
      lastRoute = page?.path
      if (page && page.path.replace(/^\//, '') === 'pages/reactivity/index') {
        return page
      }
    }
    catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Classic WXS update did not return to the app launch page; last route: ${lastRoute ?? 'none'}`, { cause: lastError })
}
