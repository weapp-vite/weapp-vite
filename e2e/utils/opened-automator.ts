import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { connectOpenedAutomator, resolveProjectAutomatorPort } from 'weapp-ide-cli'
import { enhanceMiniProgramWithRuntimeLogs } from './automator'
import { resolveReportProjectPath } from './ideWarningReport'

interface OpenedAutomatorSessionMetadata {
  projectPath: string
  updatedAt: string
  wsEndpoint: string
}

interface WaitForOpenedAutomatorOptions {
  appReadyTimeoutMs?: number
  connectTimeoutMs?: number
  intervalMs?: number
  readyRoute?: string
  skipAppReady?: boolean
  timeoutMs?: number
}

const DEFAULT_APP_READY_TIMEOUT = 15_000

function isOpenedMiniProgram(value: unknown): value is MiniProgram {
  return !!value && typeof value === 'object' && typeof Reflect.get(value, 'currentPage') === 'function'
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatOpenedAutomatorError(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? 'unknown')
}

async function closeStaleMiniProgram(miniProgram: unknown) {
  if (!miniProgram || typeof miniProgram !== 'object') {
    return
  }

  const disconnect = Reflect.get(miniProgram, 'disconnect')
  if (typeof disconnect === 'function') {
    await Promise.resolve(disconnect.call(miniProgram)).catch(() => {})
  }
}

function normalizeRoute(route: string) {
  return route.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '')
}

async function waitForOpenedMiniProgramReady(miniProgram: MiniProgram, timeoutMs: number, intervalMs: number, readyRoute?: string) {
  const deadline = Date.now() + timeoutMs
  const expectedRoute = readyRoute ? normalizeRoute(readyRoute) : undefined
  let latestRoute = ''
  while (Date.now() < deadline) {
    // 启动和导航属于 dev:open；连接探针不能用 reLaunch 改写尚未完成的首屏加载。
    const page = await miniProgram.currentPage({
      retries: 1,
      timeout: Math.max(1, deadline - Date.now()),
    })
    latestRoute = typeof page?.path === 'string' ? normalizeRoute(page.path) : ''
    if (latestRoute && (!expectedRoute || latestRoute === expectedRoute)) {
      return
    }
    const remaining = deadline - Date.now()
    if (remaining > 0) {
      await delay(Math.min(intervalMs, remaining))
    }
  }
  throw new Error(`Opened automator page is not ready: expected ${expectedRoute ?? '<any route>'}, current ${latestRoute || '<none>'}`)
}

export async function waitForOpenedAutomator(
  projectPath: string,
  options: WaitForOpenedAutomatorOptions = {},
) {
  const {
    appReadyTimeoutMs = DEFAULT_APP_READY_TIMEOUT,
    connectTimeoutMs = 5_000,
    intervalMs = 500,
    readyRoute,
    skipAppReady = false,
    timeoutMs = 120_000,
  } = options
  const start = Date.now()
  let lastError: unknown
  const port = resolveProjectAutomatorPort(projectPath)
  const wsEndpoint = `ws://127.0.0.1:${port}`

  while (Date.now() - start <= timeoutMs) {
    try {
      const miniProgram = await connectOpenedAutomator({
        projectPath,
        port,
        timeout: connectTimeoutMs,
      })
      if (!isOpenedMiniProgram(miniProgram)) {
        throw new TypeError('Opened automator did not return a MiniProgram session with currentPage().')
      }
      try {
        enhanceMiniProgramWithRuntimeLogs(miniProgram, resolveReportProjectPath(projectPath))
        await miniProgram.enableLog(appReadyTimeoutMs, { structured: true })
      }
      catch (error) {
        await closeStaleMiniProgram(miniProgram)
        throw new Error(`Opened automator runtime log subscription failed: ${formatOpenedAutomatorError(error)}`, { cause: error })
      }
      if (!skipAppReady) {
        try {
          await waitForOpenedMiniProgramReady(miniProgram, Math.min(appReadyTimeoutMs, Math.max(1, timeoutMs - (Date.now() - start))), intervalMs, readyRoute)
        }
        catch (error) {
          lastError = error
          await closeStaleMiniProgram(miniProgram)
          await delay(intervalMs)
          continue
        }
      }
      return {
        metadata: {
          projectPath,
          updatedAt: new Date().toISOString(),
          wsEndpoint,
        } satisfies OpenedAutomatorSessionMetadata,
        miniProgram,
      }
    }
    catch (error) {
      lastError = error
    }
    await delay(intervalMs)
  }

  const reason = formatOpenedAutomatorError(lastError)
  throw new Error(`Timed out waiting for opened automator ${wsEndpoint} after ${timeoutMs}ms: ${reason}`)
}
