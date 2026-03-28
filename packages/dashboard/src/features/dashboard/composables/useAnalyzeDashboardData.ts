import type { Ref } from 'vue'
import type {
  AnalyzeDashboardSummary,
  AnalyzeSubpackagesResult,
  DuplicateModuleEntry,
  LargestFileEntry,
  ModuleSourceSummary,
  ModuleSourceType,
  PackageFileEntry,
  PackageInsight,
  PackageType,
  SummaryMetric,
} from '../types'
import { computed } from 'vue'

function getFileSize(file: PackageFileEntry) {
  return file.size ?? 0
}

export function useAnalyzeDashboardData(resultRef: Ref<AnalyzeSubpackagesResult | null>) {
  const packageLabelMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.label])),
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

  const summary = computed<AnalyzeDashboardSummary>(() => {
    const result = resultRef.value
    if (!result) {
      return {
        packageCount: 0,
        moduleCount: 0,
        duplicateCount: 0,
        totalBytes: 0,
        subpackageCount: 0,
        entryCount: 0,
      }
    }

    const files = result.packages.flatMap(pkg => pkg.files)
    return {
      packageCount: result.packages.length,
      moduleCount: result.modules.length,
      duplicateCount: result.modules.filter(mod => mod.packages.length > 1).length,
      totalBytes: files.reduce((sum, file) => sum + getFileSize(file), 0),
      subpackageCount: result.subPackages.length,
      entryCount: files.filter(file => file.isEntry).length,
    }
  })

  const packageTypeSummary = computed<SummaryMetric[]>(() => {
    const counts = new Map<PackageType, number>()
    for (const pkg of resultRef.value?.packages ?? []) {
      counts.set(pkg.type, (counts.get(pkg.type) ?? 0) + 1)
    }
    return Array.from(counts.entries(), ([label, value]) => ({ label, value }))
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
          .map(file => ({
            file: file.file,
            size: getFileSize(file),
            type: file.type,
            from: file.from,
            isEntry: Boolean(file.isEntry),
            moduleCount: file.modules?.length ?? 0,
          }))
          .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file))
          .slice(0, 5)

        return {
          id: pkg.id,
          label: pkg.label,
          type: pkg.type,
          totalBytes: pkg.files.reduce((sum, file) => sum + getFileSize(file), 0),
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
        entries.push({
          packageId: pkg.id,
          packageLabel: pkg.label,
          packageType: pkg.type,
          file: file.file,
          size: getFileSize(file),
          type: file.type,
          from: file.from,
          isEntry: Boolean(file.isEntry),
          moduleCount: file.modules?.length ?? 0,
          source: file.source,
        })
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
        return {
          id: mod.id,
          source: mod.source,
          sourceType: mod.sourceType,
          packageCount: mod.packages.length,
          bytes: info?.bytes ?? info?.originalBytes ?? 0,
          packages: mod.packages.map(pkg => ({
            packageId: pkg.packageId,
            packageLabel: packageLabelMap.value.get(pkg.packageId) ?? pkg.packageId,
            files: pkg.files,
          })),
        }
      })
      .sort((a, b) =>
        b.packageCount - a.packageCount
        || b.bytes - a.bytes
        || a.source.localeCompare(b.source),
      )
  })

  const moduleSourceSummary = computed<ModuleSourceSummary[]>(() => {
    const summaryMap = new Map<ModuleSourceType, ModuleSourceSummary>()

    for (const mod of resultRef.value?.modules ?? []) {
      const info = moduleInfoMap.value.get(mod.id)
      const entry = summaryMap.get(mod.sourceType) ?? {
        sourceType: mod.sourceType,
        count: 0,
        bytes: 0,
      }
      entry.count += 1
      entry.bytes += info?.bytes ?? info?.originalBytes ?? 0
      summaryMap.set(mod.sourceType, entry)
    }

    return [...summaryMap.values()]
      .sort((a, b) => b.bytes - a.bytes || b.count - a.count || a.sourceType.localeCompare(b.sourceType))
  })

  return {
    summary,
    packageTypeSummary,
    packageInsights,
    largestFiles,
    duplicateModules,
    moduleSourceSummary,
    subPackages: computed(() => resultRef.value?.subPackages ?? []),
  }
}
