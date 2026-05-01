import type {
  AnalyzeDashboardSummary,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  IncrementAttributionSummary,
  LargestFileEntry,
  PackageBudgetWarning,
  PackageInsight,
} from '../types'
import { formatBytes } from './format'

export function createAnalyzeSummaryText(options: {
  summary: AnalyzeDashboardSummary
  packageInsights: PackageInsight[]
  duplicateModules: DuplicateModuleEntry[]
}) {
  const topPackage = options.packageInsights[0]
  const topDuplicate = options.duplicateModules[0]
  return [
    `总产物体积：${formatBytes(options.summary.totalBytes)}`,
    `Gzip：${formatBytes(options.summary.gzipBytes)}`,
    `Brotli/压缩后：${formatBytes(options.summary.compressedBytes)}`,
    `包体：${options.summary.packageCount} 个，分包配置：${options.summary.subpackageCount} 个`,
    `模块：${options.summary.moduleCount} 个，跨包复用：${options.summary.duplicateCount} 个`,
    `预算告警：${options.summary.budgetWarningCount} 个`,
    topPackage ? `最大包：${topPackage.label} ${formatBytes(topPackage.totalBytes)}` : '',
    topDuplicate ? `首要重复模块：${topDuplicate.source}，估算可节省 ${formatBytes(topDuplicate.estimatedSavingBytes)}（${topDuplicate.advice}）` : '',
  ].filter(Boolean).join('\n')
}

