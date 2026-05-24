import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/plugin-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const PLUGIN_DIST_ROOT = path.join(APP_ROOT, 'dist-plugin')
const SKIPPED_PLUGIN_PROJECT_PAGE = Symbol('skipped-plugin-project-page')

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function countOccurrences(source: string, needle: string) {
  if (!needle) {
    return 0
  }
  return source.split(needle).length - 1
}

async function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  const task = Promise.resolve()
    .then(factory)
    .then((value) => {
      settled = true
      return value
    })
    .catch((error) => {
      settled = true
      throw error
    })
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
    if (!settled) {
      void task.catch(() => {})
    }
  }
}

function shouldRetryAutomatorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Wait timed out after')
    || message.includes('Timeout in ')
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
}

function isPluginProjectAutomatorPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Plugin project page protocol unavailable')
    || message.includes('Plugin project host page is not ready')
    || message.includes('Plugin project current page is not host')
    || message.includes('Plugin project current page is missing')
    || message.includes('Plugin project host marker is missing')
    || message.includes('Operation timed out after 2000ms')
    || message.includes('Operation timed out after 3000ms')
    || message.includes('Timeout in read plugin host current page')
    || message.includes('Timeout in read plugin host wxml')
    || message.includes('Timeout in query plugin host root')
    || message.includes('Timeout in read plugin host root wxml')
    || message.includes('Timeout in relaunch host')
    || message.includes('Timeout in raw reLaunch')
    || message.includes('Timed out waiting page root after reLaunch')
    || message.includes('reLaunch returned empty page')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Target closed')
}

function isDevtoolsPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Operation timed out after 1000ms')
    || message.includes('Operation timed out after 2000ms')
    || message.includes('Operation timed out after 3000ms')
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('DevTools did not respond to protocol method App.getPageStack')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Target closed')
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runAutomatorOp<T>(
  label: string,
  factory: () => Promise<T>,
  options: { timeoutMs?: number, retries?: number, retryDelayMs?: number } = {},
) {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryDelayMs = 220,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runWithTimeout(factory, timeoutMs, `${label}#${attempt}`)
    }
    catch (error) {
      lastError = error
      if (attempt < retries && shouldRetryAutomatorError(error)) {
        await delay(retryDelayMs)
        continue
      }
      throw error
    }
  }

  throw lastError
}

async function runBuild() {
  await cleanupResidualIdeProcesses()
  await cleanDevtoolsCache('all', { cwd: APP_ROOT }).catch(() => {})
  await fs.remove(DIST_ROOT)
  await fs.remove(PLUGIN_DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    label: 'ide:plugin-demo',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
    })
  }
  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await runAutomatorOp('close mini program', () => miniProgram.close(), {
    timeoutMs: 12_000,
    retries: 2,
    retryDelayMs: 200,
  }).catch(() => {})
}

async function readPageWxml(page: any) {
  const element = await runAutomatorOp('query page root', () => page.$('page'))
  if (!element) {
    throw new Error('Failed to find page element')
  }
  const wxml = await runAutomatorOp('read page wxml', () => element.wxml())
  return stripAutomatorOverlay(wxml)
}

async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  await element.tap()
  await page.waitFor(260)
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(/^\/+/, '')
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage({ retries: 1, timeout: 5_000 })
      if (normalizeRoutePath(page?.path ?? '') === normalizedExpectedPath) {
        return page
      }
    }
    catch {
    }
    await delay(220)
  }
  return null
}

async function waitForWxmlContains(page: any, text: string, timeoutMs = 12_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const wxml = await readPageWxml(page)
      if (wxml.includes(text)) {
        return true
      }
    }
    catch {
    }
    await delay(220)
  }
  return false
}

