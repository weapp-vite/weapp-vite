/* eslint-disable ts/no-use-before-define -- helper utilities are defined later in this module for clarity */
import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import type { SharedChunkStrategy } from '../types'
import { posix as path } from 'pathe'

export const SHARED_CHUNK_VIRTUAL_PREFIX = '__weapp_shared__'
export const SUB_PACKAGE_SHARED_DIR = '__shared__'
export const DEFAULT_SHARED_CHUNK_STRATEGY: SharedChunkStrategy = 'duplicate'

interface ModuleInfoLike {
  importers?: string[]
}

interface ChunkingContextLike {
  getModuleInfo: (id: string) => ModuleInfoLike | null
}

export interface ResolveSharedChunkNameOptions {
  id: string
  ctx: ChunkingContextLike
  subPackageRoots: Iterable<string>
  relativeAbsoluteSrcRoot: (id: string) => string
  strategy: SharedChunkStrategy
}

export function resolveSharedChunkName(options: ResolveSharedChunkNameOptions): string | undefined {
  const {
    id,
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    strategy,
  } = options

  const moduleInfo = ctx.getModuleInfo(id)
  if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
    return undefined
  }

  const summary = summarizeImportPrefixes({
    importers: moduleInfo.importers,
    relativeAbsoluteSrcRoot,
    subPackageRoots: Array.from(subPackageRoots),
  })

  const keys = Object.keys(summary)
  if (keys.length === 0) {
    return undefined
  }

  if (keys.length === 1) {
    const prefix = keys[0]
    return prefix ? path.join(prefix, 'common') : 'common'
  }

  const hasMainImporter = keys.includes('')
  if (strategy === 'duplicate' && !hasMainImporter) {
    const combination = keys
      .filter(Boolean)
      .sort()
      .join('+')
    const combinationSegment = combination ? `${combination}/` : ''
    return `${SHARED_CHUNK_VIRTUAL_PREFIX}/${combinationSegment}common`
  }

  return 'common'
}

interface SummarizeOptions {
  importers: string[]
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
}

function summarizeImportPrefixes(options: SummarizeOptions) {
  const { importers, relativeAbsoluteSrcRoot, subPackageRoots } = options
  const summary: Record<string, number> = {}

  for (const importer of importers) {
    const relPath = relativeAbsoluteSrcRoot(importer)
    const prefix = resolveSubPackagePrefix(relPath, subPackageRoots)
    summary[prefix] = (summary[prefix] || 0) + 1
  }

  return summary
}

function resolveSubPackagePrefix(fileName: string, subPackageRoots: string[]): string {
  for (const root of subPackageRoots) {
    if (!root) {
      continue
    }
    if (fileName === root || fileName.startsWith(`${root}/`)) {
      return root
    }
  }
  return ''
}

export interface SharedChunkDuplicateDetail {
  fileName: string
  importers: string[]
}

export interface SharedChunkDuplicatePayload {
  sharedFileName: string
  duplicates: SharedChunkDuplicateDetail[]
}

export type SharedChunkFallbackReason = 'main-package' | 'no-subpackage'

export interface SharedChunkFallbackPayload {
  sharedFileName: string
  finalFileName: string
  reason: SharedChunkFallbackReason
  importers: string[]
}

export interface ApplySharedChunkStrategyOptions {
  strategy: SharedChunkStrategy
  subPackageRoots: Iterable<string>
  onDuplicate?: (payload: SharedChunkDuplicatePayload) => void
  onFallback?: (payload: SharedChunkFallbackPayload) => void
}

