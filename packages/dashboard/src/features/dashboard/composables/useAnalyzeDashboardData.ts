import type { Ref } from 'vue'
import type {
  AnalyzeDashboardSummary,
  AnalyzeSubpackagesResult,
  DuplicateModuleEntry,
  LargestFileEntry,
  ModuleSourceSummary,
  ModuleSourceType,
  PackageBudgetLimitItem,
  PackageBudgetWarning,
  PackageFileEntry,
  PackageInsight,
  PackageType,
  SummaryMetric,
} from '../types'
import { computed } from 'vue'
import { estimateCompressedBytes } from '../utils/format'

const totalPackageBudgetBytes = 20 * 1024 * 1024
const singlePackageBudgetBytes = 2 * 1024 * 1024
const budgetWarningRatio = 0.85

interface FileComparisonMaps {
  packageBytes: Map<string, number>
  fileBytes: Map<string, number>
  totalBytes: number
  compressedBytes: number
}

function getFileSize(file: PackageFileEntry) {
  return file.size ?? 0
}

function getFileCompressedSize(file: PackageFileEntry) {
  return file.brotliSize ?? file.gzipSize ?? estimateCompressedBytes(getFileSize(file), file.file, file.type)
}

function getCompressedSizeSource(file: PackageFileEntry): 'real' | 'estimated' {
  return typeof file.brotliSize === 'number' || typeof file.gzipSize === 'number'
    ? 'real'
    : 'estimated'
}

function createSummaryMetric(label: PackageType, value: number): SummaryMetric {
  return { label, value }
}

function createFileKey(packageId: string, fileName: string) {
  return `${packageId}\u0000${fileName}`
}

function createComparisonMaps(result: AnalyzeSubpackagesResult | null): FileComparisonMaps {
  const packageBytes = new Map<string, number>()
  const fileBytes = new Map<string, number>()
  let totalBytes = 0
  let compressedBytes = 0

  for (const pkg of result?.packages ?? []) {
    let packageTotal = 0
    for (const file of pkg.files) {
      const size = getFileSize(file)
      packageTotal += size
      totalBytes += size
      compressedBytes += getFileCompressedSize(file)
      fileBytes.set(createFileKey(pkg.id, file.file), size)
    }
    packageBytes.set(pkg.id, packageTotal)
  }

  return {
    packageBytes,
    fileBytes,
    totalBytes,
    compressedBytes,
  }
}

function createLargestFileEntry(
  packageInfo: Pick<AnalyzeSubpackagesResult['packages'][number], 'id' | 'label' | 'type'>,
  file: PackageFileEntry,
  previousFiles: Map<string, number>,
): LargestFileEntry {
  const size = getFileSize(file)
  const previousSize = previousFiles.get(createFileKey(packageInfo.id, file.file))
  return {
    packageId: packageInfo.id,
    packageLabel: packageInfo.label,
    packageType: packageInfo.type,
    file: file.file,
    size,
    gzipSize: file.gzipSize,
    brotliSize: file.brotliSize,
    compressedSize: getFileCompressedSize(file),
    compressedSizeSource: getCompressedSizeSource(file),
    sizeDeltaBytes: typeof previousSize === 'number' ? size - previousSize : undefined,
    type: file.type,
    from: file.from,
    isEntry: Boolean(file.isEntry),
    moduleCount: file.modules?.length ?? 0,
    modules: file.modules,
    source: file.source,
  }
}

function createPackageTopFile(
  packageId: string,
  file: PackageFileEntry,
  previousFiles: Map<string, number>,
): PackageInsight['topFiles'][number] {
  const size = getFileSize(file)
  const previousSize = previousFiles.get(createFileKey(packageId, file.file))
  return {
    file: file.file,
    size,
    gzipSize: file.gzipSize,
    brotliSize: file.brotliSize,
    compressedSize: getFileCompressedSize(file),
    compressedSizeSource: getCompressedSizeSource(file),
    sizeDeltaBytes: typeof previousSize === 'number' ? size - previousSize : undefined,
    type: file.type,
    from: file.from,
    isEntry: Boolean(file.isEntry),
    moduleCount: file.modules?.length ?? 0,
  }
}

function createDuplicateModulePackageEntry(
  packageLabelMap: Map<string, string>,
  pkg: AnalyzeSubpackagesResult['modules'][number]['packages'][number],
): DuplicateModuleEntry['packages'][number] {
  return {
    packageId: pkg.packageId,
    packageLabel: packageLabelMap.get(pkg.packageId) ?? pkg.packageId,
    files: pkg.files,
  }
}

function classifyModuleSourceCategory(source: string, sourceType: ModuleSourceType) {
  if (source.includes('wevu') || source.includes('@weapp-vite/dashboard')) {
    return 'wevu / dashboard runtime'
  }
  if (sourceType === 'node_modules') {
    return '第三方依赖'
  }
  if (sourceType === 'plugin') {
    return '插件生成'
  }
  if (sourceType === 'workspace') {
    return '工作区包'
  }
  if (source.startsWith('pages/') || source.includes('/pages/')) {
    return '业务页面'
  }
  if (source.startsWith('components/') || source.includes('/components/')) {
    return '业务组件'
  }
  if (source.startsWith('shared/') || source.includes('/shared/') || source.includes('/utils/')) {
    return '业务共享'
  }
  return '业务源码'
}

