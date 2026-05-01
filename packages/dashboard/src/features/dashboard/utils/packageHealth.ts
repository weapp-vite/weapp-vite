import type { DashboardMetricItem, PackageBudgetWarning, PackageInsight } from '../types'
import { formatBytes } from './format'

export type PackageHealthStatus = 'good' | 'watch' | 'risk'

export interface PackageHealthItem {
  id: string
  label: string
  score: number
  status: PackageHealthStatus
  statusLabel: string
  detail: string
  primaryRisk: string
  metrics: DashboardMetricItem[]
}

export interface PackageHealthSummary {
  averageScore: number
  riskCount: number
  watchCount: number
  healthiestPackage?: PackageHealthItem
  weakestPackage?: PackageHealthItem
  items: PackageHealthItem[]
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function createDeltaPenalty(pkg: PackageInsight) {
  if (typeof pkg.sizeDeltaBytes !== 'number' || pkg.sizeDeltaBytes <= 0 || pkg.totalBytes <= 0) {
    return 0
  }
  const deltaRatio = pkg.sizeDeltaBytes / pkg.totalBytes
  return Math.min(18, deltaRatio * 80)
}

function createBudgetPenalty(warning?: PackageBudgetWarning) {
  if (!warning) {
    return 0
  }
  return warning.status === 'critical' ? 32 : 18
}

function createDuplicatePenalty(pkg: PackageInsight) {
  if (pkg.moduleCount <= 0 || pkg.duplicateModuleCount <= 0) {
    return 0
  }
  return Math.min(18, pkg.duplicateModuleCount / pkg.moduleCount * 60)
}

function createEntryPenalty(pkg: PackageInsight) {
  return Math.min(10, Math.max(0, pkg.entryFileCount - 1) * 3)
}

function getStatus(score: number): PackageHealthStatus {
  if (score < 70) {
    return 'risk'
  }
  if (score < 86) {
    return 'watch'
  }
  return 'good'
}

function getStatusLabel(status: PackageHealthStatus) {
  if (status === 'risk') {
    return '高风险'
  }
  if (status === 'watch') {
    return '需关注'
  }
  return '健康'
}

function createPrimaryRisk(pkg: PackageInsight, warning?: PackageBudgetWarning) {
  if (warning?.status === 'critical') {
    return `预算超限 ${(warning.ratio * 100).toFixed(1)}%`
  }
  if (warning?.status === 'warning') {
    return `接近预算 ${(warning.ratio * 100).toFixed(1)}%`
  }
  if (typeof pkg.sizeDeltaBytes === 'number' && pkg.sizeDeltaBytes > 0) {
    return `较上次增长 ${formatBytes(pkg.sizeDeltaBytes)}`
  }
  if (pkg.duplicateModuleCount > 0) {
    return `${pkg.duplicateModuleCount} 个重复模块`
  }
  return '未发现主要风险'
}

function createPackageHealthItem(pkg: PackageInsight, warning?: PackageBudgetWarning): PackageHealthItem {
  const score = clampScore(
    100
    - createBudgetPenalty(warning)
    - createDeltaPenalty(pkg)
    - createDuplicatePenalty(pkg)
    - createEntryPenalty(pkg),
  )
  const status = getStatus(score)
  return {
    id: pkg.id,
    label: pkg.label,
    score,
    status,
    statusLabel: getStatusLabel(status),
    detail: `${pkg.fileCount} 个产物 · ${pkg.moduleCount} 个模块 · ${formatBytes(pkg.totalBytes)}`,
    primaryRisk: createPrimaryRisk(pkg, warning),
    metrics: [
      { label: '体积', value: formatBytes(pkg.totalBytes) },
      { label: '重复模块', value: pkg.duplicateModuleCount },
      { label: 'Entry', value: pkg.entryFileCount },
      { label: '较上次', value: typeof pkg.sizeDeltaBytes === 'number' ? `${pkg.sizeDeltaBytes >= 0 ? '+' : '-'}${formatBytes(Math.abs(pkg.sizeDeltaBytes))}` : '—' },
    ],
  }
}

export function createPackageHealthSummary(options: {
  packageInsights: PackageInsight[]
  budgetWarnings: PackageBudgetWarning[]
}): PackageHealthSummary {
  const budgetWarningMap = new Map(options.budgetWarnings.map(item => [item.id, item]))
  const items = options.packageInsights
    .map(pkg => createPackageHealthItem(pkg, budgetWarningMap.get(pkg.id)))
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
  const totalScore = items.reduce((sum, item) => sum + item.score, 0)

  return {
    averageScore: items.length > 0 ? clampScore(totalScore / items.length) : 100,
    riskCount: items.filter(item => item.status === 'risk').length,
    watchCount: items.filter(item => item.status === 'watch').length,
    healthiestPackage: [...items].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))[0],
    weakestPackage: items[0],
    items,
  }
}
