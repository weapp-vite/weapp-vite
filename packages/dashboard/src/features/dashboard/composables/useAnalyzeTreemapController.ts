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
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, shallowRef } from 'vue'
import { createTreemapFileNodeId, createTreemapModuleNodeId, createTreemapPackageNodeId } from '../utils/treemap'
import { filterLargestFilesByTreemapState } from '../utils/treemapFilters'
import { findTreemapNodePath } from '../utils/treemapNavigation'
import { createSelectedFileModules } from '../utils/treemapSelection'
import { useAnalyzeTreemapFilters } from './useAnalyzeTreemapFilters'
import { useTreemapChartInstance } from './useTreemapChartInstance'
import { useTreemapData } from './useTreemapData'
import { useTreemapNavigation } from './useTreemapNavigation'
import 'echarts/theme/dark.js'

echarts.use([
  TreemapChart,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
  LabelLayout,
])

export function useAnalyzeTreemapController(options: {
  activeTab: Ref<DashboardTab>
  resultRef: Ref<Parameters<typeof useTreemapData>[0]['value']>
  comparisonResultRef: Ref<Parameters<typeof useTreemapData>[0]['value']>
  resolvedTheme: Ref<ResolvedTheme>
  largestFiles: Ref<LargestFileEntry[]>
  duplicateModules: Ref<DuplicateModuleEntry[]>
  incrementAttribution: Ref<IncrementAttributionEntry[]>
  packageInsights: Ref<PackageInsight[]>
}) {
  const selectedTreemapMeta = shallowRef<TreemapNodeMeta | null>(null)
  const selectedLargestFile = shallowRef<LargestFileEntry | null>(null)
  const selectedBudgetWarning = shallowRef<PackageBudgetWarning | null>(null)
  const hasTreemapComparison = computed(() => options.comparisonResultRef.value !== null)
  const {
    canUseSelectedPackageFilter,
    duplicateModuleIds,
    growthModuleIds,
    handleInspectTreemapProblem,
    handleUpdateTreemapColorMode,
    handleUpdateTreemapFilterMode,
    setTreemapFilterMode,
    treemapColorMode,
    treemapFilterMode,
    treemapFilterState,
  } = useAnalyzeTreemapFilters({
    duplicateModules: options.duplicateModules,
    incrementAttribution: options.incrementAttribution,
    selectedBudgetWarning,
    selectedLargestFile,
    selectedTreemapMeta,
    hasComparison: hasTreemapComparison,
  })
  const { treemapOption, treemapNodes, treemapLegend, treemapColorDescription } = useTreemapData(
    options.resultRef,
    options.resolvedTheme,
    treemapFilterState,
    { mode: treemapColorMode, comparisonResult: options.comparisonResultRef },
  )
  const isTreemapEmpty = computed(() => options.resultRef.value !== null && treemapNodes.value.length === 0)
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
    const meta = selectedTreemapMeta.value
    return meta && (meta.kind === 'module' || meta.kind === 'asset')
      ? createTreemapFileNodeId(meta.packageId, meta.fileName)
      : meta?.nodeId ?? null
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
  const filteredDuplicateModules = computed(() => {
    const meta = selectedTreemapMeta.value
    if (meta?.kind === 'module') {
      return options.duplicateModules.value.filter(module =>
        createTreemapModuleNodeId(meta.packageId, meta.fileName, module.id) === meta.nodeId,
      )
    }
    const packageId = treemapFilterState.value.selectedPackageId
    return packageId
      ? options.duplicateModules.value.filter(module => module.packages.some(pkg => pkg.packageId === packageId))
      : options.duplicateModules.value
  })
  const duplicateModuleScopeLabel = computed(() => {
    const meta = selectedTreemapMeta.value
    if (meta?.kind === 'module') {
      return `模块范围：${meta.source}`
    }
    const packageId = treemapFilterState.value.selectedPackageId
    const pkg = options.packageInsights.value.find(pkg => pkg.id === packageId)
    return pkg ? `包体范围：${pkg.label}` : null
  })
  const selectedFileModules = computed(() => createSelectedFileModules({
    modules: selectedFileEntry.value?.modules ?? [],
    mode: treemapFilterMode.value,
    growthModuleIds: growthModuleIds.value,
    duplicateModuleIds: duplicateModuleIds.value,
    duplicateModules: options.duplicateModules.value,
  }))

  const navigation = useTreemapNavigation({
    activeTab: options.activeTab,
    nodes: treemapNodes,
    largestFiles: options.largestFiles,
    selectedMeta: selectedTreemapMeta,
    selectedFile: selectedLargestFile,
    selectedWarning: selectedBudgetWarning,
    filterMode: treemapFilterMode,
    setFilterMode: setTreemapFilterMode,
  })
  function handleChartClick(params: unknown) {
    if (!params || typeof params !== 'object' || !('data' in params)) {
      return
    }
    const data = params.data
    if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string') {
      return
    }
    const meta = findTreemapNodePath(treemapNodes.value, data.id).at(-1)?.meta
    if (meta) {
      navigation.handleSelectTreemapNode(meta)
    }
  }

  const { bindChartRef, destroyChart, ensureChart, handleResize } = useTreemapChartInstance({
    activeTab: options.activeTab,
    resolvedTheme: options.resolvedTheme,
    treemapOption,
    handleChartClick,
    focusNodeId: selectedTreemapFocusNodeId,
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
    const globalBudget = warning.scope === 'total' || warning.scope === 'runtime'
    void setTreemapFilterMode(globalBudget ? 'all' : 'selected-package', 'files')
    selectedBudgetWarning.value = warning
    selectedLargestFile.value = filterLargestFilesByTreemapState({
      files: options.largestFiles.value,
      filterState: { ...treemapFilterState.value, mode: 'all', selectedPackageId: null },
      meta: null,
      warning,
    })[0] ?? null

    if (!selectedLargestFile.value || globalBudget) {
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

  function selectPackageInsight(item: PackageInsight, tab: 'packages' | 'modules') {
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
    void setTreemapFilterMode('selected-package', tab)
  }

  function handleSelectPackageInsight(item: PackageInsight) {
    selectPackageInsight(item, 'packages')
  }

  function handleInspectPackageDuplicates(packageId: string) {
    const item = options.packageInsights.value.find(pkg => pkg.id === packageId)
    if (item) {
      selectPackageInsight(item, 'modules')
    }
  }

  function resetTreemapSelection() {
    selectedTreemapMeta.value = null
    selectedLargestFile.value = null
    selectedBudgetWarning.value = null
  }

  return {
    ...navigation,
    activeLargestFileKey,
    bindChartRef,
    canUseSelectedPackageFilter,
    destroyChart,
    duplicateModuleScopeLabel,
    ensureChart,
    filteredDuplicateModules,
    filteredLargestFiles,
    handleResize,
    handleInspectPackageDuplicates,
    handleInspectTreemapProblem,
    handleSelectBudgetWarning,
    handleSelectLargestFile,
    handleSelectPackageInsight,
    handleUpdateTreemapColorMode,
    hasTreemapComparison,
    handleUpdateTreemapFilterMode,
    isTreemapEmpty,
    resetTreemapSelection,
    selectedBudgetWarning,
    selectedFileModules,
    selectedLargestFile,
    selectedTreemapMeta,
    setTreemapFilterMode,
    treemapColorMode,
    treemapColorDescription,
    treemapLegend,
    treemapNodes,
    treemapFilterMode,
    visibleLargestFiles,
  }
}
