import type { Ref, ShallowRef } from 'vue'
import type { AnalyzeTreemapFilterMode, DashboardTab, LargestFileEntry, PackageBudgetWarning, TreemapNode, TreemapNodeMeta } from '../types'
import { computed, watch } from 'vue'
import { findTreemapNodePath } from '../utils/treemapNavigation'

export function useTreemapNavigation(options: {
  activeTab: Ref<DashboardTab>
  nodes: Ref<TreemapNode[]>
  selectedMeta: ShallowRef<TreemapNodeMeta | null>
  selectedFile: ShallowRef<LargestFileEntry | null>
  selectedWarning: ShallowRef<PackageBudgetWarning | null>
  filterMode: Ref<AnalyzeTreemapFilterMode>
  setFilterMode: (mode: AnalyzeTreemapFilterMode, tab?: DashboardTab) => Promise<unknown>
}) {
  let selectionRequest = 0
  const treemapPath = computed(() => options.selectedMeta.value
    ? findTreemapNodePath(options.nodes.value, options.selectedMeta.value.nodeId)
    : [])

  async function handleSelectTreemapNode(meta: TreemapNodeMeta) {
    const request = ++selectionRequest
    if (findTreemapNodePath(options.nodes.value, meta.nodeId).length === 0) {
      await options.setFilterMode('all')
    }
    const node = findTreemapNodePath(options.nodes.value, meta.nodeId).at(-1)
    if (request !== selectionRequest || !node) {
      return
    }
    options.selectedMeta.value = node.meta
    options.selectedFile.value = null
    options.selectedWarning.value = null
  }

  async function handleResetTreemapFocus() {
    const request = ++selectionRequest
    if (options.filterMode.value === 'selected-package') {
      await options.setFilterMode('all')
    }
    if (request !== selectionRequest) {
      return
    }
    options.selectedMeta.value = null
    options.selectedFile.value = null
    options.selectedWarning.value = null
  }

  watch([options.nodes, options.activeTab], ([nodes]) => {
    const selected = options.selectedMeta.value
    if (options.activeTab.value !== 'treemap' || !selected) {
      return
    }
    const path = findTreemapNodePath(nodes, selected.nodeId)
    const visible = path.at(-1)
      ?? nodes.find(node => node.meta.packageId === selected.packageId)
    options.selectedMeta.value = visible?.meta ?? null
    if (!visible && options.filterMode.value === 'selected-package') {
      void options.setFilterMode('all')
    }
    options.selectedFile.value = null
    options.selectedWarning.value = null
  })

  return { treemapPath, handleSelectTreemapNode, handleResetTreemapFocus }
}
