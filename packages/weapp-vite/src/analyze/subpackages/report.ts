import type { AnalyzeBudgetConfig, AnalyzeSubpackagesResult, ModuleSourceType, PackageType } from './types'

export interface AnalyzeBudgetCheckItem {
  id: string
  label: string
  scope: 'total' | PackageType
  currentBytes: number
  limitBytes: number
  ratio: number
  status: 'ok' | 'warning' | 'exceeded'
}

export interface DuplicateModuleInsight {
  id: string
  source: string
  sourceType: ModuleSourceType
  packageCount: number
  bytes: number
  estimatedSavingBytes: number
  packages: string[]
  advice: string
}

export function formatAnalyzeBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

function formatDelta(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes === 0) {
    return '无变化'
  }
  return `${bytes > 0 ? '+' : '-'}${formatAnalyzeBytes(Math.abs(bytes))}`
}

function getFileSize(file: AnalyzeSubpackagesResult['packages'][number]['files'][number]) {
  return file.size ?? 0
}

function getCompressedSize(file: AnalyzeSubpackagesResult['packages'][number]['files'][number]) {
  return file.brotliSize ?? file.gzipSize ?? 0
}

function getBudgetLimit(type: PackageType, budgets: AnalyzeBudgetConfig | undefined) {
  if (!budgets) {
    return undefined
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

function createPackageSizeMap(result: AnalyzeSubpackagesResult | null | undefined) {
  return new Map((result?.packages ?? []).map((pkg) => {
    const totalBytes = pkg.files.reduce((sum, file) => sum + getFileSize(file), 0)
    return [pkg.id, totalBytes]
  }))
}

function createPackageTypeMap(result: AnalyzeSubpackagesResult) {
  return new Map(result.packages.map(pkg => [pkg.id, pkg.type]))
}

function createModuleByteMap(result: AnalyzeSubpackagesResult) {
  const map = new Map<string, number>()
  for (const pkg of result.packages) {
    for (const file of pkg.files) {
      for (const mod of file.modules ?? []) {
        const bytes = mod.bytes ?? mod.originalBytes ?? 0
        map.set(mod.id, Math.max(map.get(mod.id) ?? 0, bytes))
      }
    }
  }
  return map
}

function createDuplicateAdvice(
  sourceType: ModuleSourceType,
  packageIds: string[],
  packageTypeMap: Map<string, PackageType>,
  estimatedSavingBytes: number,
) {
  const hasIndependentPackage = packageIds.some(packageId => packageTypeMap.get(packageId) === 'independent')
  if (hasIndependentPackage) {
    return estimatedSavingBytes > 0
      ? '含独立分包，先确认隔离要求，再评估是否抽公共入口。'
      : '含独立分包，重复可能来自隔离边界。'
  }
  if (sourceType === 'node_modules') {
    return '依赖被多个包带入，检查引用边界或考虑主包公共入口。'
  }
  if (sourceType === 'src' || sourceType === 'workspace') {
    return '共享源码跨包重复，优先抽公共模块或调整分包归属。'
  }
  if (sourceType === 'plugin') {
    return '插件生成内容跨包重复，检查插件产物输出策略。'
  }
  return '检查该模块是否需要在多个包内重复存在。'
}

function formatBudgetStatus(item: AnalyzeBudgetCheckItem) {
  if (item.status === 'ok') {
    return '正常'
  }
  return `${item.status === 'exceeded' ? '超预算' : '接近预算'} ${(item.ratio * 100).toFixed(1)}%`
}

function createActionItems(options: {
  budgetItems: AnalyzeBudgetCheckItem[]
  duplicateInsights: DuplicateModuleInsight[]
}) {
  const actions: string[] = []
  const exceededItems = options.budgetItems.filter(item => item.status === 'exceeded')
  const warningItems = options.budgetItems.filter(item => item.status === 'warning')
  const topDuplicate = options.duplicateInsights.find(item => item.estimatedSavingBytes > 0)

  if (exceededItems.length > 0) {
    actions.push(`处理 ${exceededItems[0]!.label} 预算超限：当前 ${formatAnalyzeBytes(exceededItems[0]!.currentBytes)}，限制 ${formatAnalyzeBytes(exceededItems[0]!.limitBytes)}。`)
  }
  else if (warningItems.length > 0) {
    actions.push(`关注 ${warningItems[0]!.label} 预算接近阈值：当前 ${(warningItems[0]!.ratio * 100).toFixed(1)}%。`)
  }
  if (topDuplicate) {
    actions.push(`优先处理重复模块 ${topDuplicate.source}，估算可节省 ${formatAnalyzeBytes(topDuplicate.estimatedSavingBytes)}。`)
  }
  if (actions.length === 0) {
    actions.push('当前没有预算超限或高收益重复模块，保持观察即可。')
  }
  return actions
}

export function createAnalyzeBudgetCheck(result: AnalyzeSubpackagesResult): AnalyzeBudgetCheckItem[] {
  const budgets = result.metadata?.budgets
  if (!budgets) {
    return []
  }

  const items: AnalyzeBudgetCheckItem[] = []
  const totalBytes = result.packages.flatMap(pkg => pkg.files).reduce((sum, file) => sum + getFileSize(file), 0)
  const warningRatio = budgets.warningRatio

  const createItem = (options: Omit<AnalyzeBudgetCheckItem, 'ratio' | 'status'>) => {
    const ratio = options.limitBytes > 0 ? options.currentBytes / options.limitBytes : 0
    const status: AnalyzeBudgetCheckItem['status'] = ratio >= 1
      ? 'exceeded'
      : ratio >= warningRatio
        ? 'warning'
        : 'ok'
    return {
      ...options,
      ratio,
      status,
    }
  }

  items.push(createItem({
    id: '__total__',
    label: '总包',
    scope: 'total',
    currentBytes: totalBytes,
    limitBytes: budgets.totalBytes,
  }))

  for (const pkg of result.packages) {
    const limitBytes = getBudgetLimit(pkg.type, budgets)
    if (!limitBytes) {
      continue
    }
    items.push(createItem({
      id: pkg.id,
      label: pkg.label,
      scope: pkg.type,
      currentBytes: pkg.files.reduce((sum, file) => sum + getFileSize(file), 0),
      limitBytes,
    }))
  }

  return items.sort((a, b) => b.ratio - a.ratio || a.label.localeCompare(b.label))
}

export function createDuplicateModuleInsights(result: AnalyzeSubpackagesResult): DuplicateModuleInsight[] {
  const moduleByteMap = createModuleByteMap(result)
  const packageTypeMap = createPackageTypeMap(result)

  return result.modules
    .filter(module => module.packages.length > 1)
    .map((module) => {
      const bytes = moduleByteMap.get(module.id) ?? 0
      const packageIds = module.packages.map(pkg => pkg.packageId)
      const estimatedSavingBytes = bytes * Math.max(module.packages.length - 1, 0)
      return {
        id: module.id,
        source: module.source,
        sourceType: module.sourceType,
        packageCount: module.packages.length,
        bytes,
        estimatedSavingBytes,
        packages: packageIds,
        advice: createDuplicateAdvice(module.sourceType, packageIds, packageTypeMap, estimatedSavingBytes),
      }
    })
    .sort((a, b) =>
      b.estimatedSavingBytes - a.estimatedSavingBytes
      || b.packageCount - a.packageCount
      || a.source.localeCompare(b.source),
    )
}

export function createAnalyzeMarkdownReport(
  result: AnalyzeSubpackagesResult,
  previousResult?: AnalyzeSubpackagesResult | null,
) {
  const files = result.packages.flatMap(pkg => pkg.files.map(file => ({ pkg, file })))
  const totalBytes = files.reduce((sum, item) => sum + getFileSize(item.file), 0)
  const compressedBytes = files.reduce((sum, item) => sum + getCompressedSize(item.file), 0)
  const duplicateInsights = createDuplicateModuleInsights(result)
  const budgetItems = createAnalyzeBudgetCheck(result)
  const previousTotalBytes = previousResult?.packages.flatMap(pkg => pkg.files).reduce((sum, file) => sum + getFileSize(file), 0)
  const previousPackageSizes = createPackageSizeMap(previousResult)
  const budgets = result.metadata?.budgets
  const budgetIssues = budgetItems.filter(item => item.status !== 'ok')
  const actionItems = createActionItems({ budgetItems, duplicateInsights })

  const packageRows = result.packages
    .map((pkg) => {
      const size = pkg.files.reduce((sum, file) => sum + getFileSize(file), 0)
      const compressed = pkg.files.reduce((sum, file) => sum + getCompressedSize(file), 0)
      const previousSize = previousPackageSizes.get(pkg.id)
      const budgetStatus = budgetItems.find(item => item.id === pkg.id)
      return `| ${pkg.label} | ${pkg.type} | ${formatAnalyzeBytes(size)} | ${formatAnalyzeBytes(compressed)} | ${formatDelta(typeof previousSize === 'number' ? size - previousSize : undefined)} | ${budgetStatus ? formatBudgetStatus(budgetStatus) : '正常'} |`
    })
    .join('\n')

  const topFileRows = files
    .sort((a, b) => getFileSize(b.file) - getFileSize(a.file) || a.file.file.localeCompare(b.file.file))
    .slice(0, 10)
    .map(item => `| ${item.file.file} | ${item.pkg.label} | ${item.file.type} | ${formatAnalyzeBytes(getFileSize(item.file))} | ${formatAnalyzeBytes(getCompressedSize(item.file))} |`)
    .join('\n')

  const duplicateRows = duplicateInsights
    .slice(0, 10)
    .map(module => `| ${module.source} | ${module.sourceType} | ${module.packageCount} | ${formatAnalyzeBytes(module.estimatedSavingBytes)} | ${module.advice} |`)
    .join('\n')

  const budgetRows = budgetIssues
    .map(item => `| ${item.label} | ${item.scope} | ${formatAnalyzeBytes(item.currentBytes)} | ${formatAnalyzeBytes(item.limitBytes)} | ${formatBudgetStatus(item)} |`)
    .join('\n')

  return [
    '# weapp-vite analyze 报告',
    '',
    `生成时间：${result.metadata?.generatedAt ?? new Date().toISOString()}`,
    '',
    '## 本次变化摘要',
    '',
    `- 总产物体积：${formatAnalyzeBytes(totalBytes)}`,
    `- 压缩后体积：${formatAnalyzeBytes(compressedBytes)}`,
    `- 较上次：${formatDelta(typeof previousTotalBytes === 'number' ? totalBytes - previousTotalBytes : undefined)}`,
    `- 包体数量：${result.packages.length}`,
    `- 源码模块：${result.modules.length}`,
    `- 跨包复用：${duplicateInsights.length}`,
    `- 预算来源：${budgets?.source === 'config' ? '配置' : '默认'}`,
    '',
    '## 预算告警',
    '',
    '| 对象 | 范围 | 当前体积 | 预算 | 状态 |',
    '| --- | --- | ---: | ---: | --- |',
    budgetRows || '| - | - | 0 B | 0 B | 正常 |',
    '',
    '## 建议动作',
    '',
    ...actionItems.map(item => `- ${item}`),
    '',
    '## 包体预算',
    '',
    '| 包 | 类型 | 体积 | 压缩后 | 较上次 | 预算 |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    packageRows || '| - | - | 0 B | 0 B | 无变化 | 正常 |',
    '',
    '## Top 文件',
    '',
    '| 文件 | 包 | 类型 | 体积 | 压缩后 |',
    '| --- | --- | --- | ---: | ---: |',
    topFileRows || '| - | - | - | 0 B | 0 B |',
    '',
    '## 重复模块',
    '',
    '| 模块 | 来源 | 包数量 | 估算可节省 | 建议 |',
    '| --- | --- | ---: | ---: | --- |',
    duplicateRows || '| - | - | 0 | 0 B | - |',
    '',
  ].join('\n')
}
