import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/auto-routes-define-app-json')
const HOME_ROUTE = '/pages/home/index'
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const LEADING_SLASH_RE = /^\/+/

async function runBuild() {
  const outputRoot = path.join(APP_ROOT, 'dist')
  await fs.remove(outputRoot)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    label: 'ide:auto-routes-define-app-json',
  })
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

async function waitForRouteLinks(miniProgram: any, timeoutMs = 12_000, intervalMs = 240) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const page = await waitForCurrentPage(miniProgram, HOME_ROUTE, 3_000)
    if (!page) {
      await delay(intervalMs)
      continue
    }

    try {
      const routeLinks = await runAutomatorOp('read routeLinks', () => page.data('routeLinks'), {
        timeoutMs: 5_000,
        retries: 2,
        retryDelayMs: 180,
      })
      if (Array.isArray(routeLinks) && routeLinks.length > 0) {
        return routeLinks
      }
    }
    catch {
    }

    try {
      await page.waitFor(intervalMs)
      continue
    }
    catch {
    }
    await delay(intervalMs)
  }
  return []
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
    try {
      delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
      sharedMiniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
    }
    finally {
      if (previousSkipWarmup == null) {
        delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
      }
      else {
        process.env[AUTOMATOR_SKIP_WARMUP_ENV] = previousSkipWarmup
      }
    }
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

describe.sequential('auto-routes define app json runtime (weapp e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders routeLinks for home page with main package and subpackage routes', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await runAutomatorOp(`reLaunch ${HOME_ROUTE}`, () => miniProgram.reLaunch(HOME_ROUTE), {
        timeoutMs: 20_000,
        retries: 3,
        retryDelayMs: 280,
      })
      if (!page) {
        throw new Error(`Failed to launch ${HOME_ROUTE}`)
      }

      const routeLinks = await waitForRouteLinks(miniProgram)
      expect(routeLinks.length).toBeGreaterThan(0)

      const routes = routeLinks
        .map((item: any) => item?.route)
        .filter((item: unknown): item is string => typeof item === 'string')

      expect(routes).toContain('pages/home/index')
      expect(routes).toContain('subpackages/lab/pages/state-playground/index')
      expect(routes).toContain('subpackages/marketing/pages/campaign/index')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
