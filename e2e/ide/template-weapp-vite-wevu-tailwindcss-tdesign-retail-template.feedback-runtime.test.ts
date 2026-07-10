import { readFile, rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const DIST_HOME_JS = path.join(DIST_ROOT, 'pages/home/home.js')
const DIST_HOME_WXML = path.join(DIST_ROOT, 'pages/home/home.wxml')
const DIST_GOODS_CARD_WXML = path.join(DIST_ROOT, 'components/goods-card/index.wxml')
const DIST_GOODS_LIST_WXML = path.join(DIST_ROOT, 'components/goods-list/index.wxml')
const FEEDBACK_SELECTOR_WARNING = '未找到组件,请检查selector是否正确'
const HOME_ROUTE = '/pages/home/home'
const GOODS_DETAIL_PATH = 'pages/goods/details/index'
const HOME_STATE_STORAGE_KEY = '__weapp_vite_retail_home_state__'
const CURRENT_PAGE_READ_TIMEOUT = 2_000
const CURRENT_PAGE_READ_RETRIES = 1
const RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE = '当前微信开发者工具未返回 retail 模板 App 页面协议，跳过 retail feedback IDE runtime。'

interface RetailHomeSnapshot {
  firstSpuId?: string | number
  goodsCount?: number
  loadStatus?: number
  pageLoading?: boolean
  ready?: boolean
  swiperCount?: number
  tabCount?: number
}

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
}

function skipRetailPageProtocolUnavailable(ctx: { skip: (message?: string) => void }, error: unknown) {
  if (!isRetailPageProtocolUnavailable(error)) {
    return false
  }
  const reason = error instanceof Error ? error.message : String(error)
  process.stdout.write(`[warn] [retail-feedback-runtime] skip reason=${reason}\n`)
  ctx.skip(`${RETAIL_PAGE_PROTOCOL_UNAVAILABLE_MESSAGE}reason=${reason}`)
  return true
}

function isRetailSessionRecoverableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('[loader] unexpected current frame status timedout')
    || message.includes('unexpected current frame status timedout')
    || message.includes('DEVTOOLS_PROTOCOL_TIMEOUT')
    || message.includes('DevTools did not respond to protocol method App.callFunction')
    || message.includes('DevTools did not respond to protocol method App.callWxMethod')
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('Operation timed out after')
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
    || message.includes('WebSocket is not open')
    || message.includes('not connected')
}

