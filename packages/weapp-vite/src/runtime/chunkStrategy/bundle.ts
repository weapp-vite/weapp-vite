import type { OutputBundle, OutputChunk } from 'rolldown'
import { posix as path } from 'pathe'
import { containsImportSpecifier, createRelativeImport, replaceAll } from './utils'

export interface ChunkImporterIndex {
  directImporters: Map<string, Set<string>>
  chunks: Map<string, OutputChunk>
}

type BundleEntry = [string, OutputBundle[string]]

function addDirectImporter(
  directImporters: Map<string, Set<string>>,
  imported: unknown,
  importer: string,
) {
  if (typeof imported !== 'string' || !imported || imported === importer) {
    return
  }
  let importers = directImporters.get(imported)
  if (!importers) {
    importers = new Set<string>()
    directImporters.set(imported, importers)
  }
  importers.add(importer)
}

function removeDirectImporter(
  directImporters: Map<string, Set<string>>,
  imported: string,
  importer: string,
) {
  const importers = directImporters.get(imported)
  if (!importers) {
    return
  }
  importers.delete(importer)
  if (!importers.size) {
    directImporters.delete(imported)
  }
}

function addCollectionImporters(
  directImporters: Map<string, Set<string>>,
  collection: unknown,
  importer: string,
) {
  if (collection instanceof Set) {
    for (const imported of collection) {
      addDirectImporter(directImporters, imported, importer)
    }
    return
  }
  if (Array.isArray(collection)) {
    for (const imported of collection) {
      addDirectImporter(directImporters, imported, importer)
    }
    return
  }
  if (collection instanceof Map) {
    for (const imported of collection.keys()) {
      addDirectImporter(directImporters, imported, importer)
    }
  }
}

function replaceInArray(
  list: string[] | undefined,
  searchValue: string,
  replaceValue: string,
  shouldInsert?: boolean,
) {
  const values = Array.isArray(list) ? [...list] : []
  let replaced = false
  for (let index = 0; index < values.length; index++) {
    const current = values[index]
    if (current === searchValue) {
      values[index] = replaceValue
      replaced = true
    }
  }
  if ((replaced || shouldInsert) && replaceValue && !values.includes(replaceValue)) {
    values.push(replaceValue)
  }
  return values
}

function updateViteMetadata(
  importerChunk: OutputChunk,
  originalFileName: string,
  newChunkFile: string,
  shouldInsert: boolean,
) {
  const metadata = (importerChunk as any).viteMetadata
  if (!metadata || typeof metadata !== 'object') {
    return
  }

  const candidateKeys = ['importedChunks', 'importedScripts', 'importedScriptsByUrl'] as const
  for (const key of candidateKeys) {
    const collection = metadata[key]
    if (collection instanceof Set) {
      const hadOriginal = collection.delete(originalFileName)
      if (hadOriginal || shouldInsert) {
        collection.add(newChunkFile)
      }
    }
    else if (Array.isArray(collection)) {
      metadata[key] = replaceInArray(collection, originalFileName, newChunkFile, shouldInsert)
    }
    else if (collection instanceof Map) {
      if (collection.has(originalFileName)) {
        const originalValue = collection.get(originalFileName)
        collection.delete(originalFileName)
        collection.set(newChunkFile, originalValue)
      }
    }
  }
}

export function createChunkImporterIndex(
  bundle: OutputBundle,
  entries: BundleEntry[] = Object.entries(bundle),
): ChunkImporterIndex {
  const directImporters = new Map<string, Set<string>>()
  const chunks = new Map<string, OutputChunk>()
  const addImporter = (target: string | undefined, importer: string) => {
    if (!target || target === importer) {
      return
    }
    let importers = directImporters.get(target)
    if (!importers) {
      importers = new Set<string>()
      directImporters.set(target, importers)
    }
    importers.add(importer)
  }
  for (const [fileName, output] of entries) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    chunks.set(fileName, chunk)
    for (const imported of chunk.imports ?? []) {
      addImporter(imported, fileName)
    }
    for (const imported of chunk.dynamicImports ?? []) {
      addImporter(imported, fileName)
    }

    const metadata = (chunk as any).viteMetadata
    if (metadata) {
      addCollectionImporters(directImporters, metadata.importedChunks, fileName)
      addCollectionImporters(
        directImporters,
        metadata.importedScripts ?? metadata.importedScriptsByUrl,
        fileName,
      )
    }
  }

  return { directImporters, chunks }
}

