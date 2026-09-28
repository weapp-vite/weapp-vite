import type { Ref, ShallowRef } from 'vue'
import type { AnalyzeTreemapFilterMode, DashboardTab, LargestFileEntry, PackageBudgetWarning, TreemapNode, TreemapNodeMeta } from '../types'
import { computed, shallowRef, watch } from 'vue'
import { createTreemapModuleNodeId } from '../utils/treemap'
import { findTreemapNodePath } from '../utils/treemapNavigation'

export function useTreemapNavigation(options: {
  activeTab: Ref<DashboardTab>
  nodes: Ref<TreemapNode[]>
  largestFiles: Ref<LargestFileEntry[]>
  selectedMeta: ShallowRef<TreemapNodeMeta | null>
  selectedFile: ShallowRef<LargestFileEntry | null>
  selectedWarning: ShallowRef<PackageBudgetWarning | null>
  filterMode: Ref<AnalyzeTreemapFilterMode>
  setFilterMode: (mode: AnalyzeTreemapFilterMode) => Promise<unknown>
}) {
  const sourceTarget = shallowRef<{ fileKey: string, path: string } | null>(null)
  let selectionRequest = 0
  const treemapPath = computed(() => options.selectedMeta.value
    ? findTreemapNodePath(options.nodes.value, options.selectedMeta.value.nodeId)
    : [])
  const treemapSourcePath = computed(() => {
    const file = options.selectedFile.value
    return file && `${file.packageId}:${file.file}` === sourceTarget.value?.fileKey ? sourceTarget.value.path : null
  })

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
    sourceTarget.value = null
  }

  function handleOpenTreemapSource(meta: TreemapNodeMeta) {
    selectionRequest++
    if (meta.kind === 'package') {
      return
    }
    const file = options.largestFiles.value.find(file => file.packageId === meta.packageId && file.file === meta.fileName)
    if (!file) {
      return
    }
    const module = meta.kind === 'module'
      ? file.modules?.find(module => createTreemapModuleNodeId(file.packageId, file.file, module.id) === meta.nodeId)
      : null
    const source = meta.kind === 'module'
      ? module?.sourceType !== 'node_modules' ? module?.source : undefined
      : file.source ?? file.modules?.find(module => module.sourceType !== 'node_modules' && module.source)?.source
    if (!source) {
      return
    }
    sourceTarget.value = { fileKey: `${file.packageId}:${file.file}`, path: source.split('?', 1)[0]! }
    options.selectedMeta.value = meta
    options.selectedFile.value = file
    options.selectedWarning.value = null
    options.activeTab.value = 'source'
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

  return { treemapPath, treemapSourcePath, handleSelectTreemapNode, handleResetTreemapFocus, handleOpenTreemapSource }
}
