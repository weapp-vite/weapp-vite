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

export interface AnalyzeIncrementAttributionItem {
  key: string
  type: 'new-file' | 'increased-file' | 'new-module' | 'increased-module'
  label: string
  category: string
  packageLabel: string
  file?: string
  currentBytes: number
  previousBytes: number
  deltaBytes: number
  advice: string
}

export interface AnalyzeIncrementCategorySummary {
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

function createFileKey(packageId: string, fileName: string) {
  return `${packageId}\u0000${fileName}`
}

function createFileSizeMap(result: AnalyzeSubpackagesResult | null | undefined) {
  const map = new Map<string, number>()
  for (const pkg of result?.packages ?? []) {
    for (const file of pkg.files) {
      map.set(createFileKey(pkg.id, file.file), getFileSize(file))
    }
  }
  return map
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

function classifyIncrementCategory(source: string, sourceType?: ModuleSourceType) {
  if (source.includes('wevu') || source.includes('@weapp-vite/dashboard')) {
    return 'WeVu / runtime'
  }
  if (sourceType === 'node_modules' || source.includes('node_modules')) {
    return '第三方依赖'
  }
  if (sourceType === 'workspace') {
    return '工作区包'
  }
  if (sourceType === 'plugin') {
    return '插件生成'
  }
  if (source.endsWith('.wxss') || source.endsWith('.css') || source.endsWith('.scss')) {
    return '样式资源'
  }
  if (source.endsWith('.wxml') || source.endsWith('.json')) {
    return '页面结构'
  }
  return '业务源码'
}

function createIncrementAdvice(item: Pick<AnalyzeIncrementAttributionItem, 'type' | 'category' | 'label'>) {
  if (item.category === '第三方依赖') {
    return '检查依赖是否只在必要分包引用，必要时收敛到公共入口或替换轻量实现。'
  }
  if (item.category === 'WeVu / runtime') {
    return '确认运行时能力是否被新页面引入，优先排查组件和 API 引用边界。'
  }
  if (item.category === '样式资源') {
    return '检查样式重复、原子类生成范围和组件样式裁剪。'
  }
  if (item.type === 'new-file' || item.type === 'new-module') {
    return '确认是否为本次需求必要新增，评估分包归属和懒加载边界。'
  }
  return '对比本次变更，优先查看新增引用、共享模块和大对象常量。'
}

function createModuleSizeMap(result: AnalyzeSubpackagesResult | null | undefined) {
  const map = new Map<string, { source: string, sourceType: ModuleSourceType, bytes: number, packageLabel: string, file: string }>()
  for (const pkg of result?.packages ?? []) {
    for (const file of pkg.files) {
      for (const module of file.modules ?? []) {
        const bytes = module.bytes ?? module.originalBytes ?? 0
        const existing = map.get(module.id)
        if (existing && existing.bytes >= bytes) {
          continue
        }
        map.set(module.id, {
          source: module.source,
          sourceType: module.sourceType,
          bytes,
          packageLabel: pkg.label,
          file: file.file,
        })
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

export function createAnalyzeIncrementAttribution(
  result: AnalyzeSubpackagesResult,
  previousResult?: AnalyzeSubpackagesResult | null,
): AnalyzeIncrementAttributionItem[] {
  if (!previousResult) {
    return []
  }

  const previousFiles = createFileSizeMap(previousResult)
  const previousModules = createModuleSizeMap(previousResult)
  const currentModules = createModuleSizeMap(result)
  const items: AnalyzeIncrementAttributionItem[] = []

  for (const pkg of result.packages) {
    for (const file of pkg.files) {
      const currentBytes = getFileSize(file)
      const previousBytes = previousFiles.get(createFileKey(pkg.id, file.file)) ?? 0
      const deltaBytes = currentBytes - previousBytes
      if (deltaBytes <= 0) {
        continue
      }
      const type: AnalyzeIncrementAttributionItem['type'] = previousBytes > 0 ? 'increased-file' : 'new-file'
      const item = {
        key: `file:${pkg.id}:${file.file}`,
        type,
        label: file.file,
        category: classifyIncrementCategory(file.source ?? file.file),
        packageLabel: pkg.label,
        file: file.file,
        currentBytes,
        previousBytes,
        deltaBytes,
        advice: '',
      }
      items.push({
        ...item,
        advice: createIncrementAdvice(item),
      })
    }
  }

  for (const [id, module] of currentModules) {
    const previousBytes = previousModules.get(id)?.bytes ?? 0
    const deltaBytes = module.bytes - previousBytes
    if (deltaBytes <= 0) {
      continue
    }
    const type: AnalyzeIncrementAttributionItem['type'] = previousBytes > 0 ? 'increased-module' : 'new-module'
    const item = {
      key: `module:${id}`,
      type,
      label: module.source,
      category: classifyIncrementCategory(module.source, module.sourceType),
      packageLabel: module.packageLabel,
      file: module.file,
      currentBytes: module.bytes,
      previousBytes,
      deltaBytes,
      advice: '',
    }
    items.push({
      ...item,
      advice: createIncrementAdvice(item),
    })
  }

  return items.sort((a, b) =>
    b.deltaBytes - a.deltaBytes
    || a.category.localeCompare(b.category)
    || a.label.localeCompare(b.label),
  )
}

export function createAnalyzeIncrementCategorySummary(items: AnalyzeIncrementAttributionItem[]): AnalyzeIncrementCategorySummary[] {
  const map = new Map<string, AnalyzeIncrementCategorySummary>()
  for (const item of items) {
    const entry = map.get(item.category) ?? {
      category: item.category,
      count: 0,
      deltaBytes: 0,
    }
    entry.count += 1
    entry.deltaBytes += item.deltaBytes
    map.set(item.category, entry)
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
  const previousTotalBytes = previousResult?.packages.flatMap(pkg => pkg.files).reduce((sum, file) => sum + getFileSize(file), 0)
  const incrementItems = createAnalyzeIncrementAttribution(result, previousResult)
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
    `- 总产物体积：${formatAnalyzeBytes(totalBytes)}（较上次 ${formatDelta(typeof previousTotalBytes === 'number' ? totalBytes - previousTotalBytes : undefined)}）`,
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
  const incrementItems = createAnalyzeIncrementAttribution(result, previousResult)
  const incrementSummary = createAnalyzeIncrementCategorySummary(incrementItems)
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
