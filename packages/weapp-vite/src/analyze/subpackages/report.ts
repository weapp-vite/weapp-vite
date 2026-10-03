import type { AnalyzeBudgetCheckItem, AnalyzeComparison, AnalyzeSizeChange, DuplicateModuleInsight } from '../../dashboard/analyze'
import type { AnalyzeSubpackagesResult } from './types'
import { createAnalyzeBudgetCheck, createAnalyzeComparison, createDuplicateModuleInsights } from '../../dashboard/analyze'

interface AnalyzeIncrementCategorySummary {
  category: string
  count: number
  deltaBytes: number
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

function formatDelta(bytes?: number | null) {
  if (bytes === null) {
    return '缺少体积测量'
  }
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

function createReportGrowth(comparison?: AnalyzeComparison) {
  if (!comparison) {
    return []
  }
  return [...comparison.files, ...comparison.modules]
    .filter((item): item is typeof item & { deltaBytes: number } => item.deltaBytes !== null && item.deltaBytes > 0)
    .sort((a, b) =>
      b.deltaBytes - a.deltaBytes
      || (a.category ?? '').localeCompare(b.category ?? '')
      || a.label.localeCompare(b.label),
    )
}

function createAnalyzeIncrementCategorySummary(items: Array<AnalyzeSizeChange & { deltaBytes: number }>): AnalyzeIncrementCategorySummary[] {
  const map = new Map<string, AnalyzeIncrementCategorySummary>()
  for (const item of items) {
    const category = item.category ?? ''
    const entry = map.get(category) ?? {
      category,
      count: 0,
      deltaBytes: 0,
    }
    entry.count += 1
    entry.deltaBytes += item.deltaBytes
    map.set(category, entry)
  }
  return [...map.values()]
    .sort((a, b) => b.deltaBytes - a.deltaBytes || b.count - a.count || a.category.localeCompare(b.category))
}

export function createAnalyzePrMarkdownReport(
  result: AnalyzeSubpackagesResult,
  previousResult?: AnalyzeSubpackagesResult | null,
) {
  const files = result.packages.flatMap(pkg => pkg.files.map(file => ({ pkg, file })))
  const totalBytes = files.reduce((sum, item) => sum + getFileSize(item.file), 0)
  const compressedBytes = files.reduce((sum, item) => sum + getCompressedSize(item.file), 0)
  const comparison = previousResult ? createAnalyzeComparison(result, previousResult) : undefined
  const incrementItems = createReportGrowth(comparison)
  const incrementSummary = createAnalyzeIncrementCategorySummary(incrementItems)
  const duplicateInsights = createDuplicateModuleInsights(result)
  const budgetItems = createAnalyzeBudgetCheck(result)
  const budgetIssues = budgetItems.filter(item => item.status !== 'ok')
  const actionItems = createActionItems({ budgetItems, duplicateInsights }).slice(0, 3)

  const budgetRows = budgetIssues
    .slice(0, 5)
    .map(item => `| ${item.label} | ${formatAnalyzeBytes(item.currentBytes)} | ${formatAnalyzeBytes(item.limitBytes)} | ${formatBudgetStatus(item)} |`)
    .join('\n')
  const incrementRows = incrementItems
    .slice(0, 8)
    .map(item => `| ${item.label} | ${item.category} | ${item.packageLabel} | ${formatAnalyzeBytes(item.deltaBytes)} | ${item.advice} |`)
    .join('\n')
  const sourceRows = incrementSummary
    .slice(0, 6)
    .map(item => `| ${item.category} | ${item.count} | ${formatAnalyzeBytes(item.deltaBytes)} |`)
    .join('\n')
  const duplicateRows = duplicateInsights
    .slice(0, 5)
    .map(module => `| ${module.source} | ${module.packageCount} | ${formatAnalyzeBytes(module.estimatedSavingBytes)} | ${module.advice} |`)
    .join('\n')

  return [
    '## weapp-vite analyze PR 摘要',
    '',
    `- 总产物体积：${formatAnalyzeBytes(totalBytes)}（较上次 ${formatDelta(comparison?.deltaBytes)}）`,
    `- 压缩后体积：${formatAnalyzeBytes(compressedBytes)}`,
    `- 预算告警：${budgetIssues.length}`,
    `- 增量归因：${incrementItems.length > 0 ? `${incrementItems.length} 项正向增长` : '无正向增长'}`,
    `- 跨包复用：${duplicateInsights.length}`,
    '',
    '### 建议动作',
    '',
    ...actionItems.map(item => `- ${item}`),
    '',
    '### 预算状态',
    '',
    '| 对象 | 当前体积 | 预算 | 状态 |',
    '| --- | ---: | ---: | --- |',
    budgetRows || '| - | 0 B | 0 B | 正常 |',
    '',
    '### 增量来源',
    '',
    '| 来源 | 项数 | 增量 |',
    '| --- | ---: | ---: |',
    sourceRows || '| - | 0 | 0 B |',
    '',
    '### Top 增量',
    '',
    '| 文件/模块 | 来源 | 包 | 增量 | 建议 |',
    '| --- | --- | --- | ---: | --- |',
    incrementRows || '| - | - | - | 0 B | - |',
    '',
    '### 重复模块',
    '',
    '| 模块 | 包数量 | 估算可节省 | 建议 |',
    '| --- | ---: | ---: | --- |',
    duplicateRows || '| - | 0 | 0 B | - |',
    '',
  ].join('\n')
}

export function createAnalyzeMarkdownReport(
  result: AnalyzeSubpackagesResult,
  previousResult?: AnalyzeSubpackagesResult | null,
) {
  const files = result.packages.flatMap(pkg => pkg.files.map(file => ({ pkg, file })))
  const totalBytes = files.reduce((sum, item) => sum + getFileSize(item.file), 0)
  const compressedBytes = files.reduce((sum, item) => sum + getCompressedSize(item.file), 0)
  const duplicateInsights = createDuplicateModuleInsights(result)
  const comparison = previousResult ? createAnalyzeComparison(result, previousResult) : undefined
  const incrementItems = createReportGrowth(comparison)
  const incrementSummary = createAnalyzeIncrementCategorySummary(incrementItems)
  const budgetItems = createAnalyzeBudgetCheck(result)
  const packageDeltas = new Map(comparison?.packages.map(item => [item.packageId, item.deltaBytes]))
  const budgets = result.metadata?.budgets
  const budgetIssues = budgetItems.filter(item => item.status !== 'ok')
  const actionItems = createActionItems({ budgetItems, duplicateInsights })

  const packageRows = result.packages
    .map((pkg) => {
      const size = pkg.files.reduce((sum, file) => sum + getFileSize(file), 0)
      const compressed = pkg.files.reduce((sum, file) => sum + getCompressedSize(file), 0)
      const delta = packageDeltas.has(pkg.id) ? packageDeltas.get(pkg.id) : 0
      const budgetStatus = budgetItems.find(item => item.id === pkg.id)
      return `| ${pkg.label} | ${pkg.type} | ${formatAnalyzeBytes(size)} | ${formatAnalyzeBytes(compressed)} | ${formatDelta(delta)} | ${budgetStatus ? formatBudgetStatus(budgetStatus) : '正常'} |`
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
  const incrementRows = incrementItems
    .slice(0, 10)
    .map(item => `| ${item.label} | ${item.category} | ${item.packageLabel} | ${formatAnalyzeBytes(item.deltaBytes)} | ${item.advice} |`)
    .join('\n')
  const incrementSummaryRows = incrementSummary
    .slice(0, 8)
    .map(item => `| ${item.category} | ${item.count} | ${formatAnalyzeBytes(item.deltaBytes)} |`)
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
    `- 较上次：${formatDelta(comparison?.deltaBytes)}`,
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
    '## 增量归因',
    '',
    '| 来源 | 项数 | 增量 |',
    '| --- | ---: | ---: |',
    incrementSummaryRows || '| - | 0 | 0 B |',
    '',
    '| 文件/模块 | 来源 | 包 | 增量 | 建议 |',
    '| --- | --- | --- | ---: | --- |',
    incrementRows || '| - | - | - | 0 B | - |',
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
