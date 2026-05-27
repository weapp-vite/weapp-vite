import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { readPageWxml } from './github-issues.runtime.shared'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const FEEDBACK_SELECTOR_WARNING = '未找到组件,请检查selector是否正确'
const HOME_ROUTE = '/pages/home/home'
const LAUNCH_RETRYABLE_PATTERN = /Timeout in launch automator|Timeout in warmup reLaunch|Timeout in warmup current page|Timeout in read current page|startsWith|WeChat DevTools CLI exited before automator socket was ready/i
const SESSION_RETRYABLE_PATTERN = /Timeout in raw reLaunch|Operation timed out after \d+ms|Connection closed, check if wechat web devTools is still running|WebSocket is not open|socket hang up|Target closed|not connected|Execution context was destroyed/i
const GOODS_DETAIL_PATH = 'pages/goods/details/index'
const SESSION_RETRY_COUNT = 2
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
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await cleanupResidualIdeProcesses()
      if (attempt > 0) {
        await cleanDevtoolsCache('compile', { cwd: TEMPLATE_ROOT }).catch(() => {})
      }
      return await launchAutomator({
        projectPath: TEMPLATE_ROOT,
        skipRelaunchPageRootCheck: true,
        warmupAnyPage: true,
        warmupRoute: HOME_ROUTE,
      })
    }
    catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (attempt === 1 || !LAUNCH_RETRYABLE_PATTERN.test(message)) {
        throw error
      }
      await sleep(1_500)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to launch retail feedback automator')
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

async function runWithRetailSessionRetry<T>(label: string, factory: (miniProgram: any) => Promise<T>) {
  let lastError: unknown

  for (let attempt = 1; attempt <= SESSION_RETRY_COUNT; attempt += 1) {
    const miniProgram = await getSharedMiniProgram()
    try {
      return await factory(miniProgram)
    }
    catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (attempt >= SESSION_RETRY_COUNT || !SESSION_RETRYABLE_PATTERN.test(message)) {
        throw error
      }

      process.stdout.write(
        `[retail-feedback-runtime] restart shared automator label=${label} attempt=${attempt + 1}/${SESSION_RETRY_COUNT} reason=${message.replace(/\s+/g, ' ').trim().slice(0, 240)}\n`,
      )
      await closeSharedMiniProgram()
      await sleep(1_500)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`[retail-feedback-runtime] failed after ${SESSION_RETRY_COUNT} attempts: ${label}`)
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

function isRetailPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(`Failed to resolve home page: ${HOME_ROUTE}`)
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('DevTools did not respond to protocol method App.getPageStack')
    || message.includes('Operation timed out after')
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
    // 当前微信开发者工具偶发无法返回 App 域路由栈，交给调用方重试会话。
  }
  throw new Error(`Failed to resolve home page: ${HOME_ROUTE}`)
}

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders the home page in WeChat DevTools', async () => {
    await runWithRetailSessionRetry('home-render', async (miniProgram) => {
      const collector = attachRuntimeErrorCollector(miniProgram)

      try {
        const marker = collector.mark()
        const page = await ensureHomePage(miniProgram)
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
    await runWithRetailSessionRetry('home-toast', async (miniProgram) => {
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
    await runWithRetailSessionRetry('home-goods-navigation', async (miniProgram) => {
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
    await runWithRetailSessionRetry('home-dialog', async (miniProgram) => {
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
