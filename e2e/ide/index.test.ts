import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll } from 'vitest'
import { formatWxml } from '../template-e2e.utils'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const INDEX_ROUTE = '/pages/index/index'
const LEADING_SLASH_RE = /^\/+/

function stripAutomatorOverlay(wxml: string) {
  // Strip devtools overlay styles appended by automator.
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function normalizeWxml(wxml: string) {
  return stripAutomatorOverlay(wxml).replace(/\s+(?:@tap|bind:tap|bindtap)=["'][^"']*["']/g, '')
}

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

async function waitForCurrentPage(miniProgram: any, expectedPath: string, timeoutMs = 15_000) {
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

async function readPageWxml(page: any) {
  return await runAutomatorOp('read page wxml', async () => {
    const element = await page.$('page')
    if (!element) {
      throw new Error('Failed to find page element')
    }
    return await element.wxml()
  }, {
    timeoutMs: 5_000,
    retries: 2,
    retryDelayMs: 180,
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
    const outputRoot = path.join(BASE_APP_ROOT, 'dist')
    await fs.remove(outputRoot)
    await runBuild(BASE_APP_ROOT)
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: BASE_APP_ROOT,
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

describe.sequential('e2e baseline app', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders index page wxml', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await runAutomatorOp(`reLaunch ${INDEX_ROUTE}`, () => miniProgram.reLaunch(INDEX_ROUTE), {
        timeoutMs: 20_000,
        retries: 3,
        retryDelayMs: 280,
      })
      if (!page) {
        throw new Error('Failed to launch index page')
      }

      const currentPage = await waitForCurrentPage(miniProgram, INDEX_ROUTE)
      if (!currentPage) {
        throw new Error('Failed to resolve current index page')
      }

      const wxml = normalizeWxml(await readPageWxml(currentPage))
      expect(await formatWxml(wxml)).toMatchSnapshot('wxml')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
