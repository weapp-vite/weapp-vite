import type {
  AnalyzeDashboardSummary,
  AnalyzeSubpackagesResult,
  LargestFileEntry,
  PackageBudgetWarning,
  PackageFileEntry,
  PackageInsight,
  PackageType,
  SummaryMetric,
} from '../types'
import type { FileComparisonMaps } from './analyzeDataShared'
import { createFileKey, getCompressedSizeSource, getFileCompressedSize, getFileSize } from './analyzeDataShared'
import { estimateCompressedBytes } from './format'

function createSummaryMetric(label: PackageType, value: number): SummaryMetric {
  return { label, value }
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

export function createAnalyzeSummary(options: {
  result: AnalyzeSubpackagesResult | null
  previousMaps: FileComparisonMaps
  budgetWarnings: PackageBudgetWarning[]
}): AnalyzeDashboardSummary {
  if (!options.result) {
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

  const files = options.result.packages.flatMap(pkg => pkg.files)
  const totalBytes = files.reduce((sum, file) => sum + getFileSize(file), 0)
  const gzipBytes = files.reduce((sum, file) => sum + (file.gzipSize ?? 0), 0)
  const brotliBytes = files.reduce((sum, file) => sum + (file.brotliSize ?? 0), 0)
  const estimatedCompressedBytes = files.reduce((sum, file) => sum + estimateCompressedBytes(getFileSize(file), file.file, file.type), 0)
  const hasRealCompressedSize = files.some(file => typeof file.gzipSize === 'number' || typeof file.brotliSize === 'number')
  const compressedBytes = hasRealCompressedSize
    ? files.reduce((sum, file) => sum + getFileCompressedSize(file), 0)
    : estimatedCompressedBytes

  return {
    packageCount: options.result.packages.length,
    moduleCount: options.result.modules.length,
    duplicateCount: options.result.modules.filter(mod => mod.packages.length > 1).length,
    totalBytes,
    gzipBytes,
    brotliBytes,
    estimatedCompressedBytes,
    compressedBytes,
    compressedSizeSource: hasRealCompressedSize ? 'real' : 'estimated',
    sizeDeltaBytes: options.previousMaps.totalBytes > 0 ? totalBytes - options.previousMaps.totalBytes : undefined,
    compressedDeltaBytes: options.previousMaps.compressedBytes > 0 ? compressedBytes - options.previousMaps.compressedBytes : undefined,
    subpackageCount: options.result.subPackages.length,
    entryCount: files.filter(file => file.isEntry).length,
    budgetWarningCount: options.budgetWarnings.length,
  }
}

export function createPackageTypeSummary(result: AnalyzeSubpackagesResult | null): SummaryMetric[] {
  const counts = new Map<PackageType, number>()
  for (const pkg of result?.packages ?? []) {
    counts.set(pkg.type, (counts.get(pkg.type) ?? 0) + 1)
  }
  return Array.from(counts.entries(), ([label, value]) => createSummaryMetric(label, value))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

export function createPackageInsights(
  result: AnalyzeSubpackagesResult | null,
  previousMaps: FileComparisonMaps,
): PackageInsight[] {
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
        .map(file => createPackageTopFile(pkg.id, file, previousMaps.fileBytes))
        .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file))
        .slice(0, 5)
      const totalBytes = pkg.files.reduce((sum, file) => sum + getFileSize(file), 0)
      const gzipBytes = pkg.files.reduce((sum, file) => sum + (file.gzipSize ?? 0), 0)
      const brotliBytes = pkg.files.reduce((sum, file) => sum + (file.brotliSize ?? 0), 0)
      const compressedBytes = pkg.files.reduce((sum, file) => sum + getFileCompressedSize(file), 0)
      const compressedSizeSource = pkg.files.some(file => typeof file.gzipSize === 'number' || typeof file.brotliSize === 'number')
        ? 'real' as const
        : 'estimated' as const
      const previousBytes = previousMaps.packageBytes.get(pkg.id)

      return {
        id: pkg.id,
        label: pkg.label,
        type: pkg.type,
        totalBytes,
        gzipBytes,
        brotliBytes,
        compressedBytes,
        compressedSizeSource,
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
}

export function createLargestFiles(
  result: AnalyzeSubpackagesResult | null,
  previousFiles: Map<string, number>,
): LargestFileEntry[] {
  const entries: LargestFileEntry[] = []

  for (const pkg of result?.packages ?? []) {
    for (const file of pkg.files) {
      entries.push(createLargestFileEntry(pkg, file, previousFiles))
    }
  }

  return entries
    .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file))
    .slice(0, 18)
}
