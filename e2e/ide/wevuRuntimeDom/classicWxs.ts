import type { DomCheckpoint, DomPage } from '../../utils/domAcceptance/types'
import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'

export const CLASSIC_WXS_RELOAD_CHECKPOINT: DomCheckpoint = {
  id: 'classic-wxs:app-reloaded',
  route: '/pages/reactivity/index',
  action: resolveRuntimeProviderName() === 'headless'
    ? 'headless companion：从已验证的 classic WXS 新产物冷启并验收启动页，随后复用新 VM 进入目标页'
    : 'classic WXS 更新触发全量刷新，验收启动页；随后复用 session 重新进入目标页，不要求保留页面状态',
  nodes: [{ selector: '.title', text: 'Reactivity' }],
}

// headless companion 显式冷启新产物后复用此启动页断言；真实 IDE 必须自己完成自动刷新。
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
