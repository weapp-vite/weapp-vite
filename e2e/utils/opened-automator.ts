import { connectOpenedAutomator, resolveProjectAutomatorPort } from 'weapp-ide-cli'

interface OpenedAutomatorSessionMetadata {
  projectPath: string
  updatedAt: string
  wsEndpoint: string
}

interface WaitForOpenedAutomatorOptions {
  connectTimeoutMs?: number
  intervalMs?: number
  timeoutMs?: number
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitForOpenedAutomator(
  projectPath: string,
  options: WaitForOpenedAutomatorOptions = {},
) {
  const {
    connectTimeoutMs = 5_000,
    intervalMs = 500,
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

  const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown')
  throw new Error(`Timed out waiting for opened automator ${wsEndpoint} after ${timeoutMs}ms: ${reason}`)
}
