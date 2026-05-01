import type { Ref } from 'vue'
import type {
  AnalyzeTreemapFilterMode,
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
import { useRoute, useRouter } from 'vue-router'
import { treemapFilterOptions } from '../constants/view'
import { createTreemapFileNodeId, createTreemapPackageNodeId } from '../utils/treemap'
import { createSelectedFileModules } from '../utils/treemapSelection'
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

function resolveTreemapFilterMode(value: unknown): AnalyzeTreemapFilterMode {
  return treemapFilterOptions.some(option => option.value === value)
    ? value as AnalyzeTreemapFilterMode
    : 'all'
}

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
  const route = useRoute()
  const router = useRouter()

  const treemapFilterMode = computed<AnalyzeTreemapFilterMode>({
    get() {
      return resolveTreemapFilterMode(route.query.filter)
    },
    set(value) {
      const query = { ...route.query }
      if (value === 'all') {
        delete query.filter
      }
      else {
        query.filter = value
      }
      void router.replace({ query })
    },
  })
  const growthFileKeys = computed(() =>
    new Set(options.incrementAttribution.value
      .filter(item => item.packageId && item.file)
      .map(item => `${item.packageId}\u0000${item.file}`)),
  )
  const growthModuleIds = computed(() =>
    new Set(options.incrementAttribution.value
      .map(item => item.moduleId)
      .filter((id): id is string => Boolean(id))),
  )
  const duplicateModuleIds = computed(() => new Set(options.duplicateModules.value.map(module => module.id)))
  const selectedPackageId = computed(() => {
    if (selectedTreemapMeta.value?.packageId) {
      return selectedTreemapMeta.value.packageId
    }
    if (selectedLargestFile.value?.packageId) {
      return selectedLargestFile.value.packageId
    }
    if (selectedBudgetWarning.value && selectedBudgetWarning.value.scope !== 'total') {
      return selectedBudgetWarning.value.id
    }
    return null
  })
  const treemapFilterState = computed(() => ({
    mode: treemapFilterMode.value,
    selectedPackageId: selectedPackageId.value,
    growthFileKeys: growthFileKeys.value,
    growthModuleIds: growthModuleIds.value,
    duplicateModuleIds: duplicateModuleIds.value,
  }))
  const { treemapOption, treemapNodes } = useTreemapData(options.resultRef, options.resolvedTheme, treemapFilterState)
  const isTreemapEmpty = computed(() => options.resultRef.value !== null && treemapNodes.value.length === 0)
  const canUseSelectedPackageFilter = computed(() => Boolean(selectedPackageId.value))

  function matchesTreemapFilter(file: LargestFileEntry) {
    if (treemapFilterMode.value === 'all') {
      return true
    }
    if (treemapFilterMode.value === 'selected-package') {
      return selectedPackageId.value ? file.packageId === selectedPackageId.value : false
    }
    if (treemapFilterMode.value === 'growth') {
      return growthFileKeys.value.has(`${file.packageId}\u0000${file.file}`)
        || (file.modules ?? []).some(module => growthModuleIds.value.has(module.id))
    }
    if (treemapFilterMode.value === 'duplicates') {
      return (file.modules ?? []).some(module => duplicateModuleIds.value.has(module.id))
    }
    if (treemapFilterMode.value === 'node_modules') {
      return (file.modules ?? []).some(module => module.sourceType === 'node_modules')
    }
    return file.type === 'asset' || (file.modules ?? []).some(module => module.sourceType === 'src' || module.sourceType === 'workspace')
  }

  function filterLargestFiles(files: LargestFileEntry[], meta: TreemapNodeMeta | null, warning: PackageBudgetWarning | null) {
    const modeFilteredFiles = files.filter(matchesTreemapFilter)
    if (warning && warning.scope !== 'total') {
      return modeFilteredFiles.filter(file => file.packageId === warning.id)
    }
    if (!meta) {
      return modeFilteredFiles
    }
    if (meta.kind === 'package') {
      return modeFilteredFiles.filter(file => file.packageId === meta.packageId)
    }
    if (meta.kind === 'file' || meta.kind === 'asset' || meta.kind === 'module') {
      return modeFilteredFiles.filter(file => file.packageId === meta.packageId && file.file === meta.fileName)
    }
    return modeFilteredFiles
  }

  const filteredDuplicateModules = computed(() => {
    const meta = selectedTreemapMeta.value
    if (meta?.kind !== 'module') {
      return options.duplicateModules.value
    }
    return options.duplicateModules.value.filter(module => module.source === meta.source)
  })
  const filteredLargestFiles = computed(() => filterLargestFiles(options.largestFiles.value, selectedTreemapMeta.value, selectedBudgetWarning.value))
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
    selectedLargestFile.value = filterLargestFiles(options.largestFiles.value, null, warning)[0] ?? null

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

  function handleUpdateTreemapFilterMode(mode: AnalyzeTreemapFilterMode) {
    if (mode === 'selected-package' && !selectedPackageId.value) {
      return
    }
    treemapFilterMode.value = mode
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