export function removeChunkFromImporterIndex(index: ChunkImporterIndex, fileName: string) {
  index.chunks.delete(fileName)
  index.directImporters.delete(fileName)
  for (const [target, importers] of index.directImporters) {
    importers.delete(fileName)
    if (!importers.size) {
      index.directImporters.delete(target)
    }
  }
}

function updateChunkImporterIndex(
  index: ChunkImporterIndex,
  importerFile: string,
  originalFileName: string,
  newChunkFile: string,
  shouldInsert: boolean,
) {
  if (!newChunkFile || originalFileName === newChunkFile) {
    return
  }
  const hadOriginal = index.directImporters.get(originalFileName)?.has(importerFile) === true
  removeDirectImporter(index.directImporters, originalFileName, importerFile)
  if (hadOriginal || shouldInsert) {
    addDirectImporter(index.directImporters, newChunkFile, importerFile)
  }
}

export function findChunkImporters(
  bundle: OutputBundle,
  target: string,
  index: ChunkImporterIndex = createChunkImporterIndex(bundle),
) {
  const importers = new Set(index.directImporters.get(target))

  for (const [fileName, chunk] of index.chunks) {
    if (fileName === target || importers.has(fileName)) {
      continue
    }

    const potentialImport = createRelativeImport(fileName, target)
    if (potentialImport && potentialImport !== './' && containsImportSpecifier(chunk.code ?? '', potentialImport)) {
      importers.add(fileName)
    }
  }

  return Array.from(importers)
}

export function ensureUniqueFileName(bundle: OutputBundle, fileName: string) {
  if (!bundle[fileName]) {
    return fileName
  }

  const { dir, name, ext } = path.parse(fileName)
  let index = 1
  let candidate = fileName

  while (bundle[candidate]) {
    const nextName = `${name}.${index}`
    candidate = dir ? path.join(dir, `${nextName}${ext}`) : `${nextName}${ext}`
    index++
  }

  return candidate
}

export function updateImporters(
  bundle: OutputBundle,
  importerToChunk: Map<string, string>,
  originalFileName: string,
  index?: ChunkImporterIndex,
) {
  for (const [importerFile, newChunkFile] of importerToChunk.entries()) {
    const importer = bundle[importerFile]
    if (!importer || importer.type !== 'chunk') {
      continue
    }

    const importerChunk = importer as OutputChunk
    const originalImportPath = createRelativeImport(importerFile, originalFileName)
    const newImportPath = createRelativeImport(importerFile, newChunkFile)

    let codeUpdated = false
    if (originalImportPath !== newImportPath) {
      const updated = replaceAll(importerChunk.code, originalImportPath, newImportPath)
      if (updated !== importerChunk.code) {
        importerChunk.code = updated
        codeUpdated = true
      }
    }

    importerChunk.imports = replaceInArray(importerChunk.imports, originalFileName, newChunkFile, codeUpdated)
    importerChunk.dynamicImports = replaceInArray(importerChunk.dynamicImports, originalFileName, newChunkFile, codeUpdated)

    const implicitlyLoadedBefore = (importerChunk as any).implicitlyLoadedBefore
    if (Array.isArray(implicitlyLoadedBefore)) {
      (importerChunk as any).implicitlyLoadedBefore = replaceInArray(
        implicitlyLoadedBefore,
        originalFileName,
        newChunkFile,
        codeUpdated,
      )
    }

    const referencedFiles = (importerChunk as any).referencedFiles
    if (Array.isArray(referencedFiles)) {
      (importerChunk as any).referencedFiles = replaceInArray(
        referencedFiles,
        originalFileName,
        newChunkFile,
        codeUpdated,
      )
    }

    updateViteMetadata(importerChunk, originalFileName, newChunkFile, codeUpdated)
    if (index) {
      updateChunkImporterIndex(index, importerFile, originalFileName, newChunkFile, codeUpdated)
    }
  }
}
