import type { AnalyzeBudgetConfig, PackageBudgetWarning, PackageType } from '../types'

export const defaultAnalyzeBudgetConfig: AnalyzeBudgetConfig = {
  totalBytes: 20 * 1024 * 1024,
  mainBytes: 2 * 1024 * 1024,
  subPackageBytes: 2 * 1024 * 1024,
  independentBytes: 2 * 1024 * 1024,
  warningRatio: 0.85,
  source: 'default',
}

export interface BudgetSandboxPackage {
  id: string
  label: string
  type: PackageType
  totalBytes: number
}

export interface BudgetSandboxConfig {
  totalBytes: number
  mainBytes: number
  subPackageBytes: number
  independentBytes: number
  warningRatio: number
}

export interface BudgetSandboxPreset {
  id: string
  label: string
  detail: string
  config: BudgetSandboxConfig
}

const mib = 1024 * 1024

export const budgetSandboxPresets: BudgetSandboxPreset[] = [
  {
    id: 'wechat-default',
    label: '平台上限',
    detail: '按小程序常见包体限制和 85% 预警线评估。',
    config: {
      totalBytes: 20 * mib,
      mainBytes: 2 * mib,
      subPackageBytes: 2 * mib,
      independentBytes: 2 * mib,
      warningRatio: 0.85,
    },
  },
  {
    id: 'release-buffer',
    label: '发布缓冲',
    detail: '保留更早预警空间，适合发版前巡检。',
    config: {
      totalBytes: 20 * mib,
      mainBytes: 2 * mib,
      subPackageBytes: 2 * mib,
      independentBytes: 2 * mib,
      warningRatio: 0.75,
    },
  },
  {
    id: 'near-limit',
    label: '临界排查',
    detail: '只标记接近上限的包，适合聚焦最紧急项。',
    config: {
      totalBytes: 20 * mib,
      mainBytes: 2 * mib,
      subPackageBytes: 2 * mib,
      independentBytes: 2 * mib,
      warningRatio: 0.95,
    },
  },
]

function normalizeLimit(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback
}

function normalizeWarningRatio(value: number) {
  if (!Number.isFinite(value)) {
    return defaultAnalyzeBudgetConfig.warningRatio
  }
  return Math.min(0.99, Math.max(0.01, value))
}

function getPackageBudgetLimit(type: PackageType, config: BudgetSandboxConfig) {
  if (type === 'main') {
    return config.mainBytes
  }
  if (type === 'subPackage') {
    return config.subPackageBytes
  }
  if (type === 'independent') {
    return config.independentBytes
  }
  return 0
}

function createBudgetWarning(options: {
  id: string
  label: string
  scope: PackageBudgetWarning['scope']
  currentBytes: number
  limitBytes: number
  warningRatio: number
}): PackageBudgetWarning | undefined {
  const ratio = options.limitBytes > 0 ? options.currentBytes / options.limitBytes : 0
  if (ratio < options.warningRatio) {
    return undefined
  }
  return {
    id: options.id,
    label: options.label,
    scope: options.scope,
    currentBytes: options.currentBytes,
    limitBytes: options.limitBytes,
    ratio,
    status: ratio >= 1 ? 'critical' : 'warning',
  }
}

export function normalizeBudgetSandboxConfig(config: Partial<BudgetSandboxConfig> | undefined): BudgetSandboxConfig {
  return {
    totalBytes: normalizeLimit(config?.totalBytes ?? defaultAnalyzeBudgetConfig.totalBytes, defaultAnalyzeBudgetConfig.totalBytes),
    mainBytes: normalizeLimit(config?.mainBytes ?? defaultAnalyzeBudgetConfig.mainBytes, defaultAnalyzeBudgetConfig.mainBytes),
    subPackageBytes: normalizeLimit(config?.subPackageBytes ?? defaultAnalyzeBudgetConfig.subPackageBytes, defaultAnalyzeBudgetConfig.subPackageBytes),
    independentBytes: normalizeLimit(config?.independentBytes ?? defaultAnalyzeBudgetConfig.independentBytes, defaultAnalyzeBudgetConfig.independentBytes),
    warningRatio: normalizeWarningRatio(config?.warningRatio ?? defaultAnalyzeBudgetConfig.warningRatio),
  }
}

function isSameBudgetConfig(left: BudgetSandboxConfig, right: BudgetSandboxConfig) {
  return left.totalBytes === right.totalBytes
    && left.mainBytes === right.mainBytes
    && left.subPackageBytes === right.subPackageBytes
    && left.independentBytes === right.independentBytes
    && left.warningRatio === right.warningRatio
}

export function findMatchingBudgetPreset(config: BudgetSandboxConfig): BudgetSandboxPreset | undefined {
  const normalizedConfig = normalizeBudgetSandboxConfig(config)
  return budgetSandboxPresets.find(preset => isSameBudgetConfig(normalizeBudgetSandboxConfig(preset.config), normalizedConfig))
}

export function createBudgetSandboxWarnings(options: {
  totalBytes: number
  packages: BudgetSandboxPackage[]
  config: BudgetSandboxConfig
}): PackageBudgetWarning[] {
  const config = normalizeBudgetSandboxConfig(options.config)
  const warnings: PackageBudgetWarning[] = []
  const totalWarning = createBudgetWarning({
    id: '__total__',
    label: '总包',
    scope: 'total',
    currentBytes: options.totalBytes,
    limitBytes: config.totalBytes,
    warningRatio: config.warningRatio,
  })
  if (totalWarning) {
    warnings.push(totalWarning)
  }

  for (const pkg of options.packages) {
    const limitBytes = getPackageBudgetLimit(pkg.type, config)
    if (!limitBytes) {
      continue
    }
    const warning = createBudgetWarning({
      id: pkg.id,
      label: pkg.label,
      scope: pkg.type,
      currentBytes: pkg.totalBytes,
      limitBytes,
      warningRatio: config.warningRatio,
    })
    if (warning) {
      warnings.push(warning)
    }
  }

  return warnings.sort((a, b) => b.ratio - a.ratio || a.label.localeCompare(b.label))
}

export function createBudgetConfigSnippet(config: BudgetSandboxConfig) {
  const normalizedConfig = normalizeBudgetSandboxConfig(config)
  return [
    'analyze: {',
    '  budgets: {',
    `    totalBytes: ${normalizedConfig.totalBytes},`,
    `    mainBytes: ${normalizedConfig.mainBytes},`,
    `    subPackageBytes: ${normalizedConfig.subPackageBytes},`,
    `    independentBytes: ${normalizedConfig.independentBytes},`,
    `    warningRatio: ${normalizedConfig.warningRatio},`,
    '  },',
    '},',
  ].join('\n')
}
