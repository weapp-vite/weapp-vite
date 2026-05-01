import type {
  AnalyzeTreemapFilterMode,
  DuplicateModuleEntry,
  ModuleInFile,
  SelectedFileModuleDetail,
} from '../types'

export function createSelectedFileModules(options: {
  modules: ModuleInFile[]
  mode: AnalyzeTreemapFilterMode
  growthModuleIds: Set<string>
  duplicateModuleIds: Set<string>
  duplicateModules: DuplicateModuleEntry[]
}): SelectedFileModuleDetail[] {
  const duplicateModuleMap = new Map(options.duplicateModules.map(module => [module.id, module]))

  return options.modules
    .filter((module) => {
      if (options.mode === 'growth') {
        return options.growthModuleIds.has(module.id)
      }
      if (options.mode === 'duplicates') {
        return options.duplicateModuleIds.has(module.id)
      }
      if (options.mode === 'node_modules') {
        return module.sourceType === 'node_modules'
      }
      if (options.mode === 'source') {
        return module.sourceType === 'src' || module.sourceType === 'workspace'
      }
      return true
    })
    .map((module) => {
      const duplicate = duplicateModuleMap.get(module.id)
      const bytes = module.bytes ?? module.originalBytes ?? 0
      return {
        key: module.id,
        source: module.source,
        sourceType: module.sourceType,
        bytes,
        originalBytes: module.originalBytes,
        duplicatePackageCount: duplicate?.packageCount ?? 1,
        estimatedSavingBytes: duplicate?.estimatedSavingBytes ?? 0,
      }
    })
    .sort((a, b) =>
      b.estimatedSavingBytes - a.estimatedSavingBytes
      || b.bytes - a.bytes
      || a.source.localeCompare(b.source),
    )
}
