import { readFile, rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import { classText, tapRendered, xpathClass } from './tdesignDom'
import { RETAIL_FIRST_TITLE, RETAIL_FIXTURE, retailHomeCheckpoint } from './tdesignDom/retail'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const DIST_HOME_WXML = path.join(DIST_ROOT, 'pages/home/home.wxml')
const DIST_GOODS_CARD_WXML = path.join(DIST_ROOT, 'components/goods-card/index.wxml')
const DIST_GOODS_LIST_WXML = path.join(DIST_ROOT, 'components/goods-list/index.wxml')
const FEEDBACK_SELECTOR_WARNING = '未找到组件,请检查selector是否正确'
const HOME_ROUTE = '/pages/home/home'
const GOODS_DETAIL_PATH = 'pages/goods/details/index'
const HOME_STATE_STORAGE_KEY = '__weapp_vite_retail_home_state__'
const CURRENT_PAGE_READ_TIMEOUT = 2_000
const CURRENT_PAGE_READ_RETRIES = 1

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

async function runWithRetailSession<T>(factory: (miniProgram: any) => Promise<T>) {
  return await factory(await getSharedMiniProgram())
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

describe('template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders the home page in WeChat DevTools', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, RETAIL_FIXTURE, [retailHomeCheckpoint('initial', '打开首页检查四张商品卡、首件商品和分类')])
    await runWithRetailSession(async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)

      try {
        const marker = collector.mark()
        const homePage = await ensureHomePage(miniProgram)
        const { page, snapshot } = await waitForHomeReady(miniProgram, homePage)
        await acceptance.check('initial', miniProgram, page)
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
    const acceptance = createDomAcceptance(ctx, RETAIL_FIXTURE, [
      retailHomeCheckpoint('initial', '检查加入购物车前的商品列表'),
      { id: 'cart-toast', route: HOME_ROUTE, action: '点击首件商品的购物车按钮并检查 layout Toast', nodes: [classText('t-toast__text', '点击加入购物车')] },
      { id: 'toast-closed', route: HOME_ROUTE, action: 'Toast 关闭后商品列表仍然存在', nodes: [...retailHomeCheckpoint('unused', 'unused').nodes, { selector: xpathClass('t-toast__text'), query: 'xpath', count: 0 }] },
    ])
    await runWithRetailSession(async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)
      const warningCollector = attachConsoleWarningCollector(miniProgram)

      try {
        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        const { page } = await waitForHomeReady(miniProgram, await ensureHomePage(miniProgram))
        await acceptance.check('initial', miniProgram, page)
        await tapRendered(page, '//*[@id="home-goods-list-gd-0-cart"]')
        await acceptance.check('cart-toast', miniProgram, page)
        await acceptance.check('toast-closed', miniProgram, page)

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
    const acceptance = createDomAcceptance(ctx, RETAIL_FIXTURE, [
      retailHomeCheckpoint('initial', '检查准备点击的首件商品'),
      { id: 'goods-detail', route: GOODS_DETAIL_PATH, action: '点击真实商品标题，通过 goods-card 和 goods-list 事件进入详情', nodes: [classText('goods-name', RETAIL_FIRST_TITLE), classText('desc-content__title--text', '详情介绍')] },
    ])
    await runWithRetailSession(async (miniProgram) => {
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
        await acceptance.check('initial', miniProgram, page)
        await tapRendered(page, '//*[@id="home-goods-list-gd-0"]//*[contains(concat(" ", @class, " "), " goods-card__title ")]')
        const detailPage = await waitForCurrentPagePath(miniProgram, GOODS_DETAIL_PATH, 12_000)
        expect(detailPage, '商品点击应进入详情页').toBeTruthy()
        await acceptance.check('goods-detail', miniProgram, detailPage)

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
    const acceptance = createDomAcceptance(ctx, RETAIL_FIXTURE, [
      retailHomeCheckpoint('initial', '打开弹窗前检查首页商品列表'),
      { id: 'dialog-open', route: HOME_ROUTE, action: '调用页面反馈操作并检查真实 layout 弹窗', nodes: [classText('t-dialog__header', '布局弹窗'), classText('t-dialog__body-text', '验证 layout dialog 选择器桥接'), { selector: xpathClass('t-popup'), query: 'xpath', count: 1 }] },
      { id: 'dialog-closed', route: HOME_ROUTE, action: '点击弹窗取消按钮并检查弹窗消失', nodes: [...retailHomeCheckpoint('unused', 'unused').nodes, { selector: xpathClass('t-popup'), query: 'xpath', count: 0 }] },
    ])
    await runWithRetailSession(async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)
      const warningCollector = attachConsoleWarningCollector(miniProgram)

      try {
        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        const { page } = await waitForHomeReady(miniProgram, await ensureHomePage(miniProgram))
        await acceptance.check('initial', miniProgram, page)
        await page.callMethodWithOptions('showLayoutDialogProbe', { routeOnly: true, timeout: 12_000 })
        await acceptance.check('dialog-open', miniProgram, page)
        await tapRendered(page, `${xpathClass('t-dialog__footer')}//button[descendant::*[text()="取消"]]`)
        await acceptance.check('dialog-closed', miniProgram, page)

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
