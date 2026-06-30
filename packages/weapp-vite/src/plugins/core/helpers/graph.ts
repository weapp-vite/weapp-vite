import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from './types'
import path from 'pathe'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'

export function collectAffectedEntries(state: CorePluginState, startId: string) {
  const affected = new Set<string>()
  const visited = new Set<string>()
  const queue: string[] = [startId]

  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) {
      continue
    }
    visited.add(current)

    if (state.entryModuleIds.has(current) || state.resolvedEntryMap.has(current)) {
      affected.add(current)
      continue
    }

    const importers = state.moduleImporters.get(current)
    if (!importers || importers.size === 0) {
      continue
    }

    for (const importer of importers) {
      if (!visited.has(importer)) {
        queue.push(importer)
      }
    }
  }

  return affected
}

export function collectAffectedEntriesFromSharedChunks(state: CorePluginState, startId: string) {
  const affected = new Set<string>()
  const chunkIds = state.hmrSharedChunksByModule.get(normalizeFsResolvedId(startId))
  if (!chunkIds?.size) {
    return affected
  }

  for (const chunkId of chunkIds) {
    const importers = state.hmrSharedChunkImporters.get(chunkId)
    if (!importers?.size) {
      continue
    }
    for (const importer of importers) {
      if (state.resolvedEntryMap.has(importer)) {
        affected.add(importer)
      }
    }
  }

  return affected
}

export function collectAffectedSharedChunks(state: CorePluginState, startId: string) {
  const affected = new Set<string>()
  const chunkIds = state.hmrSharedChunksByModule.get(normalizeFsResolvedId(startId))
  if (!chunkIds?.size) {
    return affected
  }

  for (const chunkId of chunkIds) {
    affected.add(chunkId)
  }

  return affected
}

function createModulesByImporter(moduleImporters: Map<string, Set<string>>) {
  const modulesByImporter = new Map<string, Set<string>>()
  for (const [moduleId, importers] of moduleImporters) {
    for (const importerId of importers) {
      let modules = modulesByImporter.get(importerId)
      if (!modules) {
        modules = new Set<string>()
        modulesByImporter.set(importerId, modules)
      }
      modules.add(moduleId)
    }
  }
  return modulesByImporter
}

function createSharedModulesByChunk(sharedChunksByModule: Map<string, Set<string>>) {
  const modulesByChunk = new Map<string, Set<string>>()
  for (const [moduleId, chunkIds] of sharedChunksByModule) {
    for (const chunkId of chunkIds) {
      let moduleIds = modulesByChunk.get(chunkId)
      if (!moduleIds) {
        moduleIds = new Set<string>()
        modulesByChunk.set(chunkId, moduleIds)
      }
      moduleIds.add(moduleId)
    }
  }
  return modulesByChunk
}

