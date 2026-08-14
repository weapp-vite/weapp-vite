import { connectOpenedAutomator, resolveProjectAutomatorPort } from 'weapp-ide-cli'

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
  timeoutMs?: number
}

const DEFAULT_APP_READY_TIMEOUT = 15_000

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
      try {
        await waitForOpenedMiniProgramReady(miniProgram, appReadyTimeoutMs, readyRoute)
      }
      catch (error) {
        lastError = error
        await closeStaleMiniProgram(miniProgram)
        await delay(intervalMs)
        continue
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
