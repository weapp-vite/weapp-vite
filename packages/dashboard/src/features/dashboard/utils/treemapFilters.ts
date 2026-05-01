import type { AnalyzeTreemapFilterMode, LargestFileEntry, PackageBudgetWarning, TreemapNodeMeta } from '../types'
import { treemapFilterOptions } from '../constants/view'

export interface TreemapFilterMatchState {
  mode: AnalyzeTreemapFilterMode
  selectedPackageId: string | null
  growthFileKeys: Set<string>
  growthModuleIds: Set<string>
  duplicateModuleIds: Set<string>
}

export function resolveTreemapFilterMode(value: unknown): AnalyzeTreemapFilterMode {
  return treemapFilterOptions.some(option => option.value === value)
    ? value as AnalyzeTreemapFilterMode
    : 'all'
}

export function matchesTreemapFilter(file: LargestFileEntry, state: TreemapFilterMatchState) {
  if (state.mode === 'all') {
    return true
  }
  if (state.mode === 'selected-package') {
    return state.selectedPackageId ? file.packageId === state.selectedPackageId : false
  }
  if (state.mode === 'growth') {
    return state.growthFileKeys.has(`${file.packageId}\u0000${file.file}`)
      || (file.modules ?? []).some(module => state.growthModuleIds.has(module.id))
  }
  if (state.mode === 'duplicates') {
    return (file.modules ?? []).some(module => state.duplicateModuleIds.has(module.id))
  }
  if (state.mode === 'node_modules') {
    return (file.modules ?? []).some(module => module.sourceType === 'node_modules')
  }
  return file.type === 'asset'
    || (file.modules ?? []).some(module => module.sourceType === 'src' || module.sourceType === 'workspace')
}

export function filterLargestFilesByTreemapState(options: {
  files: LargestFileEntry[]
  filterState: TreemapFilterMatchState
  meta: TreemapNodeMeta | null
  warning: PackageBudgetWarning | null
}) {
  const modeFilteredFiles = options.files.filter(file => matchesTreemapFilter(file, options.filterState))
  const { meta, warning } = options
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
