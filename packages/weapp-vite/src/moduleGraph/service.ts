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
  /** 只替换指定 scope；返回仅对应本次绑定的释放器。 */
  bindBuildContext: (scope: object, context: BuildGraphContext) => () => void
  /** 撤销 scope 的图和插件上下文；传入 context 时仅释放仍归该 context 所有的绑定。 */
  unbindBuildContext: (scope: object, context?: BuildGraphContext) => void
  /** 返回仅对应本次绑定的释放器，避免旧 server 的异步关闭解绑新 server。 */
  bindDevServer: (server: DevServerGraphHost | undefined) => () => void
  bindPluginContext: (scope: object, context: BuildGraphContext) => void
  /** 仅用于整个会话关闭或替换，不用于普通增量构建或临时 snapshot。 */
  resetSession: () => void
  collectAffectedEntries: (file: string) => Set<string>
  getPendingChanges: () => Array<{ event: string, file: string }>
  consumeTopologyRescan: () => TopologyRescanRequest | undefined
  hasModule: (file: string) => boolean
  invalidate: (file: string) => Set<string>
  isLogicalLayoutEntry: (file: string) => boolean
  load: (options: { id: string, resolveDependencies?: boolean }) => Promise<BuildModuleInfo>
  replaceEntryDependencies: (ownerId: string, kind: SidecarModuleKind, sourceIds: Iterable<string>) => void
  /** 释放 owner 自己的依赖声明；实际 import graph 的更新仍由构建引擎负责。 */
  removeEntryDependencies: (ownerId: string) => void
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
  const buildContextTokens = new Map<object, object>()
  const pluginContexts = new Map<object, BuildGraphContext>()
  const pluginContextTokens = new Map<object, object>()
  let pluginContext: BuildGraphContext | undefined
  let devServerBinding: object | undefined
  let devServer: DevServerGraphHost | undefined
  let topologyRescan: TopologyRescanRequest | undefined
  const entryDependencies = new Map<string, Map<SidecarModuleKind, Set<string>>>()
  const pendingChanges = new Map<string, string>()
  const usesUnbundledDevGraph = () => Boolean(devServer && !devServer.environments?.client?.bundledDev)

  const releaseBuildContext = (scope: object, token: object) => {
    if (buildContextTokens.get(scope) !== token) {
      return
    }
    buildContextTokens.delete(scope)
    buildContexts.delete(scope)
    if (pluginContextTokens.get(scope) === token) {
      pluginContextTokens.delete(scope)
      if (pluginContexts.delete(scope)) {
        pluginContext = undefined
        for (const context of pluginContexts.values()) {
          pluginContext = context
        }
      }
    }
  }

  const unbindBuildContext = (scope: object, context?: BuildGraphContext) => {
    const currentContext = buildContexts.get(scope)
    if (context && currentContext !== context) {
      return
    }
    const token = buildContextTokens.get(scope)
    if (token) {
      releaseBuildContext(scope, token)
      return
    }
    buildContexts.delete(scope)
    if (pluginContexts.delete(scope)) {
      pluginContextTokens.delete(scope)
      pluginContext = undefined
      for (const boundContext of pluginContexts.values()) {
        pluginContext = boundContext
      }
    }
  }

  const hasRegisteredEntryDependency = (file: string) => {
    if (entryDependencies.has(file)) {
      return true
    }
    for (const dependenciesByKind of entryDependencies.values()) {
      for (const sourceIds of dependenciesByKind.values()) {
        if (sourceIds.has(file)) {
          return true
        }
      }
    }
    return false
  }

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
    for (const [ownerId, dependenciesByKind] of entryDependencies) {
      for (const sourceIds of dependenciesByKind.values()) {
        if (sourceIds.has(file)) {
          affected.add(ownerId)
          break
        }
      }
    }
    if (usesUnbundledDevGraph()) {
      collectFromDevGraph(file, affected)
    }
    else {
      collectFromBuildGraph(file, affected)
    }
    return affected
  }

  const warmDevModule = async (id: string, server: DevServerGraphHost, binding: object | undefined) => {
    if (!server.transformRequest) {
      return
    }
    // 依赖的 URL 不等于模块 id；保留节点才能继续展开传递依赖。
    const queue: Array<string | DevModuleNode> = [id]
    const visited = new Set<string>()
    for (let index = 0; index < queue.length; index += 1) {
      if (devServerBinding !== binding) {
        return
      }
      const target = queue[index]!
      const request = typeof target === 'string' ? target : target.url ?? target.id
      if (!request || visited.has(request)) {
        continue
      }
      visited.add(request)
      try {
        await server.transformRequest(request)
      }
      catch (error) {
        debug?.(`dev graph 预热跳过无法展开的 external 终点 ${request}: ${String(error)}`)
        continue
      }
      if (devServerBinding !== binding) {
        return
      }
      const module = typeof target === 'string'
        ? server.moduleGraph.getModuleById(request)
        : target
      for (const dependency of module?.importedModules ?? []) {
        const dependencyRequest = dependency.url ?? dependency.id
        if (dependencyRequest && !visited.has(dependencyRequest)) {
          queue.push(dependency)
        }
      }
    }
  }

  return {
    bindBuildContext(scope, context) {
      const token = {}
      buildContexts.set(scope, context)
      buildContextTokens.set(scope, token)
      return () => releaseBuildContext(scope, token)
    },
    unbindBuildContext,
    bindDevServer(server) {
      const binding = {}
      devServerBinding = binding
      devServer = server
      return () => {
        if (devServerBinding === binding) {
          devServerBinding = undefined
          devServer = undefined
        }
      }
    },
    bindPluginContext(scope, context) {
      const buildToken = buildContextTokens.get(scope)
      const token = buildContexts.get(scope) === context && buildToken ? buildToken : {}
      pluginContexts.delete(scope)
      pluginContextTokens.set(scope, token)
      pluginContexts.set(scope, context)
      pluginContext = context
    },
    resetSession() {
      buildContexts.clear()
      buildContextTokens.clear()
      pluginContexts.clear()
      pluginContextTokens.clear()
      pluginContext = undefined
      devServer = undefined
      devServerBinding = undefined
      entryDependencies.clear()
      pendingChanges.clear()
      topologyRescan = undefined
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
      if (hasRegisteredEntryDependency(file)) {
        return true
      }
      if (devServer && usesUnbundledDevGraph()) {
        return collectDevStartNodes(devServer, file).size > 0
      }
      for (const context of buildContexts.values()) {
        if (collectBuildStartIds(context, file).size > 0) {
          return true
        }
      }
      return false
    },
    invalidate(rawFile) {
      const file = normalizeSourceId(rawFile)
      const affected = collectAffectedEntries(file)
      if (devServer && usesUnbundledDevGraph()) {
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
    removeEntryDependencies(rawOwnerId) {
      entryDependencies.delete(normalizeSourceId(rawOwnerId))
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
      // bundledDev 的模块图由 DevEngine 编译维护，不能在 buildEnd 再执行 unbundled transform。
      const server = devServer
      const binding = devServerBinding
      if (!server || !usesUnbundledDevGraph() || typeof context.getModuleIds !== 'function') {
        return
      }
      const logicalEntryIds = Array.from(context.getModuleIds()).filter(id => parseLogicalEntryId(id))
      await Promise.all(logicalEntryIds.map(id => warmDevModule(id, server, binding)))
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
