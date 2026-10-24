import type { launchAutomator } from './automator'
import type { createDomAcceptance } from './domAcceptance'
import type { DomCheckpoint } from './domAcceptance/types'
import type { createNativeHmrPublication } from './nativeHmrPublication'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'vitest'
import { captureAppReloadMarker, waitForAppReload } from './appReload'
import { reconnectAutomator } from './automator'
import { replaceFileByRename } from './hmr-helpers'

const ROUTE = '/pages/issue-1015/index'
const SHARED_STYLE_CHECKPOINTS = [
  { id: 'shared-sass-initial', hex: '#2468ac', color: 'rgb(36, 104, 172)' },
  { id: 'shared-sass-atomic-update', hex: '#ac6824', color: 'rgb(172, 104, 36)' },
  { id: 'shared-sass-restore', hex: '#2468ac', color: 'rgb(36, 104, 172)' },
] as const

export function issue1015SharedStyleCheckpoints(computedStyles: boolean): DomCheckpoint[] {
  return SHARED_STYLE_CHECKPOINTS.map(checkpoint => ({
    id: checkpoint.id,
    route: ROUTE,
    action: `检查 ${checkpoint.id} 独立共享 Sass 输出和页面颜色`,
    nodes: [{
      selector: '#issue-892-shared-style',
      text: 'shared Sass asset',
      attributes: { class: 'issue-892-shared-style' },
      ...(computedStyles ? { styles: { color: checkpoint.color }, visible: true } : {}),
    }],
  }))
}

interface SharedStyleHmrOptions {
  project: string
  computedStyles: boolean
  dom: ReturnType<typeof createDomAcceptance>
  publication: ReturnType<typeof createNativeHmrPublication>
  getHost: () => Awaited<ReturnType<typeof launchAutomator>>
  replaceHost: (host: Awaited<ReturnType<typeof launchAutomator>>) => void
  syncHeadlessFullBuild: () => Promise<void>
  captureRuntime: (id: string) => Promise<{ errors: unknown[] }>
  captureOutput: (id: string) => Promise<unknown>
}

/** 独立共享 Sass 只经配置注入，原子保存后由真实 IDE 自动重载；headless 仅验产物和逻辑节点。 */
export async function checkIssue1015SharedStyleHmr(options: SharedStyleHmrOptions) {
  const sourcePath = path.join(options.project, 'src/styles/issue-892-shared.scss')
  const emittedPath = path.join(options.project, 'dist/styles/issue-892-shared.wxss')
  const source = await readFile(sourcePath, 'utf8')
  const updated = source.replace('#2468ac', '#ac6824')
  expect(updated).not.toBe(source)
  expect(await readFile(path.join(options.project, 'dist/app.wxss'), 'utf8'))
    .toMatch(/@import\s+["']\.?\/?styles\/issue-892-shared\.wxss["']/)
  expect(options.publication.stateful).toBe(false)

  for (const [index, checkpoint] of SHARED_STYLE_CHECKPOINTS.entries()) {
    if (index > 0) {
      const reloadMarker = options.computedStyles ? await captureAppReloadMarker(options.getHost()) : undefined
      const published = options.publication.capture(sourcePath)
      await replaceFileByRename(sourcePath, index === 1 ? updated : source)
      await published.wait()
      if (reloadMarker) {
        // 重连仍使用原窗口 owner；必须观察新 App 和原路由，不能导航或手动编译。
        options.replaceHost(await reconnectAutomator(options.getHost()))
        const reloaded = await waitForAppReload(options.getHost(), reloadMarker, '#issue-892-shared-style')
        expect(reloaded.route).toBe(ROUTE.slice(1))
      }
    }
    await expect.poll(() => readFile(emittedPath, 'utf8'), { timeout: 45_000 }).toContain(checkpoint.hex)
    await options.captureOutput(`${checkpoint.id}-before-runtime`)
    // Node headless 没有磁盘重编译监听或 CSS 计算；VM 同步不作为 IDE 自动重载证据。
    await options.syncHeadlessFullBuild()
    const host = options.getHost()
    await options.dom.check(checkpoint.id, host, await host.currentPage())
    expect((await options.captureRuntime(checkpoint.id)).errors).toEqual([])
    await options.publication.assertClassicRuntime(host)
    await options.captureOutput(`${checkpoint.id}-passed`)
  }
}
