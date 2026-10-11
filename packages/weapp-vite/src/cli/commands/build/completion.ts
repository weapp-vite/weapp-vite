import type { AnalyzeDashboardHandle } from '../../analyze/dashboard'
import type { GlobalCLIOptions } from '../../types'
import process from 'node:process'

export function shouldScheduleCompletedProductionBuildExit(options: GlobalCLIOptions, analyzeHandle: AnalyzeDashboardHandle | undefined) {
  return process.env.VITEST !== 'true'
    && process.env.NODE_ENV !== 'test'
    && process.env.WEAPP_VITE_DISABLE_COMPLETED_BUILD_EXIT !== '1'
    && options.watch !== true
    && options.open !== true
    && analyzeHandle === undefined
}

export function scheduleCompletedProductionBuildExit(options: GlobalCLIOptions, analyzeHandle: AnalyzeDashboardHandle | undefined) {
  if (!shouldScheduleCompletedProductionBuildExit(options, analyzeHandle)) {
    return
  }

  const timer = setTimeout(() => {
    if (process.exitCode === undefined || process.exitCode === 0) {
      process.exit(0)
    }
  }, 0)
  timer.unref?.()
}
