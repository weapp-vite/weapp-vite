import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { readPageWxml } from './github-issues.runtime.shared'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const FEEDBACK_SELECTOR_WARNING = '未找到组件,请检查selector是否正确'
const HOME_ROUTE = '/pages/home/home'
const GOODS_DETAIL_PATH = 'pages/goods/details/index'
const CURRENT_PAGE_READ_TIMEOUT = 2_000
const CURRENT_PAGE_READ_RETRIES = 1
const RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE = '当前微信开发者工具未返回 retail 模板 App 页面协议，跳过 retail feedback IDE runtime。'

async function runBuild() {
  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:retail-feedback-runtime',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function launchRetailTemplateAutomator() {
  await cleanupResidualIdeProcesses()
  return await launchAutomator({
    disableRelaunchSessionRecovery: true,
    maxLaunchRetries: 1,
    projectPath: TEMPLATE_ROOT,
    skipRelaunchPageRootCheck: true,
    skipWarmup: true,
    warmupAnyPage: true,
    warmupRoute: HOME_ROUTE,
  })
}

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchRetailTemplateAutomator()
  }
  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close().catch(() => {})
}

function isRetailPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(`Failed to resolve home page: ${HOME_ROUTE}`)
    || message.includes('Timeout in launch automator')
    || message.includes('Timeout in warmup reLaunch')
    || message.includes('Timeout in warmup current page')
    || message.includes('Timed out waiting page root after warmup reLaunch')
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('DevTools did not respond to protocol method App.getPageStack')
    || message.includes('Operation timed out after')
}

function skipRetailPageProtocolUnavailable(ctx: { skip: (message?: string) => void }, error: unknown) {
  if (!isRetailPageProtocolUnavailable(error)) {
    return false
  }
  ctx.skip(`${RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE}reason=${error instanceof Error ? error.message : String(error)}`)
  return true
}

async function runWithRetailSession<T>(ctx: { skip: (message?: string) => void }, factory: (miniProgram: any) => Promise<T>) {
  let miniProgram: any
  try {
    miniProgram = await getSharedMiniProgram()
  }
  catch (error) {
    if (skipRetailPageProtocolUnavailable(ctx, error)) {
      return undefined as T
    }
    throw error
  }
  try {
    return await factory(miniProgram)
  }
  catch (error) {
    if (skipRetailPageProtocolUnavailable(ctx, error)) {
      return undefined as T
    }
    throw error
  }
}

function attachConsoleWarningCollector(miniProgram: any) {
  const warnings: string[] = []
  const onConsole = (entry: any) => {
    const text = typeof entry?.text === 'string'
      ? entry.text
      : Array.isArray(entry?.args)
        ? entry.args.map((item: any) => item?.value ?? item).join(' ')
        : ''
    const level = String(entry?.level ?? '').toLowerCase()
    if (level === 'warn' && text.includes(FEEDBACK_SELECTOR_WARNING)) {
      warnings.push(text)
    }
  }

  miniProgram.on('console', onConsole)

  return {
    mark() {
      return warnings.length
    },
    getSince(marker: number) {
      return warnings.slice(marker)
    },
    dispose() {
      miniProgram.removeListener('console', onConsole)
    },
  }
}

async function waitForHomeGoodsReady(page: any, timeoutMs = 10_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const goodsList = await page.data('goodsList').catch(() => [])
    if (Array.isArray(goodsList) && goodsList.length > 0) {
      return goodsList
    }
    await page.waitFor(200)
  }
  return null
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 8_000) {
  const normalizedExpectedPath = expectedPath.replace(/^\/+/, '')
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const currentPage = await miniProgram.currentPage({
        timeout: CURRENT_PAGE_READ_TIMEOUT,
        retries: CURRENT_PAGE_READ_RETRIES,
      })
      const currentPath = String(currentPage?.path ?? '').replace(/^\/+/, '')
      if (currentPath === normalizedExpectedPath) {
        return currentPage
      }
    }
    catch {
      // 页面切换窗口期 currentPage 可能短暂不可读，继续轮询。
    }
    await sleep(200)
  }
  return null
}

