import type { AnalyzeSubpackagesResult, PackageType } from './types'
import { isRuntimeCategory } from './artifacts/owner'

export interface AnalyzeBudgetCheckItem {
  id: string
  label: string
  scope: 'total' | 'runtime' | PackageType
  currentBytes: number
  limitBytes: number
  ratio: number
  status: 'ok' | 'warning' | 'exceeded' | 'unknown'
  measurement: 'file-bytes' | 'upper-bound' | 'unavailable'
  files: string[]
}

export function createAnalyzeBudgetCheck(result: Pick<AnalyzeSubpackagesResult, 'packages' | 'metadata' | 'artifacts'>): AnalyzeBudgetCheckItem[] {
  const budgets = result.metadata?.budgets
  if (!budgets) {
    return []
  }
  const createItem = (options: Omit<AnalyzeBudgetCheckItem, 'ratio' | 'status'>, unknown = false): AnalyzeBudgetCheckItem => {
    const ratio = options.limitBytes > 0 ? options.currentBytes / options.limitBytes : options.currentBytes > 0 ? 1 : 0
    return {
      ...options,
      ratio,
      status: unknown ? 'unknown' : ratio >= 1 ? 'exceeded' : ratio >= budgets.warningRatio ? 'warning' : 'ok',
    }
  }
  const files = result.packages.flatMap(pkg => pkg.files)
  const unique = new Map(files.map(file => [file.file, file]))
  const sizeUnknown = (items: typeof files) => items.some(file => typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size < 0)
  const items: AnalyzeBudgetCheckItem[] = [createItem({
    id: '__total__',
    label: '总包',
    scope: 'total',
    currentBytes: [...unique.values()].reduce((sum, file) => sum + (file.size ?? 0), 0),
    limitBytes: budgets.totalBytes,
    measurement: 'file-bytes',
    files: [...unique.keys()].sort(),
  }, sizeUnknown(files))]
  for (const pkg of result.packages) {
    const limitBytes = budgets.packageBytes?.[pkg.id] ?? (pkg.type === 'main' ? budgets.mainBytes : pkg.type === 'subPackage' ? budgets.subPackageBytes : pkg.type === 'independent' ? budgets.independentBytes : undefined)
    if (limitBytes === undefined) {
      continue
    }
    items.push(createItem({
      id: pkg.id,
      label: pkg.label,
      scope: pkg.type,
      currentBytes: pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
      limitBytes,
      measurement: 'file-bytes',
      files: pkg.files.map(file => file.file).sort(),
    }, sizeUnknown(pkg.files)))
  }
  if (budgets.runtimeBytes !== undefined) {
    const artifacts = result.artifacts
    items.push(createItem({
      id: '__runtime__',
      label: 'Runtime（含混合 chunk 的文件上界）',
      scope: 'runtime',
      currentBytes: artifacts?.runtime.upperBoundBytes ?? 0,
      limitBytes: budgets.runtimeBytes,
      measurement: artifacts ? 'upper-bound' : 'unavailable',
      files: artifacts?.files.filter(file => artifacts.runtime.unknownFiles.includes(file.file) || file.modules.some(module => isRuntimeCategory(module.category))).map(file => file.file)
        ?? files.filter(file => file.type === 'chunk' || /\.[cm]?js$/i.test(file.file)).map(file => file.file),
    }, !artifacts || artifacts.runtime.unknownFiles.length > 0))
  }
  return items.sort((a, b) => b.ratio - a.ratio || a.label.localeCompare(b.label))
}
