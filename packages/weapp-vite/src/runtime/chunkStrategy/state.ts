interface SharedChunkDiagnostics {
  ignoredMainImporters: string[]
}

const sharedChunkDiagnostics = new Map<string, SharedChunkDiagnostics>()
const takeImportersMap = new Map<string, Set<string>>()
const forceDuplicateSharedChunks = new Set<string>()

export function markTakeModuleImporter(moduleId: string, importerId: string | undefined) {
  if (!moduleId || !importerId) {
    return
  }
  const importers = takeImportersMap.get(moduleId)
  if (importers) {
    importers.add(importerId)
  }
  else {
    takeImportersMap.set(moduleId, new Set([importerId]))
  }
}

export function resetTakeImportRegistry() {
  takeImportersMap.clear()
  forceDuplicateSharedChunks.clear()
  sharedChunkDiagnostics.clear()
}

export function getTakeImporters(moduleId: string) {
  return takeImportersMap.get(moduleId)
}

export function markForceDuplicateSharedChunk(sharedName: string) {
  if (!sharedName) {
    return
  }
  forceDuplicateSharedChunks.add(sharedName)
  forceDuplicateSharedChunks.add(`${sharedName}.js`)
}

export function isForceDuplicateSharedChunk(fileName: string) {
  return forceDuplicateSharedChunks.has(fileName)
}

export function hasForceDuplicateSharedChunks() {
  return forceDuplicateSharedChunks.size > 0
}

export function recordSharedChunkDiagnostics(sharedName: string, ignoredMainImporters: string[]) {
  if (!sharedName || ignoredMainImporters.length === 0) {
    return
  }
  const uniqueImporters = Array.from(new Set(ignoredMainImporters))
  sharedChunkDiagnostics.set(sharedName, {
    ignoredMainImporters: uniqueImporters,
  })
  sharedChunkDiagnostics.set(`${sharedName}.js`, {
    ignoredMainImporters: uniqueImporters,
  })
}

export function consumeSharedChunkDiagnostics(fileName: string) {
  const direct = sharedChunkDiagnostics.get(fileName)
  if (direct) {
    sharedChunkDiagnostics.delete(fileName)
    return direct
  }

  const withoutExt = fileName.replace(/\.[^./\\]+$/, '')
  const fallback = sharedChunkDiagnostics.get(withoutExt)
  if (fallback) {
    sharedChunkDiagnostics.delete(withoutExt)
    return fallback
  }

  return undefined
}
