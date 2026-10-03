import type { Ref, ShallowRef } from 'vue'
import type {
  AnalyzeTreemapColorMode,
  AnalyzeTreemapFilterMode,
  DashboardTab,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  LargestFileEntry,
  PackageBudgetWarning,
  TreemapNodeMeta,
} from '../types'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resolveTreemapFilterMode } from '../utils/treemapFilters'

export function useAnalyzeTreemapFilters(options: {
  duplicateModules: Ref<DuplicateModuleEntry[]>
  incrementAttribution: Ref<IncrementAttributionEntry[]>
  selectedBudgetWarning: ShallowRef<PackageBudgetWarning | null>
  selectedLargestFile: ShallowRef<LargestFileEntry | null>
  selectedTreemapMeta: ShallowRef<TreemapNodeMeta | null>
  hasComparison: Ref<boolean>
}) {
  const route = useRoute()
  const router = useRouter()

  function setTreemapFilterMode(mode: AnalyzeTreemapFilterMode, tab?: DashboardTab) {
    const query = { ...route.query }
    if (tab) {
      query.tab = tab
    }
    if (mode === 'all') {
      delete query.filter
    }
    else {
      query.filter = mode
    }
    return router.replace({ query })
  }

  const treemapFilterMode = computed<AnalyzeTreemapFilterMode>({
    get() {
      return resolveTreemapFilterMode(route.query.filter)
    },
    set(value) {
      void setTreemapFilterMode(value)
    },
  })

  const treemapColorMode = computed<AnalyzeTreemapColorMode>(() => {
    const color = route.query.color
    return color === 'source' || color === 'duplicates' || color === 'delta' ? color : 'package'
  })

  function handleUpdateTreemapColorMode(mode: AnalyzeTreemapColorMode) {
    if (mode === 'delta' && !options.hasComparison.value) {
      return
    }
    const query = { ...route.query }
    if (mode === 'package') {
      delete query.color
    }
    else {
      query.color = mode
    }
    void router.replace({ query })
  }

  function handleInspectTreemapProblem(problem: 'duplicates' | 'growth') {
    if (problem === 'growth' && !options.hasComparison.value) {
      return
    }
    options.selectedTreemapMeta.value = null
    options.selectedLargestFile.value = null
    options.selectedBudgetWarning.value = null
    void router.replace({
      query: { ...route.query, filter: problem, color: problem === 'growth' ? 'delta' : 'duplicates' },
    })
  }

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
    if (options.selectedTreemapMeta.value?.packageId) {
      return options.selectedTreemapMeta.value.packageId
    }
    if (options.selectedLargestFile.value?.packageId) {
      return options.selectedLargestFile.value.packageId
    }
    if (options.selectedBudgetWarning.value && options.selectedBudgetWarning.value.scope !== 'total' && options.selectedBudgetWarning.value.scope !== 'runtime') {
      return options.selectedBudgetWarning.value.id
    }
    return null
  })
  const treemapFilterState = computed(() => ({
    mode: treemapFilterMode.value,
    selectedPackageId: treemapFilterMode.value === 'selected-package' ? selectedPackageId.value : null,
    growthFileKeys: growthFileKeys.value,
    growthModuleIds: growthModuleIds.value,
    duplicateModuleIds: duplicateModuleIds.value,
  }))
  const canUseSelectedPackageFilter = computed(() => Boolean(selectedPackageId.value))

  function handleUpdateTreemapFilterMode(mode: AnalyzeTreemapFilterMode) {
    if (mode === 'selected-package' && !selectedPackageId.value) {
      return
    }
    if (mode === 'growth' && !options.hasComparison.value) {
      return
    }
    treemapFilterMode.value = mode
  }

  return {
    canUseSelectedPackageFilter,
    duplicateModuleIds,
    growthModuleIds,
    handleInspectTreemapProblem,
    handleUpdateTreemapColorMode,
    handleUpdateTreemapFilterMode,
    selectedPackageId,
    setTreemapFilterMode,
    treemapFilterMode,
    treemapColorMode,
    treemapFilterState,
  }
}