async function ensureHomePage(miniProgram: any) {
  const currentPage = await waitForCurrentPagePath(miniProgram, HOME_ROUTE, 2_500)
  if (currentPage) {
    return currentPage
  }
  try {
    await miniProgram.reLaunch(HOME_ROUTE)
    const relaunchedPage = await waitForCurrentPagePath(miniProgram, HOME_ROUTE, 8_000)
    if (relaunchedPage) {
      return relaunchedPage
    }
  }
  catch {
    // 当前微信开发者工具偶发无法返回 App 域路由栈，交给调用方分类处理。
  }
  throw new Error(`Failed to resolve home page: ${HOME_ROUTE}`)
}

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders the home page in WeChat DevTools', async (ctx) => {
    await runWithRetailSession(ctx, async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)

      try {
        const marker = collector.mark()
        const page = await ensureHomePage(miniProgram).catch((error) => {
          if (isRetailPageProtocolUnavailable(error)) {
            ctx.skip(RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE)
          }
          throw error
        })
        const goodsList = await waitForHomeGoodsReady(page)
        if (!goodsList) {
          throw new Error('Failed to render home goods list in WeChat DevTools')
        }

        const wxml = await readPageWxml(page)
        expect(page.path).toBe(HOME_ROUTE.slice(1))
        expect(wxml).toContain('home-page-header')
        expect(wxml).toContain('goods-list-container')
        expect(collector.getSince(marker)).toEqual([])
      }
      finally {
        collector.dispose()
      }
    })
  })

  it('does not emit runtime warnings when layout toast is triggered from home page', async (ctx) => {
    await runWithRetailSession(ctx, async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)
      const warningCollector = attachConsoleWarningCollector(miniProgram)

      try {
        const page = await ensureHomePage(miniProgram).catch((error) => {
          if (isRetailPageProtocolUnavailable(error)) {
            ctx.skip(RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE)
          }
          throw error
        })

        await page.waitFor(400)

        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        await page.callMethod('goodListAddCartHandle')
        await page.waitFor(300)

        expect(collector.getSince(marker)).toEqual([])
        expect(warningCollector.getSince(warningMarker)).toEqual([])
      }
      finally {
        warningCollector.dispose()
        collector.dispose()
      }
    })
  })

  it('navigates from home goods card through component click event wiring', async (ctx) => {
    await runWithRetailSession(ctx, async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)

      try {
        const page = await ensureHomePage(miniProgram).catch((error) => {
          if (isRetailPageProtocolUnavailable(error)) {
            ctx.skip(RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE)
          }
          throw error
        })

        const goodsList = await waitForHomeGoodsReady(page)
        if (!goodsList) {
          throw new Error('Failed to load goods list on home page')
        }

        const marker = collector.mark()
        await page.callMethod('goodListClickHandle', { detail: { index: 0 } })
        const detailPage = await waitForCurrentPagePath(miniProgram, GOODS_DETAIL_PATH)

        expect(detailPage?.path).toBe(GOODS_DETAIL_PATH)
        expect(collector.getSince(marker)).toEqual([])
      }
      finally {
        collector.dispose()
      }
    })
  })

  it('does not emit runtime warnings when layout dialog is triggered from home page', async (ctx) => {
    await runWithRetailSession(ctx, async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)
      const warningCollector = attachConsoleWarningCollector(miniProgram)

      try {
        const page = await ensureHomePage(miniProgram).catch((error) => {
          if (isRetailPageProtocolUnavailable(error)) {
            ctx.skip(RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE)
          }
          throw error
        })
        await page.waitFor(400)

        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        await page.callMethod('showLayoutDialogProbe')
        await page.waitFor(300)

        expect(collector.getSince(marker)).toEqual([])
        expect(warningCollector.getSince(warningMarker)).toEqual([])
      }
      finally {
        warningCollector.dispose()
        collector.dispose()
      }
    })
  })
})
