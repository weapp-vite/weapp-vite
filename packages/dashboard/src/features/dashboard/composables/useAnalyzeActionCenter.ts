import type { ComputedRef, Ref } from 'vue'
import type {
  AnalyzeActionCenterItem,
  AnalyzeSubpackagesResult,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  LargestFileEntry,
  PackageBudgetWarning,
  PackageInsight,
} from '../types'
import { computed } from 'vue'
import { duplicateMeasurement } from '../utils/analyzeDataModules'
import { formatBytes } from '../utils/format'
import { createTreemapModuleNodeId } from '../utils/treemap'

function formatWarningValue(warning: PackageBudgetWarning) {
  return warning.status === 'unknown' ? '未知' : `${(warning.ratio * 100).toFixed(1)}%`
}

function findFile(files: LargestFileEntry[], packageId: string | undefined, fileName: string | undefined) {
  if (!packageId || !fileName) {
    return undefined
  }
  return files.find(file => file.packageId === packageId && file.file === fileName)
}

function createModuleAction(
  module: DuplicateModuleEntry,
  packageInsights: PackageInsight[],
  estimatedBytes: number | null,
): AnalyzeActionCenterItem {
  const firstPackage = module.packages[0]
  const fileName = firstPackage?.files[0] ?? ''
  const packageInfo = packageInsights.find(pkg => pkg.id === firstPackage?.packageId)
  const packageLabel = packageInfo?.label ?? firstPackage?.packageLabel ?? ''

  return {
    key: `duplicate:${module.id}`,
    kind: 'duplicate',
    title: `核对跨包重复 ${module.source}`,
    targetLabel: module.source,
    meta: `${module.packageCount} 个包复用 · ${module.advice}`,
    value: estimatedBytes === null ? '估算重复 未知' : `估算重复 ${formatBytes(estimatedBytes)}`,
    measurementUnknown: estimatedBytes === null,
    tone: module.estimatedSavingBytes > 1024 ? 'warning' : 'info',
    tab: 'modules',
    priority: 72 + Math.min(module.estimatedSavingBytes / 1024, 18),
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

function createIncrementAction(
  item: IncrementAttributionEntry,
  largestFiles: LargestFileEntry[],
  packageInsights: PackageInsight[],
): AnalyzeActionCenterItem {
  const file = findFile(largestFiles, item.packageId, item.file)
  const packageInfo = packageInsights.find(pkg => pkg.id === item.packageId)
  const moduleMeta = !file && item.moduleId && item.packageId && item.file && packageInfo
    ? {
        kind: 'module' as const,
        nodeId: createTreemapModuleNodeId(item.packageId, item.file, item.moduleId),
        packageId: item.packageId,
        packageLabel: item.packageLabel,
        fileName: item.file,
        source: item.label,
        sourceType: item.sourceType ?? 'src',
        bytes: item.currentBytes,
        packageCount: 1,
      }
    : undefined

  return {
    key: `increment:${item.key}`,
    kind: 'increment',
    title: `定位增长 ${item.label}`,
    targetLabel: item.label,
    meta: `${item.category} · ${item.advice}`,
    value: `+${formatBytes(item.deltaBytes)}`,
    tone: 'info',
    tab: file ? 'files' : 'modules',
    priority: 80 + Math.min(item.deltaBytes / 1024, 15),
    file,
    moduleMeta,
  }
}

export function useAnalyzeActionCenter(options: {
  resultRef: Ref<AnalyzeSubpackagesResult | null>
  budgetWarnings: ComputedRef<PackageBudgetWarning[]>
  incrementAttribution: ComputedRef<IncrementAttributionEntry[]>
  duplicateModules: ComputedRef<DuplicateModuleEntry[]>
  largestFiles: ComputedRef<LargestFileEntry[]>
  packageInsights: ComputedRef<PackageInsight[]>
}) {
  const actionItems = computed<AnalyzeActionCenterItem[]>(() => {
    const items: AnalyzeActionCenterItem[] = []

    for (const warning of options.budgetWarnings.value) {
      items.push({
        key: `budget:${warning.id}`,
        kind: 'budget',
        title: `处理 ${warning.label} 预算`,
        targetLabel: warning.label,
        meta: warning.status === 'unknown' ? '体积或归因不完整，无法验收预算' : `${warning.status === 'critical' ? '已超预算' : '接近预算'} · 当前 ${formatBytes(warning.currentBytes)} / ${formatBytes(warning.limitBytes)}`,
        value: formatWarningValue(warning),
        measurementUnknown: warning.status === 'unknown',
        tone: warning.status === 'critical' ? 'critical' : 'warning',
        tab: 'files',
        priority: warning.status === 'critical' ? 100 + warning.ratio : 90 + warning.ratio,
        warning,
      })
    }

    for (const item of options.incrementAttribution.value.slice(0, 12)) {
      items.push(createIncrementAction(item, options.largestFiles.value, options.packageInsights.value))
    }

    const result = options.resultRef.value
    if (result) {
      let duplicateCount = 0
      for (const module of options.duplicateModules.value) {
        const estimatedBytes = duplicateMeasurement(result, module.id, module.estimatedSavingBytes)
        if (estimatedBytes !== null && estimatedBytes <= 0) {
          continue
        }
        items.push(createModuleAction(module, options.packageInsights.value, estimatedBytes))
        if (++duplicateCount === 12) {
          break
        }
      }
    }

    return items
      .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
  })

  return {
    actionItems,
  }
}
