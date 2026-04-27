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

    if (state.entryModuleIds.has(current)) {
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

export function refreshModuleGraph(
  pluginCtx: { getModuleIds?: () => Iterable<string>, getModuleInfo?: (id: string) => any },
  state: CorePluginState,
) {
  state.moduleImporters.clear()
  state.entryModuleIds.clear()

  if (typeof pluginCtx.getModuleIds !== 'function' || typeof pluginCtx.getModuleInfo !== 'function') {
    return
  }

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

    const importers = new Set<string>()
    const importerIds: string[] = []
    if (Array.isArray(info.importers)) {
      importerIds.push(...info.importers)
    }
    if (Array.isArray(info.dynamicImporters)) {
      importerIds.push(...info.dynamicImporters)
    }
    for (const importer of importerIds) {
      const normalizedImporter = normalizeFsResolvedId(importer)
      if (isSkippableResolvedId(normalizedImporter)) {
        continue
      }
      importers.add(normalizedImporter)
    }

    if (importers.size) {
      state.moduleImporters.set(normalizedId, importers)
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
  const hasProjectSourceModule = (chunk: OutputChunk) => {
    if (isProjectSourceModule(chunk.facadeModuleId)) {
      return true
    }
    if (!Array.isArray(chunk.moduleIds)) {
      return false
    }
    return chunk.moduleIds.some(moduleId => isProjectSourceModule(moduleId))
  }

  for (const [bundleKey, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (!chunk.fileName) {
      chunk.fileName = bundleKey
    }
    bundleChunks.set(chunk.fileName, chunk)
    if (hasProjectSourceModule(chunk)) {
      state.hmrSourceSharedChunks.add(chunk.fileName)
    }
    else {
      state.hmrSourceSharedChunks.delete(chunk.fileName)
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

  for (const [chunkId, importers] of state.hmrSharedChunkImporters) {
    for (const entryId of refreshedEntryIds) {
      importers.delete(entryId)
      const chunkIds = state.hmrSharedChunksByEntry.get(entryId)
      if (chunkIds) {
        chunkIds.delete(chunkId)
        if (chunkIds.size === 0) {
          state.hmrSharedChunksByEntry.delete(entryId)
        }
      }
    }
    if (importers.size === 0) {
      state.hmrSharedChunkImporters.delete(chunkId)
      state.hmrSharedChunkDependencies.delete(chunkId)
      state.hmrSourceSharedChunks.delete(chunkId)
    }
  }

  appendSharedChunkImporters(bundle, state, refreshedEntryIds, previousImporters, previousDependencies)
}
