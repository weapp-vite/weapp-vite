import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const AUTOMATOR_OVERLAY_RE = /\s*\.luna-dom-highlighter[\s\S]*$/
const WHITESPACE_RE = /\s+/g
const REGEXP_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g
const LEADING_SLASH_RE = /^\/+/
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-features')
export const DIST_ROOT = path.join(APP_ROOT, 'dist')

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(AUTOMATOR_OVERLAY_RE, '')
}

function normalizeValue(value: string) {
  return value.trim().replace(WHITESPACE_RE, ' ')
}

function escapeRegExp(input: string) {
  return input.replace(REGEXP_ESCAPE_RE, '\\$&')
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASH_RE, '')
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function waitForWxmlContains(page: any, text: string, timeoutMs = 15_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const wxml = await readPageWxml(page)
      if (wxml.includes(text)) {
        return true
      }
    }
    catch {
      // 页面还未就绪时继续轮询，避免偶发 reLaunch 后瞬时空白导致失败。
    }
    await page.waitFor(220)
  }
  return false
}

export async function relaunchPage(miniProgram: any, route: string, readyText: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let page: any = null
    try {
      page = await miniProgram.reLaunch(route)
    }
    catch {
      await delay(280)
      continue
    }
    if (!page) {
      await delay(220)
      continue
    }
    const ready = await waitForWxmlContains(page, readyText)
    if (ready) {
      return page
    }
    await delay(220)
  }
  return null
}

export async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 15_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      if (normalizeRoutePath(page?.path ?? '') === normalizedExpectedPath) {
        return page
      }
      if (typeof page?.waitFor === 'function') {
        try {
          await page.waitFor(220)
          continue
        }
        catch {
          // 页面对象短暂失效时降级为 sleep，避免中断轮询。
        }
      }
    }
    catch {
      // currentPage 在路由切换窗口可能发生 transport timeout，继续轮询。
    }
    await delay(220)
  }
  return null
}

export const ROUTER_NAVIGATION_SETTLE_TIMEOUT = 5_000

export async function waitForRouteWithMarker(miniProgram: any, expectedPath: string, markerText: string, timeoutMs = 15_000) {
  const page = await waitForCurrentPagePath(miniProgram, expectedPath, timeoutMs)
  if (!page) {
    return null
  }
  const ready = await waitForWxmlContains(page, markerText, timeoutMs)
  if (!ready) {
    return null
  }
  return page
}

export async function resolveSelectorById(page: any, id: string) {
  const directSelector = `#${id}`
  let directElement: any = null
  try {
    directElement = await page.$(directSelector)
  }
  catch {
    // automator 在页面切换瞬态可能抛 timeout，继续走 wxml 兜底解析。
  }
  if (directElement) {
    return directSelector
  }

  const wxml = await readPageWxml(page)
  const scopedMatch = wxml.match(new RegExp(`id="([^"]*${escapeRegExp(id)})"`))
  if (scopedMatch?.[1]) {
    return `#${scopedMatch[1]}`
  }

  throw new Error(`Failed to resolve id selector: ${id}`)
}

export async function readClassName(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  return normalizeValue(await element.attribute('class') ?? '')
}

export async function readStyleValue(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  return normalizeValue(await element.attribute('style') ?? '')
}

export async function tapControlUntil(page: any, tapSelector: string, checker: () => Promise<boolean>) {
  let controlElement: any = null
  try {
    controlElement = await page.$(tapSelector)
  }
  catch {
    // 页面切换瞬态可能导致查询超时，继续执行备用选择器查询。
  }
  if (!controlElement && tapSelector.startsWith('#')) {
    const scopedSelector = `[id="${tapSelector.slice(1)}"]`
    try {
      controlElement = await page.$(scopedSelector)
    }
    catch {
      // 交给后续的找不到元素报错统一处理。
    }
  }
  if (!controlElement) {
    throw new Error(`Failed to find tap element: ${tapSelector}`)
  }

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await controlElement.tap()
      return
    }
    if (mode === 'trigger') {
      await controlElement.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await controlElement.touchstart()
      await controlElement.touchend()
      return
    }
    await controlElement.dispatchEvent({ eventName: 'tap' })
  }

  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    for (let index = 0; index < 2; index += 1) {
      try {
        await fireTapLikeEvent(mode)
      }
      catch {
      }

      await page.waitFor(220)
      if (await checker()) {
        return true
      }
    }
  }

  return checker()
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: APP_ROOT,
    label: 'ide:wevu-features',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

export async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      timeout: 120_000,
    })
  }
  return sharedMiniProgram
}

export async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

export async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

export async function launchIsolatedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (sharedMiniProgram) {
    await closeSharedMiniProgram()
  }
  return await launchAutomator({
    projectPath: APP_ROOT,
    timeout: 120_000,
  })
}
