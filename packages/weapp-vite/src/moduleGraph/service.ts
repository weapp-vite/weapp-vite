import type { SidecarModuleKind } from './protocol'
import type {
  BuildGraphContext,
  BuildModuleInfo,
  DevModuleNode,
  DevServerGraphHost,
  TopologyRescanRequest,
} from './types'
import { createDebugger } from '../debugger'
import { parseLogicalEntryId, parseSidecarModuleId, parseSidecarSourceRequest } from './protocol'
import { collectBuildStartIds, collectDevStartNodes, normalizeSourceId } from './traversal'

const debug = createDebugger('weapp-vite:module-graph')

export interface ModuleGraphService {
  bindBuildContext: (scope: object, context: BuildGraphContext) => void
  bindDevServer: (server: DevServerGraphHost | undefined) => void
  bindPluginContext: (context: BuildGraphContext) => void
  collectAffectedEntries: (file: string) => Set<string>
  getPendingChanges: () => Array<{ event: string, file: string }>
  consumeTopologyRescan: () => TopologyRescanRequest | undefined
  hasModule: (file: string) => boolean
  invalidate: (file: string) => Set<string>
  isLogicalLayoutEntry: (file: string) => boolean
  load: (options: { id: string, resolveDependencies?: boolean }) => Promise<BuildModuleInfo>
  replaceEntryDependencies: (ownerId: string, kind: SidecarModuleKind, sourceIds: Iterable<string>) => void
  recordChangedFile: (file: string, event: string) => void
  clearPendingChanges: () => void
  requestTopologyRescan: (reason: string, file: string) => void
  resolve: (
    source: string,
    importer?: string,
    options?: { skipSelf?: boolean },
  ) => Promise<{ id: string } | null>
  syncDevGraph: (context: BuildGraphContext) => Promise<void>
  getEntryDependencies: (ownerId: string) => Array<{ kind: SidecarModuleKind, sourceId: string }>
}

