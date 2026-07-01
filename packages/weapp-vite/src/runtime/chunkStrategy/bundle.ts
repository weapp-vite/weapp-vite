import type { OutputBundle, OutputChunk } from 'rolldown'
import { posix as path } from 'pathe'
import { createRelativeImport, replaceAll } from './utils'

export interface ChunkImporterIndex {
  directImporters: Map<string, Set<string>>
  codeImporters: Map<string, Set<string>>
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

function isIdentifierChar(char: string | undefined) {
  if (!char) {
    return false
  }
  const code = char.charCodeAt(0)
  return (
    code === 36
    || code === 95
    || (code >= 48 && code <= 57)
    || (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
  )
}

function readQuotedSpecifier(code: string, fromIndex: number) {
  let index = fromIndex
  while (index < code.length && /\s/.test(code[index])) {
    index += 1
  }

  const quote = code[index]
  if (quote !== '\'' && quote !== '"' && quote !== '`') {
    return undefined
  }

  let endIndex = index + 1
  while (endIndex < code.length) {
    const char = code[endIndex]
    if (char === quote && code[endIndex - 1] !== '\\') {
      return code.slice(index + 1, endIndex)
    }
    endIndex += 1
  }
  return undefined
}

function collectBareImportTargets(code: string, targets: Set<string>) {
  let searchIndex = 0
  while (searchIndex < code.length) {
    const importIndex = code.indexOf('import', searchIndex)
    if (importIndex === -1) {
      return
    }
    if (isIdentifierChar(code[importIndex - 1])) {
      searchIndex = importIndex + 'import'.length
      continue
    }

    const specifier = readQuotedSpecifier(code, importIndex + 'import'.length)
    if (specifier) {
      targets.add(specifier)
    }

    searchIndex = importIndex + 'import'.length
  }
}

function collectImportFromTargets(code: string, targets: Set<string>) {
  let searchIndex = 0
  while (searchIndex < code.length) {
    const importIndex = code.indexOf('import', searchIndex)
    if (importIndex === -1) {
      return
    }
    if (isIdentifierChar(code[importIndex - 1])) {
      searchIndex = importIndex + 'import'.length
      continue
    }

    const fromIndex = code.indexOf('from', importIndex + 'import'.length)
    if (fromIndex !== -1) {
      const specifier = readQuotedSpecifier(code, fromIndex + 4)
      if (specifier) {
        targets.add(specifier)
      }
    }

    searchIndex = importIndex + 'import'.length
  }
}

function collectExportFromTargets(code: string, targets: Set<string>) {
  let searchIndex = 0
  while (searchIndex < code.length) {
    const exportIndex = code.indexOf('export', searchIndex)
    if (exportIndex === -1) {
      return
    }
    if (isIdentifierChar(code[exportIndex - 1])) {
      searchIndex = exportIndex + 'export'.length
      continue
    }

    const fromIndex = code.indexOf('from', exportIndex + 'export'.length)
    if (fromIndex !== -1) {
      const specifier = readQuotedSpecifier(code, fromIndex + 4)
      if (specifier) {
        targets.add(specifier)
      }
    }

    searchIndex = exportIndex + 'export'.length
  }
}

function collectRequireTargets(code: string, targets: Set<string>) {
  let searchIndex = 0
  while (searchIndex < code.length) {
    const requireIndex = code.indexOf('require', searchIndex)
    if (requireIndex === -1) {
      return
    }
    if (isIdentifierChar(code[requireIndex - 1])) {
      searchIndex = requireIndex + 'require'.length
      continue
    }

    const openParenIndex = code.indexOf('(', requireIndex + 'require'.length)
    if (openParenIndex !== -1) {
      const specifier = readQuotedSpecifier(code, openParenIndex + 1)
      if (specifier) {
        targets.add(specifier)
      }
    }

    searchIndex = requireIndex + 'require'.length
  }
}

function collectDynamicImportTargets(code: string, targets: Set<string>) {
  let searchIndex = 0
  while (searchIndex < code.length) {
    const importIndex = code.indexOf('import(', searchIndex)
    if (importIndex === -1) {
      return
    }
    if (isIdentifierChar(code[importIndex - 1])) {
      searchIndex = importIndex + 'import('.length
      continue
    }

    const specifier = readQuotedSpecifier(code, importIndex + 'import('.length)
    if (specifier) {
      targets.add(specifier)
    }

    searchIndex = importIndex + 'import('.length
  }
}

function collectCodeImportTargets(code: string, targets: Set<string>) {
  collectBareImportTargets(code, targets)
  collectImportFromTargets(code, targets)
  collectExportFromTargets(code, targets)
  collectRequireTargets(code, targets)
  collectDynamicImportTargets(code, targets)
}

function addCodeImporters(
  codeImporters: Map<string, Set<string>>,
  code: string | undefined,
  importer: string,
) {
  if (!code) {
    return
  }

  const targets = new Set<string>()
  collectCodeImportTargets(code, targets)

  for (const target of targets) {
    if (!target || !target.startsWith('.')) {
      continue
    }
    const imported = path.normalize(path.join(path.dirname(importer), target))
    addDirectImporter(codeImporters, imported, importer)
  }
}

function removeImporterFromCodeImporters(
  codeImporters: Map<string, Set<string>>,
  importer: string,
) {
  for (const [target, importers] of codeImporters) {
    importers.delete(importer)
    if (!importers.size) {
      codeImporters.delete(target)
    }
  }
}

function replaceInArray(
  list: string[] | undefined,
  searchValues: readonly string[],
  replaceValue: string,
  shouldInsert?: boolean,
) {
  const values = Array.isArray(list) ? [...list] : []
  let replaced = false
  for (let index = 0; index < values.length; index++) {
    const current = values[index]
    if (searchValues.includes(current)) {
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
  originalFileNames: readonly string[],
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
      let hadOriginal = false
      for (const originalFileName of originalFileNames) {
        hadOriginal = collection.delete(originalFileName) || hadOriginal
      }
      if (hadOriginal || shouldInsert) {
        collection.add(newChunkFile)
      }
    }
    else if (Array.isArray(collection)) {
      metadata[key] = replaceInArray(collection, originalFileNames, newChunkFile, shouldInsert)
    }
    else if (collection instanceof Map) {
      let originalValue: unknown
      let hadOriginal = false
      for (const originalFileName of originalFileNames) {
        if (!collection.has(originalFileName)) {
          continue
        }
        if (!hadOriginal) {
          originalValue = collection.get(originalFileName)
        }
        hadOriginal = true
        collection.delete(originalFileName)
      }
      if (hadOriginal) {
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
  const codeImporters = new Map<string, Set<string>>()
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

    addCodeImporters(codeImporters, chunk.code, fileName)

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

  return { directImporters, codeImporters, chunks }
}

export function removeChunkFromImporterIndex(index: ChunkImporterIndex, fileName: string) {
  index.chunks.delete(fileName)
  index.directImporters.delete(fileName)
  removeImporterFromCodeImporters(index.codeImporters, fileName)
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
  originalFileNames: readonly string[],
  newChunkFile: string,
  shouldInsert: boolean,
) {
  if (!newChunkFile || originalFileNames.includes(newChunkFile)) {
    return
  }
  let hadOriginal = false
  for (const originalFileName of originalFileNames) {
    hadOriginal = index.directImporters.get(originalFileName)?.has(importerFile) === true || hadOriginal
    removeDirectImporter(index.directImporters, originalFileName, importerFile)
  }
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
  for (const importer of index.codeImporters.get(target) ?? []) {
    importers.add(importer)
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
    index += 1
  }

  return candidate
}

export function updateImporters(
  bundle: OutputBundle,
  importerToChunk: Map<string, string>,
  originalFileName: string | readonly string[],
  index?: ChunkImporterIndex,
) {
  const originalFileNames = Array.isArray(originalFileName)
    ? originalFileName
    : [originalFileName]
  for (const [importerFile, newChunkFile] of importerToChunk.entries()) {
    const importer = bundle[importerFile]
    if (!importer || importer.type !== 'chunk') {
      continue
    }

    const importerChunk = importer as OutputChunk
    const newImportPath = createRelativeImport(importerFile, newChunkFile)

    let codeUpdated = false
    for (const originalFileName of originalFileNames) {
      const originalImportPath = createRelativeImport(importerFile, originalFileName)
      if (originalImportPath === newImportPath) {
        continue
      }
      const updated = replaceAll(importerChunk.code, originalImportPath, newImportPath)
      if (updated !== importerChunk.code) {
        importerChunk.code = updated
        codeUpdated = true
      }
    }

    importerChunk.imports = replaceInArray(importerChunk.imports, originalFileNames, newChunkFile, codeUpdated)
    importerChunk.dynamicImports = replaceInArray(importerChunk.dynamicImports, originalFileNames, newChunkFile, codeUpdated)

    const implicitlyLoadedBefore = (importerChunk as any).implicitlyLoadedBefore
    if (Array.isArray(implicitlyLoadedBefore)) {
      (importerChunk as any).implicitlyLoadedBefore = replaceInArray(
        implicitlyLoadedBefore,
        originalFileNames,
        newChunkFile,
        codeUpdated,
      )
    }

    const referencedFiles = (importerChunk as any).referencedFiles
    if (Array.isArray(referencedFiles)) {
      (importerChunk as any).referencedFiles = replaceInArray(
        referencedFiles,
        originalFileNames,
        newChunkFile,
        codeUpdated,
      )
    }

    updateViteMetadata(importerChunk, originalFileNames, newChunkFile, codeUpdated)
    if (index) {
      updateChunkImporterIndex(index, importerFile, originalFileNames, newChunkFile, codeUpdated)
      if (codeUpdated) {
        removeImporterFromCodeImporters(index.codeImporters, importerFile)
        addCodeImporters(index.codeImporters, importerChunk.code, importerFile)
      }
    }
  }
}
