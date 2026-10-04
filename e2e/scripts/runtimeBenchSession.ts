import type { RecoverableSession } from './runtimeBench'
import type { BenchSessionResource } from './runtimeBench/resources'
import { isLikelyRelaunchRetryableError, launchAutomator } from '../utils/automator'
import { resolveWechatCliPath } from '../utils/devtoolsCli'
import { cleanupResidualDevtoolsProcesses } from '../utils/ide-devtools-cleanup'
import { createRecoverableSession } from './runtimeBench'
import { createBenchResourceRegistry } from './runtimeBench/resources'

function compactError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim().slice(0, 240)
}

export async function createRuntimeBenchSession(options: {
  log: (message: string) => void
  projectRoot: string
  runtimeProvider: ReturnType<typeof import('../utils/runtimeProvider').resolveRuntimeProviderName>
  onCleanupError?: (error: unknown) => Promise<void>
  onRetry?: (context: { attempt: number, error: unknown, label: string }) => Promise<void>
  onResource?: (resource: BenchSessionResource) => Promise<void>
}): Promise<RecoverableSession<any>> {
  const cliPath = resolveWechatCliPath()
  const resources = options.runtimeProvider === 'devtools'
    ? createBenchResourceRegistry({ cliPath, onResource: options.onResource })
    : undefined
  const close = async (miniProgram?: { close?: () => Promise<void>, disconnect?: () => void | Promise<void>, flushConsole?: () => Promise<void> }) => {
    const errors: unknown[] = []
    if (resources) {
      try {
        await miniProgram?.flushConsole?.()
      }
      catch (error) {
        errors.push(error)
      }
      try {
        await miniProgram?.disconnect?.()
      }
      catch (error) {
        errors.push(error)
      }
    }
    else {
      try {
        await miniProgram?.close?.()
      }
      catch (error) {
        errors.push(error)
      }
    }
    try {
      await resources?.closeAll()
    }
    catch (error) {
      errors.push(error)
    }
    if (errors.length) {
      const error = errors.length === 1 ? errors[0] : new AggregateError(errors, 'Benchmark session and owned project cleanup failed')
      await options.onCleanupError?.(error)
      throw error
    }
  }
  const launch = async () => {
    let miniProgram: any
    try {
      miniProgram = await launchAutomator({
        projectPath: options.projectRoot,
        runtimeProvider: options.runtimeProvider,
        trustProject: true,
        ...(resources
          ? {
              cliPath,
              launchMode: 'bridge',
              bridgeProjectMode: 'snapshot',
              onOwnedSnapshot: resources.ownProject,
              onSessionMetadata: resources.attachMetadata,
            } as const
          : {}),
      })
      if (resources) {
        await resources.attachMetadata(Reflect.get(miniProgram, '__WEAPP_VITE_SESSION_METADATA'))
      }
      return miniProgram
    }
    catch (error) {
      try {
        await close(miniProgram)
      }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Benchmark launch and resource cleanup failed')
      }
      throw error
    }
  }

  return await createRecoverableSession({
    launch,
    safeClose: close,
    isRetryable: isLikelyRelaunchRetryableError,
    onRetry: async ({ attempt, error, label }) => {
      await options.onRetry?.({ attempt, error, label })
      options.log(`session retry sample=${label} attempt=${attempt}/2 reason=${compactError(error)}`)
      if (options.runtimeProvider === 'devtools') {
        await cleanupResidualDevtoolsProcesses()
      }
    },
  })
}