export function applySharedChunkStrategy(
  this: PluginContext | undefined,
  bundle: OutputBundle,
  options: ApplySharedChunkStrategyOptions,
) {
  if (options.strategy !== 'duplicate') {
    return
  }

  if (!this) {
    throw new Error('applySharedChunkStrategy requires plugin context')
  }

  const subPackageRoots = Array.from(options.subPackageRoots).filter(Boolean)

  const entries = Object.entries(bundle)
  for (const [fileName, output] of entries) {
    if (!isSharedVirtualChunk(fileName, output)) {
      continue
    }

    const originalSharedFileName = fileName
    const chunk = output as OutputChunk
    const originalCode = chunk.code
    const originalMap = chunk.map
    const importers = findChunkImporters(bundle, fileName)
    if (importers.length === 0) {
      continue
    }

    const importerMap = new Map<string, { newFileName: string, importers: string[] }>()
    let hasMainImporter = false

    for (const importerFile of importers) {
      const root = resolveSubPackagePrefix(importerFile, subPackageRoots)
      if (!root) {
        hasMainImporter = true
        break
      }

      const duplicateBaseName = path.basename(fileName)
      const intendedFileName = path.join(root, SUB_PACKAGE_SHARED_DIR, duplicateBaseName)
      const uniqueFileName = ensureUniqueFileName(bundle, intendedFileName)
      const existing = importerMap.get(root)
      if (existing) {
        existing.importers.push(importerFile)
      }
      else {
        importerMap.set(root, {
          newFileName: uniqueFileName,
          importers: [importerFile],
        })
      }
    }

    if (hasMainImporter || importerMap.size === 0) {
      // Degrade to placing chunk in main package by stripping virtual prefix.
      let finalFileName = chunk.fileName
      if (fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)) {
        const newFileName = fileName.slice(SHARED_CHUNK_VIRTUAL_PREFIX.length + 1)
        chunk.fileName = newFileName
        finalFileName = newFileName
      }
      options.onFallback?.({
        sharedFileName: originalSharedFileName,
        finalFileName,
        reason: hasMainImporter ? 'main-package' : 'no-subpackage',
        importers: [...importers],
      })
      continue
    }

    const importerToChunk = new Map<string, string>()
    const duplicates: SharedChunkDuplicateDetail[] = []
    for (const { newFileName, importers: importerFiles } of importerMap.values()) {
      this.emitFile({
        type: 'asset',
        fileName: newFileName,
        source: originalCode,
      })

      if (originalMap) {
        this.emitFile({
          type: 'asset',
          fileName: `${newFileName}.map`,
          source: typeof originalMap === 'string' ? originalMap : JSON.stringify(originalMap),
        })
      }

      for (const importerFile of importerFiles) {
        importerToChunk.set(importerFile, newFileName)
      }
      duplicates.push({
        fileName: newFileName,
        importers: [...importerFiles],
      })
    }

    updateImporters(bundle, importerToChunk, fileName)

    chunk.code = '// duplicated into sub-packages via weapp-vite chunk strategy\n'
    chunk.map = null
    chunk.sourcemapFileName = null
    chunk.imports = []
    chunk.dynamicImports = []
    chunk.exports = []
    chunk.moduleIds = []
    chunk.modules = {}

    options.onDuplicate?.({
      sharedFileName: originalSharedFileName,
      duplicates,
    })
  }
}

function isSharedVirtualChunk(fileName: string, output: OutputBundle[string]) {
  return output?.type === 'chunk' && fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)
}

function findChunkImporters(bundle: OutputBundle, target: string) {
  const importers = new Set<string>()

  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    if (chunk.imports.includes(target) || chunk.dynamicImports.includes(target)) {
      importers.add(fileName)
    }
  }

  return Array.from(importers)
}

function ensureUniqueFileName(bundle: OutputBundle, fileName: string) {
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

function updateImporters(
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

    if (originalImportPath !== newImportPath) {
      importerChunk.code = replaceAll(importerChunk.code, originalImportPath, newImportPath)
    }

    importerChunk.imports = replaceInArray(importerChunk.imports, originalFileName, newChunkFile)
    importerChunk.dynamicImports = replaceInArray(importerChunk.dynamicImports, originalFileName, newChunkFile)
  }
}

function replaceAll(source: string, searchValue: string, replaceValue: string) {
  if (!searchValue) {
    return source
  }
  if (source.includes(searchValue)) {
    return source.split(searchValue).join(replaceValue)
  }
  if (searchValue.startsWith('./') && replaceValue.startsWith('./')) {
    const trimmedSearch = searchValue.slice(2)
    const trimmedReplace = replaceValue.slice(2)
    if (trimmedSearch && source.includes(trimmedSearch)) {
      return source.split(trimmedSearch).join(trimmedReplace)
    }
  }
  return source
}

function replaceInArray(list: string[], searchValue: string, replaceValue: string) {
  return list.map((value) => {
    return value === searchValue ? replaceValue : value
  })
}

function createRelativeImport(fromFile: string, toFile: string) {
  const relative = path.relative(path.dirname(fromFile), toFile)
  if (!relative || relative.startsWith('.')) {
    return relative || './'
  }
  return `./${relative}`
}
