import type { AnalyzeBudgetConfig, AnalyzeSubpackagesResult, PackageType } from './types'

function formatBytes(bytes?: number) {
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
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
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

export function createAnalyzeMarkdownReport(
  result: AnalyzeSubpackagesResult,
  previousResult?: AnalyzeSubpackagesResult | null,
) {
  const files = result.packages.flatMap(pkg => pkg.files.map(file => ({ pkg, file })))
  const totalBytes = files.reduce((sum, item) => sum + getFileSize(item.file), 0)
  const compressedBytes = files.reduce((sum, item) => sum + getCompressedSize(item.file), 0)
  const duplicateModules = result.modules.filter(module => module.packages.length > 1)
  const previousTotalBytes = previousResult?.packages.flatMap(pkg => pkg.files).reduce((sum, file) => sum + getFileSize(file), 0)
  const previousPackageSizes = createPackageSizeMap(previousResult)
  const budgets = result.metadata?.budgets
  const warningRatio = budgets?.warningRatio ?? 0.85

  const packageRows = result.packages
    .map((pkg) => {
      const size = pkg.files.reduce((sum, file) => sum + getFileSize(file), 0)
      const compressed = pkg.files.reduce((sum, file) => sum + getCompressedSize(file), 0)
      const previousSize = previousPackageSizes.get(pkg.id)
      const budgetLimit = getBudgetLimit(pkg.type, budgets)
      const budgetStatus = budgetLimit && size >= budgetLimit * warningRatio
        ? `${size >= budgetLimit ? '超预算' : '接近预算'} ${(size / budgetLimit * 100).toFixed(1)}%`
        : '正常'
      return `| ${pkg.label} | ${pkg.type} | ${formatBytes(size)} | ${formatBytes(compressed)} | ${formatDelta(typeof previousSize === 'number' ? size - previousSize : undefined)} | ${budgetStatus} |`
    })
    .join('\n')

  const topFileRows = files
    .sort((a, b) => getFileSize(b.file) - getFileSize(a.file) || a.file.file.localeCompare(b.file.file))
    .slice(0, 10)
    .map(item => `| ${item.file.file} | ${item.pkg.label} | ${item.file.type} | ${formatBytes(getFileSize(item.file))} | ${formatBytes(getCompressedSize(item.file))} |`)
    .join('\n')

  const duplicateRows = duplicateModules
    .slice(0, 10)
    .map(module => `| ${module.source} | ${module.sourceType} | ${module.packages.length} | ${module.packages.map(pkg => pkg.packageId).join(', ')} |`)
    .join('\n')

  return [
    '# weapp-vite analyze 报告',
    '',
    `生成时间：${result.metadata?.generatedAt ?? new Date().toISOString()}`,
    '',
    '## 总览',
    '',
    `- 总产物体积：${formatBytes(totalBytes)}`,
    `- 压缩后体积：${formatBytes(compressedBytes)}`,
    `- 较上次：${formatDelta(typeof previousTotalBytes === 'number' ? totalBytes - previousTotalBytes : undefined)}`,
    `- 包体数量：${result.packages.length}`,
    `- 源码模块：${result.modules.length}`,
    `- 跨包复用：${duplicateModules.length}`,
    `- 预算来源：${budgets?.source === 'config' ? '配置' : '默认'}`,
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
    '| 模块 | 来源 | 包数量 | 包 |',
    '| --- | --- | ---: | --- |',
    duplicateRows || '| - | - | 0 | - |',
    '',
  ].join('\n')
}