export function createAnalyzeMarkdownReport(options: {
  generatedAt?: string
  summary: AnalyzeDashboardSummary
  packageInsights: PackageInsight[]
  largestFiles: LargestFileEntry[]
  duplicateModules: DuplicateModuleEntry[]
  budgetWarnings: PackageBudgetWarning[]
}) {
  const packageRows = options.packageInsights
    .map(pkg => `| ${pkg.label} | ${pkg.type} | ${formatBytes(pkg.totalBytes)} | ${formatBytes(pkg.compressedBytes)} | ${typeof pkg.sizeDeltaBytes === 'number' ? `${pkg.sizeDeltaBytes > 0 ? '+' : '-'}${formatBytes(Math.abs(pkg.sizeDeltaBytes))}` : '无变化'} |`)
    .join('\n')
  const topFileRows = options.largestFiles.slice(0, 10)
    .map(file => `| ${file.file} | ${file.packageLabel} | ${file.type} | ${formatBytes(file.size)} | ${formatBytes(file.compressedSize)} |`)
    .join('\n')
  const duplicateRows = options.duplicateModules.slice(0, 10)
    .map(module => `| ${module.source} | ${module.sourceType} | ${module.packageCount} | ${formatBytes(module.estimatedSavingBytes)} | ${module.advice} |`)
    .join('\n')
  const budgetRows = options.budgetWarnings
    .map(item => `| ${item.label} | ${item.scope} | ${formatBytes(item.currentBytes)} | ${formatBytes(item.limitBytes)} | ${item.status === 'critical' ? '超预算' : '接近预算'} ${(item.ratio * 100).toFixed(1)}% |`)
    .join('\n')
  const topDuplicate = options.duplicateModules.find(module => module.estimatedSavingBytes > 0)

  return [
    '# weapp-vite analyze 报告',
    '',
    `生成时间：${options.generatedAt ?? new Date().toISOString()}`,
    '',
    '## 本次变化摘要',
    '',
    `- 总产物体积：${formatBytes(options.summary.totalBytes)}`,
    `- 压缩后体积：${formatBytes(options.summary.compressedBytes)}`,
    `- 包体数量：${options.summary.packageCount}`,
    `- 源码模块：${options.summary.moduleCount}`,
    `- 跨包复用：${options.summary.duplicateCount}`,
    `- 预算告警：${options.summary.budgetWarningCount}`,
    '',
    '## 预算告警',
    '',
    '| 对象 | 范围 | 当前体积 | 预算 | 状态 |',
    '| --- | --- | ---: | ---: | --- |',
    budgetRows || '| - | - | 0 B | 0 B | 正常 |',
    '',
    '## 建议动作',
    '',
    options.budgetWarnings[0]
      ? `- 优先处理 ${options.budgetWarnings[0].label}：当前 ${formatBytes(options.budgetWarnings[0].currentBytes)}，预算 ${formatBytes(options.budgetWarnings[0].limitBytes)}。`
      : '- 当前没有预算超限或接近预算的包体。',
    topDuplicate
      ? `- 优先处理重复模块 ${topDuplicate.source}，估算可节省 ${formatBytes(topDuplicate.estimatedSavingBytes)}。`
      : '- 当前没有可估算收益的重复模块。',
    '',
    '## 包体',
    '',
    '| 包 | 类型 | 体积 | 压缩后 | 较上次 |',
    '| --- | --- | ---: | ---: | ---: |',
    packageRows || '| - | - | 0 B | 0 B | 无变化 |',
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

export function createAnalyzePrMarkdownReport(options: {
  summary: AnalyzeDashboardSummary
  incrementAttribution: IncrementAttributionEntry[]
  incrementSummary: IncrementAttributionSummary[]
  budgetWarnings: PackageBudgetWarning[]
  duplicateModules: DuplicateModuleEntry[]
}) {
  const topIncrementRows = options.incrementAttribution.slice(0, 8)
    .map(item => `| ${item.label} | ${item.category} | ${item.packageLabel} | +${formatBytes(item.deltaBytes)} | ${item.advice} |`)
    .join('\n')
  const incrementSummaryRows = options.incrementSummary.slice(0, 6)
    .map(item => `| ${item.category} | ${item.count} | +${formatBytes(item.deltaBytes)} |`)
    .join('\n')
  const budgetRows = options.budgetWarnings.slice(0, 5)
    .map(item => `| ${item.label} | ${formatBytes(item.currentBytes)} | ${formatBytes(item.limitBytes)} | ${item.status === 'critical' ? '超预算' : '接近预算'} ${(item.ratio * 100).toFixed(1)}% |`)
    .join('\n')
  const duplicateRows = options.duplicateModules.slice(0, 5)
    .map(module => `| ${module.source} | ${module.packageCount} | ${formatBytes(module.estimatedSavingBytes)} | ${module.advice} |`)
    .join('\n')
  return [
    '## weapp-vite analyze PR 摘要',
    '',
    `- 总产物体积：${formatBytes(options.summary.totalBytes)}${typeof options.summary.sizeDeltaBytes === 'number' ? `（较上次 ${options.summary.sizeDeltaBytes >= 0 ? '+' : '-'}${formatBytes(Math.abs(options.summary.sizeDeltaBytes))}）` : ''}`,
    `- 压缩后体积：${formatBytes(options.summary.compressedBytes)}`,
    `- 预算告警：${options.budgetWarnings.length}`,
    `- 增量归因：${options.incrementAttribution.length > 0 ? `${options.incrementAttribution.length} 项正向增长` : '无正向增长'}`,
    `- 跨包复用：${options.duplicateModules.length}`,
    '',
    '### 增量来源',
    '',
    '| 来源 | 项数 | 增量 |',
    '| --- | ---: | ---: |',
    incrementSummaryRows || '| - | 0 | 0 B |',
    '',
    '### Top 增量',
    '',
    '| 文件/模块 | 来源 | 包 | 增量 | 建议 |',
    '| --- | --- | --- | ---: | --- |',
    topIncrementRows || '| - | - | - | 0 B | - |',
    '',
    '### 预算状态',
    '',
    '| 对象 | 当前体积 | 预算 | 状态 |',
    '| --- | ---: | ---: | --- |',
    budgetRows || '| - | 0 B | 0 B | 正常 |',
    '',
    '### 重复模块',
    '',
    '| 模块 | 包数量 | 估算可节省 | 建议 |',
    '| --- | ---: | ---: | --- |',
    duplicateRows || '| - | 0 | 0 B | - |',
    '',
  ].join('\n')
}

function escapeCsvCell(value: string | number | undefined) {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) {
    return text
  }
  return `"${text.replaceAll('"', '""')}"`
}

function createCsvRow(values: Array<string | number | undefined>) {
  return values.map(escapeCsvCell).join(',')
}

export function createAnalyzeCsvReport(options: {
  packageInsights: PackageInsight[]
  largestFiles: LargestFileEntry[]
  duplicateModules: DuplicateModuleEntry[]
  incrementAttribution: IncrementAttributionEntry[]
}) {
  const rows = [
    createCsvRow(['section', 'label', 'package', 'type', 'sizeBytes', 'compressedBytes', 'deltaBytes', 'count', 'detail']),
  ]

  for (const pkg of options.packageInsights) {
    rows.push(createCsvRow([
      'package',
      pkg.label,
      pkg.id,
      pkg.type,
      pkg.totalBytes,
      pkg.compressedBytes,
      pkg.sizeDeltaBytes,
      pkg.fileCount,
      `${pkg.moduleCount} modules; ${pkg.duplicateModuleCount} duplicate modules`,
    ]))
  }

  for (const file of options.largestFiles) {
    rows.push(createCsvRow([
      'file',
      file.file,
      file.packageLabel,
      file.type,
      file.size,
      file.compressedSize,
      file.sizeDeltaBytes,
      file.moduleCount,
      file.source ?? file.from,
    ]))
  }

  for (const module of options.duplicateModules) {
    rows.push(createCsvRow([
      'duplicate-module',
      module.source,
      module.packages.map(pkg => pkg.packageLabel).join('; '),
      module.sourceType,
      module.bytes,
      module.estimatedSavingBytes,
      undefined,
      module.packageCount,
      module.advice,
    ]))
  }

  for (const item of options.incrementAttribution) {
    rows.push(createCsvRow([
      'increment',
      item.label,
      item.packageLabel,
      item.category,
      item.currentBytes,
      item.deltaBytes,
      item.deltaBytes,
      1,
      item.advice,
    ]))
  }

  return rows.join('\n')
}
