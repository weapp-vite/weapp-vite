import type { OutputBundle, OutputChunk } from 'rolldown'
import { posix as path } from 'pathe'
import { containsImportSpecifier, createRelativeImport, hasInCollection, replaceAll } from './utils'

export function findChunkImporters(bundle: OutputBundle, target: string) {
  const importers = new Set<string>()

  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    if (chunk.imports.includes(target) || chunk.dynamicImports.includes(target)) {
      importers.add(fileName)
      continue
    }

    const metadata = (chunk as any).viteMetadata
    if (metadata) {
      const importedChunks = metadata.importedChunks
      if (hasInCollection(importedChunks, target)) {
        importers.add(fileName)
        continue
      }
      const importedScripts = metadata.importedScripts ?? metadata.importedScriptsByUrl
      if (hasInCollection(importedScripts, target)) {
        importers.add(fileName)
        continue
      }
    }

    const potentialImport = createRelativeImport(fileName, target)
    if (potentialImport && containsImportSpecifier(chunk.code ?? '', potentialImport)) {
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

  const candidateKeys = ['importedChunks', 'importedScripts'] as const
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
