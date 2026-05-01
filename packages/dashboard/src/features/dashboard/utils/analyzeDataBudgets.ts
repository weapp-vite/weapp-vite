import type { AnalyzeSubpackagesResult, PackageBudgetLimitItem, PackageBudgetWarning, PackageType } from '../types'
import { budgetWarningRatio, getFileSize, singlePackageBudgetBytes, totalPackageBudgetBytes } from './analyzeDataShared'

function getPackageBudgetLimit(type: PackageType) {
  if (type === 'virtual') {
    return undefined
  }
  return singlePackageBudgetBytes
}

function resolvePackageBudgetLimit(type: PackageType, result: AnalyzeSubpackagesResult) {
  const budgets = result.metadata?.budgets
  if (!budgets) {
    return getPackageBudgetLimit(type)
  }
  if (type === 'main') {
    return budgets.mainBytes
  }
  if (type === 'subPackage') {
    return budgets.subPackageBytes
  }
  if (type === 'independent') {
    return budgets.independentBytes
  }
}

function createBudgetWarning(options: {
  id: string
  label: string
  scope: PackageBudgetWarning['scope']
  currentBytes: number
  limitBytes: number
  warningRatio?: number
}): PackageBudgetWarning | undefined {
  const ratio = options.limitBytes > 0 ? options.currentBytes / options.limitBytes : 0
  const warningRatio = options.warningRatio ?? budgetWarningRatio
  if (ratio < warningRatio) {
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

function getFileBudgetLabel(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 2)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(bytes % 1024 === 0 ? 0 : 2)} KB`
  }
  return `${bytes} B`
}

export function createBudgetWarnings(result: AnalyzeSubpackagesResult | null): PackageBudgetWarning[] {
  if (!result) {
    return []
  }

  const warnings: PackageBudgetWarning[] = []
  const totalBytes = result.packages.flatMap(pkg => pkg.files).reduce((sum, file) => sum + getFileSize(file), 0)
  const budgets = result.metadata?.budgets
  const totalWarning = createBudgetWarning({
    id: '__total__',
    label: '总包',
    scope: 'total',
    currentBytes: totalBytes,
    limitBytes: budgets?.totalBytes ?? totalPackageBudgetBytes,
    warningRatio: budgets?.warningRatio,
  })
  if (totalWarning) {
    warnings.push(totalWarning)
  }

  for (const pkg of result.packages) {
    const limit = resolvePackageBudgetLimit(pkg.type, result)
    if (!limit) {
      continue
    }
    const warning = createBudgetWarning({
      id: pkg.id,
      label: pkg.label,
      scope: pkg.type,
      currentBytes: pkg.files.reduce((sum, file) => sum + getFileSize(file), 0),
      limitBytes: limit,
      warningRatio: budgets?.warningRatio,
    })
    if (warning) {
      warnings.push(warning)
    }
  }

  return warnings.sort((a, b) => b.ratio - a.ratio || a.label.localeCompare(b.label))
}

export function createBudgetLimitItems(result: AnalyzeSubpackagesResult | null): PackageBudgetLimitItem[] {
  const budgets = result?.metadata?.budgets
  const source = budgets?.source ?? 'default'
  return [
    {
      key: 'total',
      label: '总包预算',
      value: `${getFileBudgetLabel(budgets?.totalBytes ?? totalPackageBudgetBytes)}`,
      source,
    },
    {
      key: 'main',
      label: '主包预算',
      value: `${getFileBudgetLabel(budgets?.mainBytes ?? singlePackageBudgetBytes)}`,
      source,
    },
    {
      key: 'subPackage',
      label: '分包预算',
      value: `${getFileBudgetLabel(budgets?.subPackageBytes ?? singlePackageBudgetBytes)}`,
      source,
    },
    {
      key: 'independent',
      label: '独立分包预算',
      value: `${getFileBudgetLabel(budgets?.independentBytes ?? singlePackageBudgetBytes)}`,
      source,
    },
  ]
}