export function refreshModuleGraph(
  pluginCtx: { getModuleIds?: () => Iterable<string>, getModuleInfo?: (id: string) => any },
  state: CorePluginState,
  bundle?: OutputBundle,
  options?: { mode?: 'replace' | 'merge' },
) {
  const mode = options?.mode ?? 'replace'
  if (mode === 'replace') {
    state.moduleImporters.clear()
    state.entryModuleIds.clear()
  }

  const addModuleImporter = (moduleId: string, importerId: string) => {
    const normalizedModuleId = normalizeFsResolvedId(moduleId)
    const normalizedImporterId = normalizeFsResolvedId(importerId)
    if (
      normalizedModuleId === normalizedImporterId
      || isSkippableResolvedId(normalizedModuleId)
      || isSkippableResolvedId(normalizedImporterId)
    ) {
      return
    }
    const importers = state.moduleImporters.get(normalizedModuleId) ?? new Set<string>()
    importers.add(normalizedImporterId)
    state.moduleImporters.set(normalizedModuleId, importers)
  }
  const removeEntryImporter = (entryId: string, modulesByImporter?: Map<string, Set<string>>) => {
    const normalizedEntryId = normalizeFsResolvedId(entryId)
    const moduleIds = modulesByImporter?.get(normalizedEntryId)
    if (moduleIds) {
      for (const moduleId of moduleIds) {
        const importers = state.moduleImporters.get(moduleId)
        if (!importers) {
          continue
        }
        importers.delete(normalizedEntryId)
        if (!importers.size) {
          state.moduleImporters.delete(moduleId)
        }
      }
      return
    }
    for (const [moduleId, importers] of state.moduleImporters) {
      importers.delete(normalizedEntryId)
      if (!importers.size) {
        state.moduleImporters.delete(moduleId)
      }
    }
  }
  const collectChunkModuleIds = (chunk: OutputChunk) => {
    const moduleIds = new Set<string>()
    if (Array.isArray(chunk.moduleIds)) {
      for (const moduleId of chunk.moduleIds) {
        moduleIds.add(moduleId)
      }
    }
    for (const moduleId of Object.keys(chunk.modules ?? {})) {
      moduleIds.add(moduleId)
    }
    return moduleIds
  }
  const collectChunkEntryIds = (chunk: OutputChunk, moduleIds: Set<string>) => {
    const entryIds = new Set<string>()
    const addEntryIfTracked = (rawId?: string | null) => {
      if (!rawId) {
        return
      }
      const entryId = normalizeFsResolvedId(rawId)
      if (!isSkippableResolvedId(entryId) && state.resolvedEntryMap.has(entryId)) {
        entryIds.add(entryId)
      }
    }

    addEntryIfTracked(chunk.facadeModuleId)
    for (const moduleId of moduleIds) {
      addEntryIfTracked(moduleId)
    }

    return entryIds
  }

  if (typeof pluginCtx.getModuleIds === 'function' && typeof pluginCtx.getModuleInfo === 'function') {
    for (const rawId of pluginCtx.getModuleIds()) {
      const normalizedId = normalizeFsResolvedId(rawId)
      if (isSkippableResolvedId(normalizedId)) {
        continue
      }

      const info = pluginCtx.getModuleInfo(rawId)
      if (!info) {
        continue
      }

      if (info.isEntry) {
        state.entryModuleIds.add(normalizedId)
      }

      const importerIds: string[] = []
      if (Array.isArray(info.importers)) {
        importerIds.push(...info.importers)
      }
      if (Array.isArray(info.dynamicImporters)) {
        importerIds.push(...info.dynamicImporters)
      }
      for (const importer of importerIds) {
        addModuleImporter(normalizedId, importer)
      }
    }
  }

  if (!bundle) {
    return
  }

  const chunkRecords: Array<{ chunk: OutputChunk, entryIds: Set<string>, moduleIds: Set<string> }> = []
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    const moduleIds = collectChunkModuleIds(chunk)
    const entryIds = collectChunkEntryIds(chunk, moduleIds)
    if (!entryIds.size) {
      continue
    }
    chunkRecords.push({ chunk, entryIds, moduleIds })
  }

  if (mode === 'merge') {
    const modulesByImporter = createModulesByImporter(state.moduleImporters)
    const removedEntryIds = new Set<string>()
    for (const { entryIds } of chunkRecords) {
      for (const entryId of entryIds) {
        if (removedEntryIds.has(entryId)) {
          continue
        }
        removedEntryIds.add(entryId)
        removeEntryImporter(entryId, modulesByImporter)
      }
    }
  }

  for (const { entryIds, moduleIds } of chunkRecords) {
    for (const entryId of entryIds) {
      state.entryModuleIds.add(entryId)
      for (const moduleId of moduleIds) {
        addModuleImporter(moduleId, entryId)
      }
    }
  }
}

