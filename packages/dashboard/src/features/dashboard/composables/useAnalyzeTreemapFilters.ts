import type { Ref, ShallowRef } from 'vue'
import type {
  AnalyzeTreemapFilterMode,
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
}) {
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
    if (options.selectedTreemapMeta.value?.packageId) {
      return options.selectedTreemapMeta.value.packageId
    }
    if (options.selectedLargestFile.value?.packageId) {
      return options.selectedLargestFile.value.packageId
    }
    if (options.selectedBudgetWarning.value && options.selectedBudgetWarning.value.scope !== 'total') {
      return options.selectedBudgetWarning.value.id
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
  const canUseSelectedPackageFilter = computed(() => Boolean(selectedPackageId.value))

  function handleUpdateTreemapFilterMode(mode: AnalyzeTreemapFilterMode) {
    if (mode === 'selected-package' && !selectedPackageId.value) {
      return
    }
    treemapFilterMode.value = mode
  }

  return {
    canUseSelectedPackageFilter,
    duplicateModuleIds,
    growthModuleIds,
    handleUpdateTreemapFilterMode,
    selectedPackageId,
    treemapFilterMode,
    treemapFilterState,
  }
}