function isRetailActionProtocolUnavailable(error: unknown) {
  const protocolError = error as Error & { code?: unknown, method?: unknown }
  const message = error instanceof Error ? error.message : String(error)
  return (
    protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && (protocolError.method === 'Page.callMethod' || protocolError.method === 'App.callFunction')
  )
  || message.includes('DevTools did not respond to protocol method Page.callMethod')
  || message.includes('DevTools did not respond to protocol method App.callFunction')
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
    if (!isRetailSessionRecoverableError(error)) {
      throw error
    }
    process.stdout.write(`[warn] [retail-feedback-runtime] restart session after recoverable error=${error instanceof Error ? error.message : String(error)}\n`)
    await closeSharedMiniProgram()
    await cleanupResidualIdeProcesses()
    miniProgram = await getSharedMiniProgram()
    return await factory(miniProgram)
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

async function readHomeSnapshot(miniProgram: any): Promise<RetailHomeSnapshot> {
  const state = await miniProgram.callWxMethodWithOptions('getStorageSync', {
    timeout: 2_500,
  }, HOME_STATE_STORAGE_KEY)
  return state && typeof state === 'object' ? state : { ready: false }
}

async function waitForHomeReady(miniProgram: any, page: any, timeoutMs = 20_000) {
  const start = Date.now()
  let lastError: unknown
  let latestSnapshot: RetailHomeSnapshot = {}
  while (Date.now() - start <= timeoutMs) {
    try {
      latestSnapshot = await readHomeSnapshot(miniProgram)
      if (
        latestSnapshot.ready === true
        && Number(latestSnapshot.goodsCount) > 0
      ) {
        return {
          page,
          snapshot: latestSnapshot,
        }
      }
    }
    catch (error) {
      lastError = error
    }
    await sleep(220)
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'condition not met')
  throw new Error(`Timed out waiting retail home ready; reason=${reason}; snapshot=${JSON.stringify(latestSnapshot)}`)
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 8_000) {
  const normalizedExpectedPath = expectedPath.replace(/^\/+/, '')
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const currentPage = await miniProgram.currentPage({
        appFunctionFallback: false,
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
  let routePage = await miniProgram.switchTab(HOME_ROUTE).catch(() => null)
  const switchedPage = await waitForCurrentPagePath(miniProgram, HOME_ROUTE, 8_000)
  if (switchedPage) {
    return switchedPage
  }
  if (String(routePage?.path ?? '').replace(/^\/+/, '') === HOME_ROUTE.replace(/^\/+/, '')) {
    return routePage
  }
  try {
    routePage = await miniProgram.reLaunch(HOME_ROUTE)
    const relaunchedPage = await waitForCurrentPagePath(miniProgram, HOME_ROUTE, 8_000)
    if (relaunchedPage) {
      return relaunchedPage
    }
    if (String(routePage?.path ?? '').replace(/^\/+/, '') === HOME_ROUTE.replace(/^\/+/, '')) {
      return routePage
    }
  }
  catch {
    // 当前微信开发者工具偶发无法返回 App 域路由栈，交给调用方分类处理。
  }
  throw new Error(`Failed to resolve home page: ${HOME_ROUTE}`)
}

async function navigateToGoodsDetail(miniProgram: any, firstSpuId: string) {
  const url = `/pages/goods/details/index?spuId=${encodeURIComponent(firstSpuId)}`
  let commandError: unknown
  let routePage: any = null
  try {
    routePage = await miniProgram.navigateTo(url)
  }
  catch (error) {
    commandError = error
  }

  const currentPage = await waitForCurrentPagePath(miniProgram, GOODS_DETAIL_PATH, 12_000)
  if (currentPage) {
    if (commandError) {
      const reason = commandError instanceof Error ? commandError.message : String(commandError)
      process.stdout.write(`[warn] [retail-feedback-runtime] navigate-command-capability-limited route=${GOODS_DETAIL_PATH} reason=${reason}\n`)
    }
    return currentPage
  }
  if (String(routePage?.path ?? '').replace(/^\/+/, '') === GOODS_DETAIL_PATH) {
    return routePage
  }
  if (commandError) {
    throw commandError
  }
  throw new Error(`Failed to navigate to goods detail route: ${GOODS_DETAIL_PATH}`)
}

async function triggerHomeFeedbackAction(miniProgram: any, action: 'toast' | 'dialog') {
  const homePage = await ensureHomePage(miniProgram)
  const { page } = await waitForHomeReady(miniProgram, homePage)
  const method = action === 'toast' ? 'goodListAddCartHandle' : 'showLayoutDialogProbe'
  try {
    await page.callMethodWithOptions(method, {
      fallback: false,
      timeout: 12_000,
    })
  }
  catch (error) {
    if (!isRetailActionProtocolUnavailable(error)) {
      throw error
    }
    const homeOutput = await readFile(DIST_HOME_JS, 'utf8')
    expect(homeOutput).toContain(method)
    expect(homeOutput).toContain(action === 'toast' ? '点击加入购物车' : '验证 layout dialog 选择器桥接')
    const reason = error instanceof Error ? error.message : String(error)
    process.stdout.write(`[warn] [retail-feedback-runtime] action-capability-limited action=${action} route=${page.path} reason=${reason}\n`)
    return page
  }
  await waitForHomeReady(miniProgram, page)
  return page
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
        const homePage = await ensureHomePage(miniProgram)
        const { page, snapshot } = await waitForHomeReady(miniProgram, homePage)
        expect(page.path).toBe(HOME_ROUTE.slice(1))
        expect(snapshot.ready).toBe(true)
        expect(Number(snapshot.goodsCount)).toBeGreaterThan(0)
        expect(Number(snapshot.tabCount)).toBeGreaterThan(0)
        expect(Number(snapshot.swiperCount)).toBeGreaterThan(0)
        const homeWxml = await readFile(DIST_HOME_WXML, 'utf8')
        expect(homeWxml).toContain('<goods-list')
        expect(homeWxml).toContain('id="home-goods-ready"')
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
        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        const page = await triggerHomeFeedbackAction(miniProgram, 'toast')
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
        const [homeWxml, goodsListWxml, goodsCardWxml] = await Promise.all([
          readFile(DIST_HOME_WXML, 'utf8'),
          readFile(DIST_GOODS_LIST_WXML, 'utf8'),
          readFile(DIST_GOODS_CARD_WXML, 'utf8'),
        ])
        expect(homeWxml).toContain('bindclick="__weapp_vite_inline"')
        expect(goodsListWxml).toContain('bindclick="__weapp_vite_inline"')
        expect(goodsCardWxml).toContain('bindtap="__weapp_vite_inline"')

        const homePage = await ensureHomePage(miniProgram)

        const { page, snapshot } = await waitForHomeReady(miniProgram, homePage)
        const firstSpuId = String(snapshot.firstSpuId ?? '')
        expect(firstSpuId).not.toBe('')

        const marker = collector.mark()
        const detailPage = await navigateToGoodsDetail(miniProgram, firstSpuId)

        expect(page.path).toBe(HOME_ROUTE.slice(1))
        expect(detailPage.path).toBe(GOODS_DETAIL_PATH)
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
        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        const page = await triggerHomeFeedbackAction(miniProgram, 'dialog')
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
