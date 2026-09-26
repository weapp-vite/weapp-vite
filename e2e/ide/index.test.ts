import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { ok as assert } from 'node:assert'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const BASE_APP_DIST_ROOT = path.join(BASE_APP_ROOT, 'dist')
const INDEX_ROUTE = '/pages/index/index'
const LEADING_SLASH_RE = /^\/+/

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
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

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASH_RE, '')
}

async function waitForCurrentPage(miniProgram: MiniProgram, expectedPath: string, timeoutMs = 15_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await runAutomatorOp('read current page', () => miniProgram.currentPage(), {
        timeoutMs: 5_000,
        retries: 2,
        retryDelayMs: 180,
      })
      if (normalizeRoutePath(String(page?.path ?? '')) === normalizedExpectedPath) {
        return page
      }
    }
    catch {
    }
    await delay(220)
  }
  return null
}

async function readCurrentPageData(miniProgram: any) {
  return await runAutomatorOp('read current page data', async () => {
    return await miniProgram.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const page = pages[pages.length - 1] as any
      return {
        data: page?.data ?? null,
        path: page?.route || page?.__route__ || page?.path || '',
      }
    })
  }, {
    timeoutMs: 2_000,
    retries: 15,
    retryDelayMs: 300,
  })
}

async function runBuild(root: string) {
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: root,
    platform: 'weapp',
    skipNpm: true,
    label: `ide:index:${path.basename(root)}`,
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await fs.remove(BASE_APP_DIST_ROOT)
    await runBuild(BASE_APP_ROOT)
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: BASE_APP_ROOT,
      retryWarmupTimeout: true,
      warmupRootSelectors: ['#base-index-page'],
      warmupRoute: INDEX_ROUTE,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe('e2e baseline app', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('opens index page and keeps build output stable', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/base', [
      {
        id: 'initial',
        route: INDEX_ROUTE,
        action: '冷启动首页，检查实际结果和输入数据文本',
        nodes: [
          { selector: '#base-greeting', text: 'Hello' },
          { selector: '#base-status', text: 'Status: ready' },
          { selector: '#base-detail', text: 'Detail: rendered' },
          { selector: '#base-data-greeting', text: 'Greeting: Hello' },
          { selector: '#base-target', text: 'Target: index snapshot' },
          { selector: '.panel-row', count: 4 },
        ],
      },
      {
        id: 'tapped',
        route: INDEX_ROUTE,
        action: '点击问候文本，检查事件结果更新且输入数据保持',
        nodes: [
          { selector: '#base-status', text: 'Status: tapped' },
          { selector: '#base-detail', text: 'Detail: tap handled' },
          { selector: '#base-data-greeting', text: 'Greeting: Hello' },
          { selector: '#base-target', text: 'Target: index snapshot' },
        ],
      },
    ])
    const miniProgram = await getSharedMiniProgram()

    try {
      const currentPage = await waitForCurrentPage(miniProgram, INDEX_ROUTE)
      if (!currentPage) {
        throw new Error('Failed to resolve current index page')
      }

      await dom.check('initial', miniProgram, currentPage)

      const runtime = await readCurrentPageData(miniProgram)
      expect(normalizeRoutePath(String(runtime?.path ?? ''))).toBe(normalizeRoutePath(INDEX_ROUTE))
      expect(runtime?.data).toMatchObject({
        __e2eData: {
          greeting: 'Hello',
          target: 'index snapshot',
        },
        __e2eResult: {
          status: 'ready',
          detail: 'rendered',
        },
      })

      const distWxml = await fs.readFile(path.join(BASE_APP_DIST_ROOT, 'pages/index/index.wxml'), 'utf8')
      expect(distWxml).toContain('<view id="base-index-page" data-e2e-status="{{__e2eResult.status}}">')
      expect(distWxml).toContain('<view id="base-greeting" bind:tap="onTap">Hello</view>')
      expect(distWxml).toContain('Status: {{__e2eResult.status}}')
      expect(distWxml).toContain('Target: {{__e2eData.target}}')
      const greeting = await currentPage.$('#base-greeting')
      assert(greeting, 'Expected base greeting control')
      await greeting.tap()
      await dom.check('tapped', miniProgram, currentPage)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