function createModuleSourceSummary(sourceType: ModuleSourceType, sourceCategory: string): ModuleSourceSummary {
  return {
    sourceType,
    sourceCategory,
    count: 0,
    bytes: 0,
  }
}

function createDuplicateAdvice(
  sourceType: ModuleSourceType,
  packages: DuplicateModuleEntry['packages'],
  packageTypeMap: Map<string, PackageType>,
  estimatedSavingBytes: number,
) {
  const hasIndependentPackage = packages.some(pkg => packageTypeMap.get(pkg.packageId) === 'independent')
  if (hasIndependentPackage) {
    return estimatedSavingBytes > 0
      ? '含独立分包，先确认隔离要求，再评估公共入口。'
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

function createBudgetLimitItems(result: AnalyzeSubpackagesResult | null): PackageBudgetLimitItem[] {
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

export function useAnalyzeDashboardData(
  resultRef: Ref<AnalyzeSubpackagesResult | null>,
  previousResultRef?: Ref<AnalyzeSubpackagesResult | null>,
) {
  const previousMaps = computed(() => createComparisonMaps(previousResultRef?.value ?? null))

  const packageLabelMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.label])),
  )

  const packageTypeMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.type])),
  )

  const moduleInfoMap = computed(() => {
    const map = new Map<string, { bytes: number, originalBytes: number, sourceType: ModuleSourceType }>()

    for (const pkg of resultRef.value?.packages ?? []) {
      for (const file of pkg.files) {
        for (const mod of file.modules ?? []) {
          const existing = map.get(mod.id)
          const bytes = mod.bytes ?? 0
          const originalBytes = mod.originalBytes ?? bytes
          if (!existing) {
            map.set(mod.id, {
              bytes,
              originalBytes,
              sourceType: mod.sourceType,
            })
            continue
          }
          map.set(mod.id, {
            bytes: Math.max(existing.bytes, bytes),
            originalBytes: Math.max(existing.originalBytes, originalBytes),
            sourceType: existing.sourceType,
          })
        }
      }
    }

    return map
  })

  const budgetWarnings = computed<PackageBudgetWarning[]>(() => {
    const result = resultRef.value
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
  })

  const budgetLimitItems = computed<PackageBudgetLimitItem[]>(() => createBudgetLimitItems(resultRef.value))

  const summary = computed<AnalyzeDashboardSummary>(() => {
    const result = resultRef.value
    if (!result) {
      return {
        packageCount: 0,
        moduleCount: 0,
        duplicateCount: 0,
        totalBytes: 0,
        gzipBytes: 0,
        brotliBytes: 0,
        estimatedCompressedBytes: 0,
        compressedBytes: 0,
        compressedSizeSource: 'estimated',
        subpackageCount: 0,
        entryCount: 0,
        budgetWarningCount: 0,
      }
    }

    const files = result.packages.flatMap(pkg => pkg.files)
    const totalBytes = files.reduce((sum, file) => sum + getFileSize(file), 0)
    const gzipBytes = files.reduce((sum, file) => sum + (file.gzipSize ?? 0), 0)
    const brotliBytes = files.reduce((sum, file) => sum + (file.brotliSize ?? 0), 0)
    const estimatedCompressedBytes = files.reduce((sum, file) => sum + estimateCompressedBytes(getFileSize(file), file.file, file.type), 0)
    const hasRealCompressedSize = files.some(file => typeof file.gzipSize === 'number' || typeof file.brotliSize === 'number')
    const compressedBytes = hasRealCompressedSize
      ? files.reduce((sum, file) => sum + getFileCompressedSize(file), 0)
      : estimatedCompressedBytes

    return {
      packageCount: result.packages.length,
      moduleCount: result.modules.length,
      duplicateCount: result.modules.filter(mod => mod.packages.length > 1).length,
      totalBytes,
      gzipBytes,
      brotliBytes,
      estimatedCompressedBytes,
      compressedBytes,
      compressedSizeSource: hasRealCompressedSize ? 'real' : 'estimated',
      sizeDeltaBytes: previousMaps.value.totalBytes > 0 ? totalBytes - previousMaps.value.totalBytes : undefined,
      compressedDeltaBytes: previousMaps.value.compressedBytes > 0 ? compressedBytes - previousMaps.value.compressedBytes : undefined,
      subpackageCount: result.subPackages.length,
      entryCount: files.filter(file => file.isEntry).length,
      budgetWarningCount: budgetWarnings.value.length,
    }
  })

  const packageTypeSummary = computed<SummaryMetric[]>(() => {
    const counts = new Map<PackageType, number>()
    for (const pkg of resultRef.value?.packages ?? []) {
      counts.set(pkg.type, (counts.get(pkg.type) ?? 0) + 1)
    }
    return Array.from(counts.entries(), ([label, value]) => createSummaryMetric(label, value))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  })

  const packageInsights = computed<PackageInsight[]>(() => {
    const result = resultRef.value
    if (!result) {
      return []
    }

    return result.packages
      .map((pkg) => {
        const moduleIds = new Set<string>()
        let duplicateModuleCount = 0
        for (const mod of result.modules) {
          if (mod.packages.some(entry => entry.packageId === pkg.id)) {
            moduleIds.add(mod.id)
            if (mod.packages.length > 1) {
              duplicateModuleCount++
            }
          }
        }

        const topFiles = pkg.files
          .map(file => createPackageTopFile(pkg.id, file, previousMaps.value.fileBytes))
          .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file))
          .slice(0, 5)
        const totalBytes = pkg.files.reduce((sum, file) => sum + getFileSize(file), 0)
        const gzipBytes = pkg.files.reduce((sum, file) => sum + (file.gzipSize ?? 0), 0)
        const brotliBytes = pkg.files.reduce((sum, file) => sum + (file.brotliSize ?? 0), 0)
        const compressedBytes = pkg.files.reduce((sum, file) => sum + getFileCompressedSize(file), 0)
        const hasRealCompressedSize = pkg.files.some(file => typeof file.gzipSize === 'number' || typeof file.brotliSize === 'number')
        const previousBytes = previousMaps.value.packageBytes.get(pkg.id)

        return {
          id: pkg.id,
          label: pkg.label,
          type: pkg.type,
          totalBytes,
          gzipBytes,
          brotliBytes,
          compressedBytes,
          compressedSizeSource: hasRealCompressedSize ? 'real' : 'estimated',
          sizeDeltaBytes: typeof previousBytes === 'number' ? totalBytes - previousBytes : undefined,
          fileCount: pkg.files.length,
          chunkCount: pkg.files.filter(file => file.type === 'chunk').length,
          assetCount: pkg.files.filter(file => file.type === 'asset').length,
          moduleCount: moduleIds.size,
          duplicateModuleCount,
          entryFileCount: pkg.files.filter(file => file.isEntry).length,
          topFiles,
        }
      })
      .sort((a, b) => b.totalBytes - a.totalBytes || a.label.localeCompare(b.label))
  })

  const largestFiles = computed<LargestFileEntry[]>(() => {
    const entries: LargestFileEntry[] = []

    for (const pkg of resultRef.value?.packages ?? []) {
      for (const file of pkg.files) {
        entries.push(createLargestFileEntry(pkg, file, previousMaps.value.fileBytes))
      }
    }

    return entries
      .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file))
      .slice(0, 18)
  })

  const duplicateModules = computed<DuplicateModuleEntry[]>(() => {
    const result = resultRef.value
    if (!result) {
      return []
    }

    return result.modules
      .filter(mod => mod.packages.length > 1)
      .map((mod) => {
        const info = moduleInfoMap.value.get(mod.id)
        const packages = mod.packages.map(pkg => createDuplicateModulePackageEntry(packageLabelMap.value, pkg))
        const bytes = info?.bytes ?? info?.originalBytes ?? 0
        const estimatedSavingBytes = bytes * Math.max(mod.packages.length - 1, 0)
        return {
          id: mod.id,
          source: mod.source,
          sourceType: mod.sourceType,
          packageCount: mod.packages.length,
          bytes,
          estimatedSavingBytes,
          advice: createDuplicateAdvice(mod.sourceType, packages, packageTypeMap.value, estimatedSavingBytes),
          packages,
        }
      })
      .sort((a, b) =>
        b.estimatedSavingBytes - a.estimatedSavingBytes
        || b.packageCount - a.packageCount
        || b.bytes - a.bytes
        || a.source.localeCompare(b.source),
      )
  })

  const moduleSourceSummary = computed<ModuleSourceSummary[]>(() => {
    const summaryMap = new Map<string, ModuleSourceSummary>()

    for (const mod of resultRef.value?.modules ?? []) {
      const info = moduleInfoMap.value.get(mod.id)
      const sourceCategory = classifyModuleSourceCategory(mod.source, mod.sourceType)
      const entryKey = `${mod.sourceType}:${sourceCategory}`
      const entry = summaryMap.get(entryKey) ?? createModuleSourceSummary(mod.sourceType, sourceCategory)
      entry.count += 1
      entry.bytes += info?.bytes ?? info?.originalBytes ?? 0
      summaryMap.set(entryKey, entry)
    }

    return [...summaryMap.values()]
      .sort((a, b) => b.bytes - a.bytes || b.count - a.count || a.sourceCategory.localeCompare(b.sourceCategory))
  })

  return {
    summary,
    packageTypeSummary,
    packageInsights,
    largestFiles,
    duplicateModules,
    moduleSourceSummary,
    budgetWarnings,
    budgetLimitItems,
    subPackages: computed(() => resultRef.value?.subPackages ?? []),
  }
}
