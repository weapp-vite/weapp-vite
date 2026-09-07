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

async function waitForOpenedMiniProgramReady(miniProgram: unknown, timeoutMs: number, readyRoute?: string) {
  if (!miniProgram || typeof miniProgram !== 'object') {
    return
  }

  const sendOptions = {
    retries: 1,
    timeout: timeoutMs,
  }
  if (readyRoute) {
    const reLaunch = Reflect.get(miniProgram, 'reLaunch')
    if (typeof reLaunch === 'function') {
      await reLaunch.call(miniProgram, readyRoute)
      return
    }
  }

  const currentPage = Reflect.get(miniProgram, 'currentPage')
  if (typeof currentPage === 'function') {
    await currentPage.call(miniProgram, sendOptions)
    return
  }

  const waitForAppReady = Reflect.get(miniProgram, 'waitForAppReady')
  if (typeof waitForAppReady === 'function') {
    await waitForAppReady.call(miniProgram, timeoutMs)
  }
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
        await miniProgram.enableLog(appReadyTimeoutMs)
      }
      catch (error) {
        await closeStaleMiniProgram(miniProgram)
        throw new Error(`Opened automator runtime log subscription failed: ${formatOpenedAutomatorError(error)}`, { cause: error })
      }
      if (!skipAppReady) {
        try {
          await waitForOpenedMiniProgramReady(miniProgram, appReadyTimeoutMs, readyRoute)
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
