import type {
  DashboardDetailItem,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  IncrementAttributionSummary,
  LargestFileEntry,
  ModuleSourceSummary,
  ModuleSourceType,
} from '../types'
import { computed, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBuildOrigin, formatBytes } from '../utils/format'
import { createModuleOptimizationPlanSummary } from '../utils/moduleOptimizationPlan'
import { useDashboardActionStatus } from './useDashboardActionStatus'

export type DuplicateModuleSourceFilter = 'all' | ModuleSourceType
export type DuplicateModuleSortMode = 'saving' | 'packages' | 'size' | 'source'

interface DuplicateModuleItem extends DashboardDetailItem {
  key: string
  packages: DuplicateModuleEntry['packages']
}

interface ListItemRow extends DashboardDetailItem {
  key: string
}

interface DuplicateModulesPanelProps {
  duplicateModules: DuplicateModuleEntry[]
  moduleSourceSummary: ModuleSourceSummary[]
  incrementAttribution: IncrementAttributionEntry[]
  incrementSummary: IncrementAttributionSummary[]
  visibleLargestFiles: LargestFileEntry[]
}

function createDuplicateModuleItem(module: DuplicateModuleEntry): DashboardDetailItem {
  return {
    title: module.source,
    meta: `${module.packageCount} 个包 · 单份 ${formatBytes(module.bytes)} · 可节省 ${formatBytes(module.estimatedSavingBytes)} · ${module.advice}`,
  }
}

function createModuleSourceItem(item: ModuleSourceSummary): DashboardDetailItem {
  return {
    title: item.sourceCategory,
    meta: `${item.count} 个模块`,
    value: formatBytes(item.bytes),
  }
}

function createIncrementItem(item: IncrementAttributionEntry): DashboardDetailItem {
  return {
    title: item.label,
    meta: `${item.category} · ${item.packageLabel} · ${item.advice}`,
    value: `+${formatBytes(item.deltaBytes)}`,
  }
}

function createIncrementSummaryItem(item: IncrementAttributionSummary): DashboardDetailItem {
  return {
    title: item.category,
    meta: `${item.count} 项增长`,
    value: `+${formatBytes(item.deltaBytes)}`,
  }
}

function createLargestFileSampleItem(file: LargestFileEntry): DashboardDetailItem {
  return {
    title: file.file,
    meta: `${file.packageLabel} · ${formatBuildOrigin(file.from)} · ${file.moduleCount} 模块`,
  }
}

function escapeMarkdownCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function sortDuplicateModules(modules: DuplicateModuleEntry[], mode: DuplicateModuleSortMode) {
  return [...modules].sort((a, b) => {
    if (mode === 'packages') {
      return b.packageCount - a.packageCount || b.estimatedSavingBytes - a.estimatedSavingBytes || a.source.localeCompare(b.source)
    }
    if (mode === 'size') {
      return b.bytes - a.bytes || b.packageCount - a.packageCount || a.source.localeCompare(b.source)
    }
    if (mode === 'source') {
      return a.source.localeCompare(b.source)
    }
    return b.estimatedSavingBytes - a.estimatedSavingBytes || b.packageCount - a.packageCount || a.source.localeCompare(b.source)
  })
}

export function useDuplicateModulesPanel(props: DuplicateModulesPanelProps) {
  const duplicateQuery = ref('')
  const duplicateSourceFilter = ref<DuplicateModuleSourceFilter>('all')
  const duplicateSortMode = ref<DuplicateModuleSortMode>('saving')
  const { actionStatus, setActionStatus } = useDashboardActionStatus()

  const duplicateSourceOptions = computed(() => {
    const sourceSet = new Set<ModuleSourceType>()
    for (const module of props.duplicateModules) {
      sourceSet.add(module.sourceType)
    }
    return [...sourceSet].sort((a, b) => a.localeCompare(b))
  })

  const filteredDuplicateModules = computed(() => {
    const keyword = duplicateQuery.value.trim().toLowerCase()
    const modules = props.duplicateModules.filter((module) => {
      if (duplicateSourceFilter.value !== 'all' && module.sourceType !== duplicateSourceFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        module.id,
        module.source,
        module.sourceType,
        module.advice,
        module.packages.map(pkg => pkg.packageLabel).join(' '),
        module.packages.flatMap(pkg => pkg.files).join(' '),
      ].some(value => value.toLowerCase().includes(keyword))
    })
    return sortDuplicateModules(modules, duplicateSortMode.value)
  })

  const duplicateModuleItems = computed<DuplicateModuleItem[]>(() => filteredDuplicateModules.value.map(module => ({
    key: module.id,
    packages: module.packages,
    ...createDuplicateModuleItem(module),
  })))

  const moduleSourceItems = computed<ListItemRow[]>(() => props.moduleSourceSummary.map(item => ({
    key: `${item.sourceType}:${item.sourceCategory}`,
    ...createModuleSourceItem(item),
  })))

  const incrementItems = computed<ListItemRow[]>(() => props.incrementAttribution.slice(0, 8).map(item => ({
    key: item.key,
    ...createIncrementItem(item),
  })))

  const incrementSummaryItems = computed<ListItemRow[]>(() => props.incrementSummary.slice(0, 6).map(item => ({
    key: item.category,
    ...createIncrementSummaryItem(item),
  })))

  const largestFileSampleItems = computed<ListItemRow[]>(() => props.visibleLargestFiles.slice(0, 6).map(file => ({
    key: `${file.packageId}:${file.file}`,
    ...createLargestFileSampleItem(file),
  })))

  const moduleOptimizationPlan = computed(() => createModuleOptimizationPlanSummary({
    duplicateModules: props.duplicateModules,
    incrementAttribution: props.incrementAttribution,
    largestFiles: props.visibleLargestFiles,
  }))

  const duplicateModulesReportText = computed(() => [
    '# dashboard 重复模块',
    '',
    `模块数量：${filteredDuplicateModules.value.length} / ${props.duplicateModules.length}`,
    '',
    '| 模块 | 来源 | 包数量 | 单份体积 | 可节省 | 建议 | 涉及包 |',
    '| --- | --- | ---: | ---: | ---: | --- | --- |',
    ...filteredDuplicateModules.value.map(module => [
      module.source,
      module.sourceType,
      String(module.packageCount),
      formatBytes(module.bytes),
      formatBytes(module.estimatedSavingBytes),
      module.advice,
      module.packages.map(pkg => pkg.packageLabel).join(', '),
    ].map(escapeMarkdownCell).join(' | ')).map(row => `| ${row} |`),
    '',
  ].join('\n'))

  async function copyDuplicateModulesReport() {
    try {
      await copyText(duplicateModulesReportText.value)
      setActionStatus('已复制')
    }
    catch {
      setActionStatus('复制失败')
    }
  }

  function exportDuplicateModulesJson() {
    const blob = new Blob([`${JSON.stringify(filteredDuplicateModules.value, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'weapp-vite-dashboard-duplicate-modules.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setActionStatus('已导出')
  }

  return {
    actionStatus,
    copyDuplicateModulesReport,
    duplicateModuleItems,
    duplicateQuery,
    duplicateSortMode,
    duplicateSourceFilter,
    duplicateSourceOptions,
    exportDuplicateModulesJson,
    incrementItems,
    incrementSummaryItems,
    largestFileSampleItems,
    moduleOptimizationPlan,
    moduleSourceItems,
  }
}
