import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from './types'
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

function appendSharedChunkImporters(bundle: OutputBundle, state: CorePluginState, onlyEntryIds?: Set<string>) {
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

  const entryChunks: Array<{ entryId: string, chunk: OutputChunk }> = []
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    const trackedImporterIds = getTrackedImporterIds(chunk)
    if (!trackedImporterIds.size) {
      continue
    }
    for (const trackedImporterId of trackedImporterIds) {
      if (onlyEntryIds && !onlyEntryIds.has(trackedImporterId)) {
        continue
      }
      entryChunks.push({ entryId: trackedImporterId, chunk })
    }
  }

  if (!entryChunks.length) {
    return
  }

  for (const { chunk, entryId } of entryChunks) {
    const imports = new Set<string>()
    if (Array.isArray(chunk.imports)) {
      for (const imported of chunk.imports) {
        imports.add(imported)
      }
    }
    if (Array.isArray(chunk.dynamicImports)) {
      for (const imported of chunk.dynamicImports) {
        imports.add(imported)
      }
    }
    if (!imports.size) {
      continue
    }

    for (const imported of imports) {
      const target = bundle[imported]
      if (!target || target.type !== 'chunk') {
        continue
      }
      const targetChunk = target as OutputChunk
      if (getTrackedImporterIds(targetChunk).size) {
        continue
      }
      const current = state.hmrSharedChunkImporters.get(imported)
      if (current) {
        current.add(entryId)
      }
      else {
        state.hmrSharedChunkImporters.set(imported, new Set([entryId]))
      }
    }
  }
}

export function refreshSharedChunkImporters(bundle: OutputBundle, state: CorePluginState) {
  state.hmrSharedChunkImporters.clear()
  appendSharedChunkImporters(bundle, state)
}

export function refreshPartialSharedChunkImporters(bundle: OutputBundle, state: CorePluginState, entryIds: Set<string>) {
  if (!entryIds.size) {
    return
  }

  for (const [chunkId, importers] of state.hmrSharedChunkImporters) {
    for (const entryId of entryIds) {
      importers.delete(entryId)
    }
    if (importers.size === 0) {
      state.hmrSharedChunkImporters.delete(chunkId)
    }
  }

  appendSharedChunkImporters(bundle, state, entryIds)
}