export function createModuleGraphService(): ModuleGraphService {
  const buildContexts = new Map<object, BuildGraphContext>()
  let pluginContext: BuildGraphContext | undefined
  let devServer: DevServerGraphHost | undefined
  let topologyRescan: TopologyRescanRequest | undefined
  const entryDependencies = new Map<string, Map<SidecarModuleKind, Set<string>>>()
  const pendingChanges = new Map<string, string>()

  const collectFromBuildGraph = (file: string, affected: Set<string>) => {
    for (const buildContext of buildContexts.values()) {
      if (typeof buildContext.getModuleInfo !== 'function') {
        continue
      }
      const queue = [...collectBuildStartIds(buildContext, file)]
      const visited = new Set<string>()
      for (let index = 0; index < queue.length; index += 1) {
        const id = queue[index]!
        if (visited.has(id)) {
          continue
        }
        visited.add(id)
        const logicalEntry = parseLogicalEntryId(id)
        if (logicalEntry) {
          affected.add(normalizeSourceId(logicalEntry.sourceId))
          if (logicalEntry.type !== 'layout') {
            continue
          }
        }
        const sidecar = parseSidecarModuleId(id)
        if (sidecar) {
          affected.add(normalizeSourceId(sidecar.ownerId))
        }
        const sidecarSource = parseSidecarSourceRequest(id)
        if (sidecarSource) {
          affected.add(normalizeSourceId(sidecarSource.ownerId))
        }
        const info = buildContext.getModuleInfo(id)
        for (const importer of [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])]) {
          if (!visited.has(importer)) {
            queue.push(importer)
          }
        }
      }
    }
  }

  const collectFromDevGraph = (file: string, affected: Set<string>) => {
    if (!devServer) {
      return
    }
    const queue = [...collectDevStartNodes(devServer, file)]
    const visited = new Set<DevModuleNode>()
    for (let index = 0; index < queue.length; index += 1) {
      const module = queue[index]!
      if (visited.has(module)) {
        continue
      }
      visited.add(module)
      const logicalEntry = module.id ? parseLogicalEntryId(module.id) : undefined
      if (logicalEntry) {
        affected.add(normalizeSourceId(logicalEntry.sourceId))
        if (logicalEntry.type !== 'layout') {
          continue
        }
      }
      const sidecar = module.id ? parseSidecarModuleId(module.id) : undefined
      if (sidecar) {
        affected.add(normalizeSourceId(sidecar.ownerId))
        continue
      }
      const sidecarSource = module.id ? parseSidecarSourceRequest(module.id) : undefined
      if (sidecarSource) {
        affected.add(normalizeSourceId(sidecarSource.ownerId))
        continue
      }
      for (const importer of module.importers ?? []) {
        if (!visited.has(importer)) {
          queue.push(importer)
        }
      }
    }
  }

  const collectAffectedEntries = (rawFile: string) => {
    const file = normalizeSourceId(rawFile)
    const affected = new Set<string>()
    if (devServer) {
      collectFromDevGraph(file, affected)
    }
    else {
      collectFromBuildGraph(file, affected)
    }
    return affected
  }

  const warmDevModule = async (id: string) => {
    if (!devServer?.transformRequest) {
      return
    }
    const queue = [id]
    const visited = new Set<string>()
    for (let index = 0; index < queue.length; index += 1) {
      const request = queue[index]!
      if (visited.has(request)) {
        continue
      }
      visited.add(request)
      try {
        await devServer.transformRequest(request)
      }
      catch (error) {
        debug?.(`dev graph 预热跳过无法展开的 external 终点 ${request}: ${String(error)}`)
        continue
      }
      const module = devServer.moduleGraph.getModuleById(request)
      for (const dependency of module?.importedModules ?? []) {
        const dependencyRequest = dependency.url ?? dependency.id
        if (dependencyRequest && !visited.has(dependencyRequest)) {
          queue.push(dependencyRequest)
        }
      }
    }
  }

  return {
    bindBuildContext(scope, context) {
      buildContexts.set(scope, context)
    },
    bindDevServer(server) {
      devServer = server
    },
    bindPluginContext(context) {
      pluginContext = context
    },
    collectAffectedEntries,
    getPendingChanges() {
      return Array.from(pendingChanges, ([file, event]) => ({ event, file }))
    },
    consumeTopologyRescan() {
      const request = topologyRescan
      topologyRescan = undefined
      return request
    },
    hasModule(rawFile) {
      const file = normalizeSourceId(rawFile)
      if (devServer) {
        return collectDevStartNodes(devServer, file).size > 0
      }
      return Array.from(buildContexts.values())
        .some(context => collectBuildStartIds(context, file).size > 0)
    },
    invalidate(rawFile) {
      const file = normalizeSourceId(rawFile)
      const affected = collectAffectedEntries(file)
      if (devServer) {
        for (const module of collectDevStartNodes(devServer, file)) {
          devServer.moduleGraph.invalidateModule(module)
        }
      }
      return affected
    },
    isLogicalLayoutEntry(rawFile) {
      const file = normalizeSourceId(rawFile)
      for (const byKind of entryDependencies.values()) {
        if (byKind.get('layout')?.has(file) && /\.(?:[cm]?[jt]sx?|vue)$/.test(file)) {
          return true
        }
      }
      return false
    },
    async load(options) {
      if (typeof pluginContext?.load !== 'function') {
        throw new TypeError('ModuleGraphService 尚未绑定支持 load 的 PluginContext。')
      }
      return await pluginContext.load(options)
    },
    replaceEntryDependencies(rawOwnerId, kind, sourceIds) {
      const ownerId = normalizeSourceId(rawOwnerId)
      let byKind = entryDependencies.get(ownerId)
      if (!byKind) {
        byKind = new Map()
        entryDependencies.set(ownerId, byKind)
      }
      const normalized = new Set(Array.from(sourceIds, normalizeSourceId))
      if (normalized.size) {
        byKind.set(kind, normalized)
      }
      else {
        byKind.delete(kind)
      }
      if (!byKind.size) {
        entryDependencies.delete(ownerId)
      }
    },
    recordChangedFile(rawFile, event) {
      const file = normalizeSourceId(rawFile)
      pendingChanges.set(file, event)
    },
    clearPendingChanges() {
      pendingChanges.clear()
    },
    requestTopologyRescan(reason, rawFile) {
      topologyRescan ??= {
        files: new Set<string>(),
        reasons: new Set<string>(),
      }
      topologyRescan.files.add(normalizeSourceId(rawFile))
      topologyRescan.reasons.add(reason)
    },
    async resolve(source, importer, options) {
      if (typeof pluginContext?.resolve !== 'function') {
        throw new TypeError('ModuleGraphService 尚未绑定支持 resolve 的 PluginContext。')
      }
      return await pluginContext.resolve(source, importer, options)
    },
    async syncDevGraph(context) {
      if (!devServer || typeof context.getModuleIds !== 'function') {
        return
      }
      const logicalEntryIds = Array.from(context.getModuleIds()).filter(id => parseLogicalEntryId(id))
      await Promise.all(logicalEntryIds.map(warmDevModule))
    },
    getEntryDependencies(rawOwnerId) {
      const ownerId = normalizeSourceId(rawOwnerId)
      const byKind = entryDependencies.get(ownerId)
      if (!byKind) {
        return []
      }
      const dependencies: Array<{ kind: SidecarModuleKind, sourceId: string }> = []
      for (const [kind, sourceIds] of byKind) {
        for (const sourceId of sourceIds) {
          dependencies.push({ kind, sourceId })
        }
      }
      return dependencies
    },
  }
}