function appendSharedChunkImporters(
  bundle: OutputBundle,
  state: CorePluginState,
  onlyEntryIds?: Set<string>,
  previousImporters?: Map<string, Set<string>>,
  previousDependencies?: Map<string, Set<string>>,
) {
  const bundleChunks = new Map<string, OutputChunk>()
  const resolveImportedChunkId = (importerFileName: string, imported: string) => {
    if (bundleChunks.has(imported)) {
      return imported
    }
    if (imported.startsWith('.')) {
      return path.normalize(path.join(path.dirname(importerFileName), imported))
    }
    return imported
  }
  const collectChunkImports = (chunk: OutputChunk) => {
    const imports = new Set<string>()
    if (Array.isArray(chunk.imports)) {
      for (const imported of chunk.imports) {
        imports.add(resolveImportedChunkId(chunk.fileName, imported))
      }
    }
    if (Array.isArray(chunk.dynamicImports)) {
      for (const imported of chunk.dynamicImports) {
        imports.add(resolveImportedChunkId(chunk.fileName, imported))
      }
    }
    return imports
  }

  const getTrackedImporterIds = (chunk: OutputChunk) => {
    const trackedImporterIds = new Set<string>()

    if (chunk.facadeModuleId) {
      const entryId = normalizeFsResolvedId(chunk.facadeModuleId)
      if (chunk.isEntry || state.resolvedEntryMap.has(entryId)) {
        trackedImporterIds.add(entryId)
      }
    }

    if (Array.isArray(chunk.moduleIds)) {
      for (const moduleId of chunk.moduleIds) {
        const normalizedModuleId = normalizeFsResolvedId(moduleId)
        if (state.resolvedEntryMap.has(normalizedModuleId)) {
          trackedImporterIds.add(normalizedModuleId)
        }
      }
    }

    return trackedImporterIds
  }
  const isProjectSourceModule = (rawId?: string | null) => {
    if (!rawId) {
      return false
    }
    const absoluteSrcRoot = state.ctx?.configService?.absoluteSrcRoot
    if (!absoluteSrcRoot) {
      return false
    }
    const normalizedRoot = normalizeFsResolvedId(absoluteSrcRoot)
    const normalizedId = normalizeFsResolvedId(rawId)
    if (isSkippableResolvedId(normalizedId)) {
      return false
    }
    return normalizedId === normalizedRoot || normalizedId.startsWith(`${normalizedRoot}/`)
  }
  const collectProjectSourceModules = (chunk: OutputChunk) => {
    const moduleIds = new Set<string>()
    if (isProjectSourceModule(chunk.facadeModuleId)) {
      moduleIds.add(normalizeFsResolvedId(chunk.facadeModuleId!))
    }
    if (Array.isArray(chunk.moduleIds)) {
      for (const moduleId of chunk.moduleIds) {
        if (isProjectSourceModule(moduleId)) {
          moduleIds.add(normalizeFsResolvedId(moduleId))
        }
      }
    }
    for (const moduleId of Object.keys(chunk.modules ?? {})) {
      if (isProjectSourceModule(moduleId)) {
        moduleIds.add(normalizeFsResolvedId(moduleId))
      }
    }
    return moduleIds
  }
  const addSharedChunkModule = (moduleId: string, chunkId: string) => {
    state.ctx.runtimeState?.build?.hmr?.sharedChunkSourceModuleIds?.add(moduleId)
    const current = state.hmrSharedChunksByModule.get(moduleId)
    if (current) {
      current.add(chunkId)
    }
    else {
      state.hmrSharedChunksByModule.set(moduleId, new Set([chunkId]))
    }
  }
  const previousSharedModulesByChunk = createSharedModulesByChunk(state.hmrSharedChunksByModule)
  const pruneSharedChunkModules = (chunkId: string, nextModuleIds: Set<string>) => {
    if (!nextModuleIds.size) {
      return
    }
    const previousModuleIds = previousSharedModulesByChunk.get(chunkId)
    if (!previousModuleIds?.size) {
      return
    }
    for (const moduleId of previousModuleIds) {
      if (nextModuleIds.has(moduleId)) {
        continue
      }
      const chunkIds = state.hmrSharedChunksByModule.get(moduleId)
      if (!chunkIds) {
        continue
      }
      chunkIds.delete(chunkId)
      if (chunkIds.size === 0) {
        state.hmrSharedChunksByModule.delete(moduleId)
      }
    }
  }

  for (const [bundleKey, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (!chunk.fileName) {
      chunk.fileName = bundleKey
    }
    const projectSourceModules = collectProjectSourceModules(chunk)
    bundleChunks.set(chunk.fileName, chunk)
    pruneSharedChunkModules(chunk.fileName, projectSourceModules)
    if (projectSourceModules.size > 0) {
      state.hmrSourceSharedChunks.add(chunk.fileName)
    }
    for (const moduleId of projectSourceModules) {
      addSharedChunkModule(moduleId, chunk.fileName)
    }
  }

  const trackedImporterIdsByChunk = new Map<string, Set<string>>()
  for (const [fileName, chunk] of bundleChunks) {
    trackedImporterIdsByChunk.set(fileName, getTrackedImporterIds(chunk))
    const imports = collectChunkImports(chunk)
    if (imports.size) {
      state.hmrSharedChunkDependencies.set(fileName, imports)
    }
    else {
      state.hmrSharedChunkDependencies.delete(fileName)
    }
  }

  const addSharedChunkImporter = (chunkId: string, entryId: string) => {
    const current = state.hmrSharedChunkImporters.get(chunkId)
    if (current) {
      current.add(entryId)
    }
    else {
      state.hmrSharedChunkImporters.set(chunkId, new Set([entryId]))
    }

    const currentChunkIds = state.hmrSharedChunksByEntry.get(entryId)
    if (currentChunkIds) {
      currentChunkIds.add(chunkId)
    }
    else {
      state.hmrSharedChunksByEntry.set(entryId, new Set([chunkId]))
    }
  }

  const restoreMissingChunkImporters = (
    entryId: string,
    chunkId: string,
    visited: Set<string>,
  ) => {
    if (visited.has(chunkId)) {
      return
    }
    visited.add(chunkId)

    if (!previousImporters?.get(chunkId)?.has(entryId)) {
      return
    }

    addSharedChunkImporter(chunkId, entryId)

    const nestedImports = previousDependencies?.get(chunkId)
    if (!nestedImports?.size) {
      return
    }

    for (const nestedImport of nestedImports) {
      restoreMissingChunkImporters(entryId, nestedImport, visited)
    }
  }

  const propagateSharedChunkImporter = (
    entryId: string,
    importedChunkId: string,
    visited: Set<string>,
  ) => {
    if (visited.has(importedChunkId)) {
      return
    }
    visited.add(importedChunkId)

    const targetChunk = bundleChunks.get(importedChunkId)
    if (!targetChunk) {
      visited.delete(importedChunkId)
      restoreMissingChunkImporters(entryId, importedChunkId, visited)
      return
    }

    if ((trackedImporterIdsByChunk.get(importedChunkId)?.size ?? 0) > 0) {
      return
    }

    addSharedChunkImporter(importedChunkId, entryId)

    const nestedImports = state.hmrSharedChunkDependencies.get(importedChunkId) ?? new Set<string>()

    for (const nestedImport of nestedImports) {
      propagateSharedChunkImporter(entryId, nestedImport, visited)
    }
  }

  for (const [fileName] of bundleChunks) {
    const trackedImporterIds = trackedImporterIdsByChunk.get(fileName) ?? new Set<string>()
    if (!trackedImporterIds.size) {
      continue
    }

    for (const trackedImporterId of trackedImporterIds) {
      if (onlyEntryIds && !onlyEntryIds.has(trackedImporterId)) {
        continue
      }

      const imports = state.hmrSharedChunkDependencies.get(fileName) ?? new Set<string>()
      if (!imports.size) {
        continue
      }

      for (const imported of imports) {
        propagateSharedChunkImporter(trackedImporterId, imported, new Set())
      }
    }
  }
}

export function refreshSharedChunkImporters(bundle: OutputBundle, state: CorePluginState) {
  state.hmrSharedChunkImporters.clear()
  state.hmrSharedChunksByEntry.clear()
  state.hmrSharedChunkDependencies.clear()
  state.hmrSharedChunksByModule.clear()
  state.hmrSourceSharedChunks.clear()
  appendSharedChunkImporters(bundle, state)
}

export function refreshPartialSharedChunkImporters(bundle: OutputBundle, state: CorePluginState, entryIds: Set<string>) {
  if (!entryIds.size) {
    return
  }

  const refreshedEntryIds = new Set<string>()
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    if (chunk.facadeModuleId) {
      const entryId = normalizeFsResolvedId(chunk.facadeModuleId)
      if ((chunk.isEntry || state.resolvedEntryMap.has(entryId)) && entryIds.has(entryId)) {
        refreshedEntryIds.add(entryId)
      }
    }

    if (Array.isArray(chunk.moduleIds)) {
      for (const moduleId of chunk.moduleIds) {
        const normalizedModuleId = normalizeFsResolvedId(moduleId)
        if (state.resolvedEntryMap.has(normalizedModuleId) && entryIds.has(normalizedModuleId)) {
          refreshedEntryIds.add(normalizedModuleId)
        }
      }
    }
  }

  if (!refreshedEntryIds.size) {
    return
  }

  const previousImporters = new Map<string, Set<string>>()
  for (const [chunkId, importers] of state.hmrSharedChunkImporters) {
    previousImporters.set(chunkId, new Set(importers))
  }
  const previousDependencies = new Map<string, Set<string>>()
  for (const [chunkId, imports] of state.hmrSharedChunkDependencies) {
    previousDependencies.set(chunkId, new Set(imports))
  }
  for (const entryId of refreshedEntryIds) {
    const chunkIds = state.hmrSharedChunksByEntry.get(entryId)
    if (!chunkIds?.size) {
      const emptyChunkIds: string[] = []
      for (const [chunkId, importers] of state.hmrSharedChunkImporters) {
        importers.delete(entryId)
        if (importers.size === 0) {
          emptyChunkIds.push(chunkId)
        }
      }
      for (const chunkId of emptyChunkIds) {
        state.hmrSharedChunkImporters.delete(chunkId)
        state.hmrSharedChunkDependencies.delete(chunkId)
      }
      continue
    }
    for (const chunkId of chunkIds) {
      const importers = state.hmrSharedChunkImporters.get(chunkId)
      if (!importers) {
        continue
      }
      importers.delete(entryId)
      if (importers.size === 0) {
        state.hmrSharedChunkImporters.delete(chunkId)
        state.hmrSharedChunkDependencies.delete(chunkId)
      }
    }
    state.hmrSharedChunksByEntry.delete(entryId)
  }

  appendSharedChunkImporters(bundle, state, refreshedEntryIds, previousImporters, previousDependencies)
}
