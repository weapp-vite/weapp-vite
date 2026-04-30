import type { ConfigService } from '../../runtime/config/types'
import type { AnalyzeBudgetConfig, AnalyzeHistoryMetadata, AnalyzeSubpackagesMetadata } from './types'
import path from 'pathe'

const defaultTotalBudgetBytes = 20 * 1024 * 1024
const defaultPackageBudgetBytes = 2 * 1024 * 1024
const defaultWarningRatio = 0.85
const defaultHistoryDir = '.weapp-vite/analyze-history'
const defaultHistoryLimit = 20

function resolveBudgetValue(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function resolveHistoryLimit(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : defaultHistoryLimit
}

export function resolveAnalyzeBudgets(configService: ConfigService): AnalyzeBudgetConfig {
  const budgets = configService.weappViteConfig.analyze?.budgets
  const legacyPackageBudget = configService.weappViteConfig.packageSizeWarningBytes
  const packageFallback = resolveBudgetValue(legacyPackageBudget, defaultPackageBudgetBytes)

  return {
    totalBytes: resolveBudgetValue(budgets?.totalBytes, defaultTotalBudgetBytes),
    mainBytes: resolveBudgetValue(budgets?.mainBytes, packageFallback),
    subPackageBytes: resolveBudgetValue(budgets?.subPackageBytes, packageFallback),
    independentBytes: resolveBudgetValue(budgets?.independentBytes, packageFallback),
    warningRatio: resolveBudgetValue(budgets?.warningRatio, defaultWarningRatio),
    source: budgets ? 'config' : 'default',
  }
}

export function resolveAnalyzeHistoryMetadata(configService: ConfigService): AnalyzeHistoryMetadata {
  const history = configService.weappViteConfig.analyze?.history
  if (history === false) {
    return {
      enabled: false,
      dir: path.resolve(configService.cwd, defaultHistoryDir),
      limit: defaultHistoryLimit,
    }
  }

  const historyConfig = typeof history === 'object' && history
    ? history
    : {}
  const rawDir = typeof historyConfig.dir === 'string' && historyConfig.dir.trim()
    ? historyConfig.dir.trim()
    : defaultHistoryDir

  return {
    enabled: historyConfig.enabled !== false,
    dir: path.isAbsolute(rawDir) ? rawDir : path.resolve(configService.cwd, rawDir),
    limit: resolveHistoryLimit(historyConfig.limit),
  }
}

export function createAnalyzeMetadata(configService: ConfigService, now = new Date()): AnalyzeSubpackagesMetadata {
  const history = resolveAnalyzeHistoryMetadata(configService)
  return {
    generatedAt: now.toISOString(),
    budgets: resolveAnalyzeBudgets(configService),
    history: {
      ...history,
      dir: configService.relativeCwd(history.dir),
    },
  }
}

export {
  defaultHistoryDir,
}
