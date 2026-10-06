import { randomUUID } from 'node:crypto'

interface AppReloadSession {
  evaluateWithOptions: (fn: (...args: any[]) => unknown, options: { timeout: number }, ...args: unknown[]) => Promise<unknown>
}

export interface AppReloadMarker {
  readonly key: string
  readonly token: string
}

interface AppReloadSnapshot {
  appPresent: boolean
  appReplaced: boolean
  pagePresent: boolean
  rootVisible: boolean
  route: string
  width: number
  height: number
}

/** 在改源前标记当前 App；另一次协议回读确认标记确实保留在同一宿主实例上。 */
export async function captureAppReloadMarker(session: AppReloadSession): Promise<AppReloadMarker> {
  const marker = Object.freeze({ key: `__weappViteE2EAppReload_${randomUUID()}`, token: randomUUID() })
  const marked = await session.evaluateWithOptions((input: AppReloadMarker) => {
    const app = getApp() as Record<string, unknown> | undefined
    if (!app || typeof app !== 'object' || Array.isArray(app)) {
      throw new Error('Cannot mark App reload: getApp did not return an App instance')
    }
    if (input.key in app) {
      throw new Error('Cannot mark App reload: marker key already exists')
    }
    Object.defineProperty(app, input.key, { value: input.token, enumerable: false, writable: false, configurable: false })
    return app[input.key]
  }, { timeout: 5_000 }, marker)
  const readBack = await session.evaluateWithOptions((input: AppReloadMarker) => {
    const app = getApp() as Record<string, unknown> | undefined
    return app && typeof app === 'object' && !Array.isArray(app) ? app[input.key] : null
  }, { timeout: 5_000 }, marker)
  if (marked !== marker.token || readBack !== marker.token) {
    throw new Error('Cannot mark App reload: App marker did not survive an independent protocol read')
  }
  return marker
}

function readAppReloadSnapshot(marker: AppReloadMarker, rootSelector: string): Promise<AppReloadSnapshot> {
  return new Promise((resolve, reject) => {
    const snapshot: AppReloadSnapshot = {
      appPresent: false,
      appReplaced: false,
      pagePresent: false,
      rootVisible: false,
      route: '',
      width: 0,
      height: 0,
    }
    const app = getApp() as Record<string, unknown> | undefined
    if (!app || typeof app !== 'object' || Array.isArray(app)) {
      resolve(snapshot)
      return
    }
    snapshot.appPresent = true
    const token = app[marker.key]
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) {
      resolve(snapshot)
      return
    }
    snapshot.pagePresent = true
    snapshot.route = page.route
    const query = wx.createSelectorQuery().in(page)
    query.select(rootSelector).fields({ size: true })
    query.exec((results) => {
      try {
        // 只读查询跨过重载边界时，旧页面的尺寸不能作为新 App 已就绪的证据。
        const currentPages = getCurrentPages()
        if (getApp() !== app || app[marker.key] !== token || currentPages[currentPages.length - 1] !== page) {
          resolve(snapshot)
          return
        }
        const node = results[0] as { width?: number, height?: number } | null | undefined
        snapshot.width = Number(node?.width ?? 0)
        snapshot.height = Number(node?.height ?? 0)
        snapshot.rootVisible = snapshot.width > 0 && snapshot.height > 0
        snapshot.appReplaced = token !== marker.token
        resolve(snapshot)
      }
      catch (error) {
        reject(error)
      }
    })
  })
}

/** 重连后等待真正的新 App 和当前页面原生节点；不启动、编译或导航。 */
export async function waitForAppReload(
  session: AppReloadSession,
  marker: AppReloadMarker,
  rootSelector: string,
  timeoutMs = 30_000,
): Promise<AppReloadSnapshot> {
  const deadline = Date.now() + timeoutMs
  let latest: unknown
  while (Date.now() < deadline) {
    const readTimeout = Math.min(2_500, deadline - Date.now())
    if (readTimeout <= 0) {
      break
    }
    try {
      const result = await session.evaluateWithOptions(readAppReloadSnapshot, {
        timeout: readTimeout,
      }, marker, rootSelector) as AppReloadSnapshot | null | undefined
      latest = result
      if (result?.appPresent === true && result.appReplaced === true && result.pagePresent === true && result.rootVisible === true) {
        return result
      }
    }
    catch (error) {
      latest = { error: error instanceof Error ? error.message : String(error) }
    }
    const remaining = deadline - Date.now()
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(200, remaining)))
    }
  }
  throw new Error(`Timed out waiting for a replaced App and visible root ${rootSelector}; latest=${JSON.stringify(latest)}`)
}
