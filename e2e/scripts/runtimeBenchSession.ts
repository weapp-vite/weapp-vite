import type { RecoverableSession } from './runtimeBench'
import { isLikelyRelaunchRetryableError, launchAutomator } from '../utils/automator'
import { cleanupResidualDevtoolsProcesses } from '../utils/ide-devtools-cleanup'
import { createRecoverableSession } from './runtimeBench'

function compactError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim().slice(0, 240)
}

export async function createRuntimeBenchSession(options: {
  log: (message: string) => void
  projectRoot: string
  runtimeProvider: ReturnType<typeof import('../utils/runtimeProvider').resolveRuntimeProviderName>
}): Promise<RecoverableSession<any>> {
  const launch = () => launchAutomator({
    projectPath: options.projectRoot,
    runtimeProvider: options.runtimeProvider,
    trustProject: true,
  })

  return await createRecoverableSession({
    launch,
    safeClose: async (miniProgram) => {
      await miniProgram?.close?.().catch(() => {})
    },
    isRetryable: isLikelyRelaunchRetryableError,
    onRetry: async ({ attempt, error, label }) => {
      options.log(`session retry sample=${label} attempt=${attempt}/2 reason=${compactError(error)}`)
      if (options.runtimeProvider === 'devtools') {
        await cleanupResidualDevtoolsProcesses()
      }
    },
  })
}
