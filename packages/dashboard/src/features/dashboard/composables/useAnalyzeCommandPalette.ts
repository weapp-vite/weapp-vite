import type { ComputedRef } from 'vue'
import type {
  AnalyzeActionCenterItem,
  AnalyzeCommandPaletteItem,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  LargestFileEntry,
  PackageBudgetWarning,
  PackageInsight,
} from '../types'
import { computed } from 'vue'
import { formatBytes, formatPackageType } from '../utils/format'
import {
  createTreemapModuleNodeId,
  createTreemapPackageNodeId,
} from '../utils/treemap'

function createKeywords(parts: Array<string | number | undefined>) {
  return parts
    .filter(part => part !== undefined && part !== '')
    .join(' ')
    .toLowerCase()
}

function findPackage(packageInsights: PackageInsight[], packageId: string | undefined, packageLabel?: string) {
  return packageInsights.find(pkg => pkg.id === packageId || pkg.label === packageLabel)
}

function findFile(largestFiles: LargestFileEntry[], packageId: string | undefined, fileName: string | undefined) {
  if (!packageId || !fileName) {
    return undefined
  }
  return largestFiles.find(file => file.packageId === packageId && file.file === fileName)
}

function createPackageItem(pkg: PackageInsight): AnalyzeCommandPaletteItem {
  return {
    key: `package:${pkg.id}`,
    kind: 'package',
    title: pkg.label,
    meta: `${formatPackageType(pkg.type)} · ${pkg.fileCount} 个产物 · ${pkg.moduleCount} 个模块`,
    value: formatBytes(pkg.totalBytes),
    keywords: createKeywords([pkg.id, pkg.label, pkg.type, pkg.totalBytes]),
    tab: 'packages',
    packageMeta: {
      kind: 'package',
      nodeId: createTreemapPackageNodeId(pkg.id),
      packageId: pkg.id,
      packageLabel: pkg.label,
      packageType: pkg.type,
      fileCount: pkg.fileCount,
      totalBytes: pkg.totalBytes,
    },
  }
}

function createFileItem(file: LargestFileEntry): AnalyzeCommandPaletteItem {
  return {
    key: `file:${file.packageId}:${file.file}`,
    kind: 'file',
    title: file.file,
    meta: `${file.packageLabel} · ${file.type} · 压缩后 ${formatBytes(file.compressedSize)}`,
    value: formatBytes(file.size),
    keywords: createKeywords([file.packageId, file.packageLabel, file.file, file.type, file.source, file.size]),
    tab: 'overview',
    file,
  }
}

function createBudgetItem(warning: PackageBudgetWarning): AnalyzeCommandPaletteItem {
  return {
    key: `budget:${warning.id}`,
    kind: 'budget',
    title: `${warning.label} 预算`,
    meta: `${warning.status === 'critical' ? '已超预算' : '接近预算'} · ${formatBytes(warning.currentBytes)} / ${formatBytes(warning.limitBytes)}`,
    value: `${(warning.ratio * 100).toFixed(1)}%`,
    keywords: createKeywords([warning.id, warning.label, warning.scope, warning.status, warning.currentBytes]),
    tab: 'overview',
    warning,
  }
}

function createDuplicateModuleItem(
  module: DuplicateModuleEntry,
  packageInsights: PackageInsight[],
): AnalyzeCommandPaletteItem {
  const firstPackage = module.packages[0]
  const fileName = firstPackage?.files[0] ?? ''
  const packageInfo = findPackage(packageInsights, firstPackage?.packageId, firstPackage?.packageLabel)
  const packageLabel = packageInfo?.label ?? firstPackage?.packageLabel ?? ''

  return {
    key: `module:${module.id}`,
    kind: 'module',
    title: module.source,
    meta: `${module.sourceType} · ${module.packageCount} 个包复用 · ${module.advice}`,
    value: `可省 ${formatBytes(module.estimatedSavingBytes)}`,
    keywords: createKeywords([module.id, module.source, module.sourceType, module.packageCount, module.packages.map(pkg => pkg.packageLabel).join(' ')]),
    tab: 'modules',
    moduleMeta: firstPackage && packageInfo
      ? {
          kind: 'module',
          nodeId: createTreemapModuleNodeId(firstPackage.packageId, fileName, module.id),
          packageId: firstPackage.packageId,
          packageLabel,
          fileName,
          source: module.source,
          sourceType: module.sourceType,
          bytes: module.bytes,
          packageCount: module.packageCount,
        }
      : undefined,
  }
}

function createIncrementItem(
  item: IncrementAttributionEntry,
  largestFiles: LargestFileEntry[],
  packageInsights: PackageInsight[],
): AnalyzeCommandPaletteItem {
  const file = findFile(largestFiles, item.packageId, item.file)
  const packageInfo = findPackage(packageInsights, item.packageId, item.packageLabel)
  return {
    key: `increment:${item.key}`,
    kind: 'increment',
    title: item.label,
    meta: `${item.category} · ${item.advice}`,
    value: `+${formatBytes(item.deltaBytes)}`,
    keywords: createKeywords([item.key, item.label, item.category, item.packageLabel, item.file, item.deltaBytes]),
    tab: file ? 'overview' : 'modules',
    file,
    moduleMeta: !file && item.moduleId && item.packageId && item.file && packageInfo
      ? {
          kind: 'module',
          nodeId: createTreemapModuleNodeId(item.packageId, item.file, item.moduleId),
          packageId: item.packageId,
          packageLabel: item.packageLabel,
          fileName: item.file,
          source: item.label,
          sourceType: item.sourceType ?? 'src',
          bytes: item.currentBytes,
          packageCount: 1,
        }
      : undefined,
  }
}

function createActionItem(action: AnalyzeActionCenterItem): AnalyzeCommandPaletteItem {
  return {
    key: `action:${action.key}`,
    kind: 'action',
    title: action.title,
    meta: action.meta,
    value: action.value,
    keywords: createKeywords([action.title, action.meta, action.value, action.kind, action.tone]),
    tab: action.tab,
    action,
    warning: action.warning,
    file: action.file,
    moduleMeta: action.moduleMeta,
  }
}

export function useAnalyzeCommandPalette(options: {
  actionItems: ComputedRef<AnalyzeActionCenterItem[]>
  budgetWarnings: ComputedRef<PackageBudgetWarning[]>
  duplicateModules: ComputedRef<DuplicateModuleEntry[]>
  incrementAttribution: ComputedRef<IncrementAttributionEntry[]>
  largestFiles: ComputedRef<LargestFileEntry[]>
  packageInsights: ComputedRef<PackageInsight[]>
}) {
  const commandItems = computed<AnalyzeCommandPaletteItem[]>(() => [
    ...options.actionItems.value.map(createActionItem),
    ...options.budgetWarnings.value.map(createBudgetItem),
    ...options.packageInsights.value.map(createPackageItem),
    ...options.largestFiles.value.map(createFileItem),
    ...options.duplicateModules.value.map(module => createDuplicateModuleItem(module, options.packageInsights.value)),
    ...options.incrementAttribution.value.map(item => createIncrementItem(item, options.largestFiles.value, options.packageInsights.value)),
  ])

  return {
    commandItems,
  }
}
