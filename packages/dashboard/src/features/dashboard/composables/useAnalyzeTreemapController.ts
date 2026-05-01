import type { Ref } from 'vue'
import type {
  DashboardTab,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  LargestFileEntry,
  PackageBudgetWarning,
  PackageInsight,
  ResolvedTheme,
  TreemapNodeMeta,
} from '../types'
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, shallowRef } from 'vue'
import { createTreemapFileNodeId, createTreemapPackageNodeId } from '../utils/treemap'
import { filterLargestFilesByTreemapState } from '../utils/treemapFilters'
import { createSelectedFileModules } from '../utils/treemapSelection'
import { useAnalyzeTreemapFilters } from './useAnalyzeTreemapFilters'
import { useTreemapChartInstance } from './useTreemapChartInstance'
import { useTreemapData } from './useTreemapData'
import 'echarts/theme/dark.js'

echarts.use([
  TreemapChart,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export function useAnalyzeTreemapController(options: {
  activeTab: Ref<DashboardTab>
  resultRef: Ref<Parameters<typeof useTreemapData>[0]['value']>
  resolvedTheme: Ref<ResolvedTheme>
  largestFiles: Ref<LargestFileEntry[]>
  duplicateModules: Ref<DuplicateModuleEntry[]>
  incrementAttribution: Ref<IncrementAttributionEntry[]>
  packageInsights: Ref<PackageInsight[]>
}) {
  const selectedTreemapMeta = shallowRef<TreemapNodeMeta | null>(null)
  const selectedLargestFile = shallowRef<LargestFileEntry | null>(null)
  const selectedBudgetWarning = shallowRef<PackageBudgetWarning | null>(null)
  const {
    canUseSelectedPackageFilter,
    duplicateModuleIds,
    growthModuleIds,
    handleUpdateTreemapFilterMode,
    treemapFilterMode,
    treemapFilterState,
  } = useAnalyzeTreemapFilters({
    duplicateModules: options.duplicateModules,
    incrementAttribution: options.incrementAttribution,
    selectedBudgetWarning,
    selectedLargestFile,
    selectedTreemapMeta,
  })
  const { treemapOption, treemapNodes } = useTreemapData(options.resultRef, options.resolvedTheme, treemapFilterState)
  const isTreemapEmpty = computed(() => options.resultRef.value !== null && treemapNodes.value.length === 0)

  const filteredDuplicateModules = computed(() => {
    const meta = selectedTreemapMeta.value
    if (meta?.kind !== 'module') {
      return options.duplicateModules.value
    }
    return options.duplicateModules.value.filter(module => module.source === meta.source)
  })
  const filteredLargestFiles = computed(() => filterLargestFilesByTreemapState({
    files: options.largestFiles.value,
    filterState: treemapFilterState.value,
    meta: selectedTreemapMeta.value,
    warning: selectedBudgetWarning.value,
  }))
  const visibleLargestFiles = computed(() => filteredLargestFiles.value.slice(0, 10))
  const activeLargestFileKey = computed(() => selectedLargestFile.value
    ? `${selectedLargestFile.value.packageId}:${selectedLargestFile.value.file}`
    : null)
  const selectedTreemapFocusNodeId = computed(() => {
    if (selectedLargestFile.value) {
      return createTreemapFileNodeId(selectedLargestFile.value.packageId, selectedLargestFile.value.file)
    }
    return selectedTreemapMeta.value?.nodeId ?? null
  })
  const selectedFileEntry = computed(() => {
    if (selectedLargestFile.value) {
      return selectedLargestFile.value
    }
    const meta = selectedTreemapMeta.value
    if (!meta || meta.kind === 'package') {
      return null
    }
    return options.largestFiles.value.find(file => file.packageId === meta.packageId && file.file === meta.fileName) ?? null
  })
  const selectedFileModules = computed(() => createSelectedFileModules({
    modules: selectedFileEntry.value?.modules ?? [],
    mode: treemapFilterMode.value,
    growthModuleIds: growthModuleIds.value,
    duplicateModuleIds: duplicateModuleIds.value,
    duplicateModules: options.duplicateModules.value,
  }))

  function handleChartClick(params: unknown) {
    selectedTreemapMeta.value = (params as { data?: { meta?: TreemapNodeMeta } | null }).data?.meta ?? null
    selectedLargestFile.value = null
    selectedBudgetWarning.value = null
  }

  const {
    bindChartRef,
    destroyChart,
    ensureChart,
    focusTreemapNode,
    handleResize,
    resetTreemapFocus,
  } = useTreemapChartInstance({
    activeTab: options.activeTab,
    resolvedTheme: options.resolvedTheme,
    treemapOption,
    handleChartClick,
  })

  function handleSelectLargestFile(file: LargestFileEntry) {
    selectedLargestFile.value = file
    selectedTreemapMeta.value = {
      kind: 'file',
      nodeId: createTreemapFileNodeId(file.packageId, file.file),
      packageId: file.packageId,
      packageLabel: file.packageLabel,
      fileName: file.file,
      from: file.from,
      childCount: file.moduleCount,
      type: file.type,
      bytes: file.size,
    }
  }

  function handleSelectBudgetWarning(warning: PackageBudgetWarning) {
    selectedBudgetWarning.value = warning
    selectedLargestFile.value = filterLargestFilesByTreemapState({
      files: options.largestFiles.value,
      filterState: treemapFilterState.value,
      meta: null,
      warning,
    })[0] ?? null

    if (!selectedLargestFile.value || warning.scope === 'total') {
      selectedTreemapMeta.value = null
      return
    }

    const packageInfo = options.packageInsights.value.find(pkg => pkg.id === warning.id)
    selectedTreemapMeta.value = packageInfo
      ? {
          kind: 'package',
          nodeId: createTreemapPackageNodeId(packageInfo.id),
          packageId: packageInfo.id,
          packageLabel: packageInfo.label,
          packageType: packageInfo.type,
          fileCount: packageInfo.fileCount,
          totalBytes: packageInfo.totalBytes,
        }
      : null
  }

  function handleSelectPackageInsight(item: PackageInsight) {
    options.activeTab.value = 'packages'
    selectedTreemapMeta.value = {
      kind: 'package',
      nodeId: createTreemapPackageNodeId(item.id),
      packageId: item.id,
      packageLabel: item.label,
      packageType: item.type,
      fileCount: item.fileCount,
      totalBytes: item.totalBytes,
    }
    selectedLargestFile.value = null
    selectedBudgetWarning.value = null
    treemapFilterMode.value = 'selected-package'
  }

  function handleFocusTreemapSelection() {
    if (!selectedTreemapFocusNodeId.value) {
      return
    }
    focusTreemapNode(selectedTreemapFocusNodeId.value)
  }

  function handleResetTreemapFocus() {
    resetTreemapFocus()
  }

  function resetTreemapSelection() {
    selectedTreemapMeta.value = null
    selectedLargestFile.value = null
    selectedBudgetWarning.value = null
  }

  return {
    activeLargestFileKey,
    bindChartRef,
    canUseSelectedPackageFilter,
    destroyChart,
    ensureChart,
    filteredDuplicateModules,
    filteredLargestFiles,
    handleFocusTreemapSelection,
    handleResetTreemapFocus,
    handleResize,
    handleSelectBudgetWarning,
    handleSelectLargestFile,
    handleSelectPackageInsight,
    handleUpdateTreemapFilterMode,
    isTreemapEmpty,
    resetTreemapSelection,
    selectedBudgetWarning,
    selectedFileModules,
    selectedLargestFile,
    selectedTreemapFocusNodeId,
    selectedTreemapMeta,
    treemapFilterMode,
    visibleLargestFiles,
  }
}
