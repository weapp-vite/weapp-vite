export interface BuildModuleInfo {
  dynamicImporters?: readonly string[]
  exports?: readonly string[]
  importers?: readonly string[]
  isEntry?: boolean
}

export interface BuildGraphContext {
  getModuleIds?: () => Iterable<string>
  getModuleInfo?: (id: string) => BuildModuleInfo | null | undefined
  load?: (options: { id: string, resolveDependencies?: boolean }) => Promise<BuildModuleInfo>
  resolve?: (
    source: string,
    importer?: string,
    options?: { skipSelf?: boolean },
  ) => Promise<{ id: string } | null>
}

export interface DevModuleNode {
  file?: string | null
  id?: string | null
  importedModules?: Set<DevModuleNode>
  importers?: Set<DevModuleNode>
  url?: string
}

export interface DevModuleGraph {
  getModuleById: (id: string) => DevModuleNode | undefined
  getModulesByFile: (file: string) => Set<DevModuleNode> | undefined
  idToModuleMap?: Map<string, DevModuleNode>
  invalidateModule: (module: DevModuleNode) => void
}

export interface DevServerGraphHost {
  moduleGraph: DevModuleGraph
  transformRequest?: (url: string) => Promise<unknown>
}

export interface TopologyRescanRequest {
  files: Set<string>
  reasons: Set<string>
}
