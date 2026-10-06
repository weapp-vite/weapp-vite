import type { Ref } from 'vue'
import type { DashboardInvestigationTarget } from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult } from '../types'
import { computed, shallowRef } from 'vue'
import { createInspectionIndex, filterInspectionNodes, inspectionTargetKey, resolveInspectionTarget } from '../utils/objectInspection'

/** 维护显式浏览条件；目标始终由父组件拥有，点击对象不改集合。 */
export function useObjectInspection(options: {
  result: Ref<AnalyzeSubpackagesResult>
  target: Ref<DashboardInvestigationTarget | null>
}) {
  const packageFilter = shallowRef('')
  const packageQuery = shallowRef('')
  const artifactQuery = shallowRef('')
  const moduleQuery = shallowRef('')
  const index = computed(() => createInspectionIndex(options.result.value))
  const selected = computed(() => resolveInspectionTarget(index.value, options.target.value))
  const targetMissing = computed(() => !!options.target.value && !index.value.nodes.has(inspectionTargetKey(options.target.value)))
  const packages = computed(() => filterInspectionNodes(index.value.packages, packageQuery.value, packageFilter.value))
  const artifacts = computed(() => filterInspectionNodes(index.value.artifacts, artifactQuery.value, packageFilter.value))
  const modules = computed(() => filterInspectionNodes(index.value.modules, moduleQuery.value, packageFilter.value))
  const selectedArtifact = computed(() => selected.value?.artifactKey
    ? index.value.nodes.get(selected.value.artifactKey) ?? null
    : null)

  return { index, selected, selectedArtifact, targetMissing, packageFilter, packageQuery, artifactQuery, moduleQuery, packages, artifacts, modules }
}
