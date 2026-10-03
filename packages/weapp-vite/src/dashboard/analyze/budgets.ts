import type { AnalyzeSubpackagesResult, PackageType } from '../../analyze/subpackages/types'
import type { AnalyzeBudgetCheckItem } from './types'

const defaultBudgets = {
  totalBytes: 20 * 1024 * 1024,
  mainBytes: 2 * 1024 * 1024,
  subPackageBytes: 2 * 1024 * 1024,
  independentBytes: 2 * 1024 * 1024,
  warningRatio: 0.85,
}

function getBudgetLimit(type: PackageType, budgets: typeof defaultBudgets) {
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

/** 统一计算包体预算；旧报告没有元数据时沿用 Dashboard 默认预算。 */
export function createAnalyzeBudgetCheck(result: Pick<AnalyzeSubpackagesResult, 'packages' | 'metadata'>): AnalyzeBudgetCheckItem[] {
  const budgets = result.metadata?.budgets ?? defaultBudgets
  const items: AnalyzeBudgetCheckItem[] = []
  let totalBytes = 0

  const createItem = (options: Omit<AnalyzeBudgetCheckItem, 'ratio' | 'status'>): AnalyzeBudgetCheckItem => {
    const ratio = options.limitBytes > 0 ? options.currentBytes / options.limitBytes : 0
    return {
      ...options,
      ratio,
      status: ratio >= 1 ? 'exceeded' : ratio >= budgets.warningRatio ? 'warning' : 'ok',
    }
  }

  for (const pkg of result.packages) {
    const currentBytes = pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
    totalBytes += currentBytes
    const limitBytes = getBudgetLimit(pkg.type, budgets)
    if (limitBytes) {
      items.push(createItem({
        id: pkg.id,
        label: pkg.label,
        scope: pkg.type,
        currentBytes,
        limitBytes,
      }))
    }
  }
  items.push(createItem({
    id: '__total__',
    label: '总包',
    scope: 'total',
    currentBytes: totalBytes,
    limitBytes: budgets.totalBytes,
  }))
  return items.sort((a, b) => b.ratio - a.ratio || a.label.localeCompare(b.label))
}
