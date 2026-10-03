import type { AnalyzeSubpackagesResult, PackageBudgetLimitItem, PackageBudgetWarning } from '../types'
import { createAnalyzeBudgetCheck } from 'weapp-vite/dashboard/analyze'
import { singlePackageBudgetBytes, totalPackageBudgetBytes } from './analyzeDataShared'

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

  return createAnalyzeBudgetCheck(result)
    .filter(item => item.status !== 'ok')
    .map((item): PackageBudgetWarning => ({
      ...item,
      status: item.status === 'exceeded' ? 'critical' : 'warning',
    }))
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