async function waitForRouteWithMarker(miniProgram: any, expectedPath: string, markerText: string, timeoutMs = 12_000) {
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

async function resolveHostPage(miniProgram: any) {
  let page: any
  try {
    page = await runWithTimeout(
      () => miniProgram.currentPage({ retries: 1, timeout: 3_000 }),
      4_000,
      'read plugin host current page',
    )
  }
  catch (error) {
    if (isDevtoolsPageProtocolUnavailable(error)) {
      throw new Error('Plugin project page protocol unavailable', { cause: error })
    }
    throw error
  }

  if (!page) {
    throw new Error('Plugin project current page is missing')
  }
  if (normalizeRoutePath(page.path ?? '') !== 'pages/index/index') {
    throw new Error(`Plugin project current page is not host: ${page.path ?? '<none>'}`)
  }

  let root: any
  try {
    root = await runWithTimeout(
      () => page.$('page'),
      3_000,
      'query plugin host root',
    )
  }
  catch (error) {
    if (isDevtoolsPageProtocolUnavailable(error)) {
      throw new Error('Plugin project page protocol unavailable', { cause: error })
    }
    throw error
  }
  if (!root) {
    throw new Error('Plugin project host page is not ready')
  }

  const wxml = await runWithTimeout(
    () => root.wxml(),
    3_000,
    'read plugin host root wxml',
  )
  const strippedWxml = stripAutomatorOverlay(wxml)
  if (!strippedWxml.includes('宿主页面直接消费插件导出的 TS API')) {
    throw new Error('Plugin project host marker is missing')
  }
  return page
}

describe.sequential('plugin-demo runtime (ide)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('loads host page, renders plugin public components, and opens plugin vue page without runtime errors', async (ctx) => {
    const miniProgram = await getSharedMiniProgram()
    const errorCollector = attachRuntimeErrorCollector(miniProgram)
    const marker = errorCollector.mark()

    try {
      async function runStep<T>(label: string, task: () => Promise<T>) {
        try {
          return await task()
        }
        catch (error) {
          const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          throw new Error(`[plugin-demo:${label}] ${reason}`)
        }
      }

      const page = await runStep('resolve-host', () => resolveHostPage(miniProgram))
        .catch((error) => {
          if (isPluginProjectAutomatorPageProtocolUnavailable(error)) {
            ctx.skip('当前微信开发者工具在插件项目模式下未返回 automator 页面协议，跳过 plugin-demo IDE runtime。')
            return SKIPPED_PLUGIN_PROJECT_PAGE
          }
          throw error
        })
      if (page === SKIPPED_PLUGIN_PROJECT_PAGE) {
        return
      }
      if (!page) {
        throw new Error('Failed to launch /pages/index/index')
      }

      await runStep('host-ready', async () => {
        const ready = await waitForWxmlContains(page, '宿主页面直接消费插件导出的 TS API')
        if (!ready) {
          throw new Error('Host page did not reach ready marker')
        }
      })

      const indexWxml = await runStep('host-read-wxml', () => readPageWxml(page))
      expect(indexWxml).toContain('宿主页面直接消费插件导出的 TS API')
      expect(indexWxml).toContain('plugin-private://wxb3d842a4a7e3440d/components/hello-component/index')
      expect(indexWxml).toContain('plugin-private://wxb3d842a4a7e3440d/components/native-meter/index')
      expect(indexWxml).toContain('切换插件原生组件进度')
      expect(indexWxml).toContain('style="width: 78%;"')

      await runStep('host-tap-button', () => tapElement(page, '.panel__button'))
      const updatedIndexWxml = await runStep('host-read-updated-wxml', () => readPageWxml(page))
      expect(updatedIndexWxml).toContain('style="width: 84%;"')

      await runStep('host-open-vue-plugin', () => tapElement(page, '.nav-card'))
      const vuePluginPage = await runStep(
        'wait-vue-plugin-path',
        () => waitForRouteWithMarker(miniProgram, 'plugin-private://wxb3d842a4a7e3440d/pages/hello-page/index', '切换页面内评分'),
      )
      expect(vuePluginPage).not.toBeNull()

      const vuePluginWxml = await runStep('vue-plugin-read-wxml', () => readPageWxml(vuePluginPage))
      expect(vuePluginWxml).toContain('切换页面内评分')
      expect(vuePluginWxml).toContain('style="width: 94%"')
      expect(countOccurrences(vuePluginWxml, 'class="overview__item"')).toBe(4)
      expect(vuePluginWxml).toContain('meter__bar meter__bar--success')

      await runStep('vue-plugin-tap-button', () => tapElement(vuePluginPage, '.panel__button'))
      const updatedVuePluginWxml = await runStep('vue-plugin-read-updated-wxml', () => readPageWxml(vuePluginPage))
      expect(updatedVuePluginWxml).toContain('style="width: 100%"')

      const runtimeErrors = await runStep('collect-runtime-errors', async () => errorCollector.getSince(marker))
      expect(runtimeErrors).toEqual([])
    }
    finally {
      errorCollector.dispose()
    }
  })
})
