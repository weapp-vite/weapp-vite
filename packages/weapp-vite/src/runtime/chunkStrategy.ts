/* eslint-disable ts/no-use-before-define -- helper utilities are defined later in this module for clarity */
import type { OutputAsset, OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import type { SharedChunkStrategy } from '../types'
import { Buffer } from 'node:buffer'
import { posix as path } from 'pathe'

export const SHARED_CHUNK_VIRTUAL_PREFIX = 'weapp_shared_virtual'
export const SUB_PACKAGE_SHARED_DIR = 'weapp-shared'
export const DEFAULT_SHARED_CHUNK_STRATEGY: SharedChunkStrategy = 'hoist'

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

function getTakeImporters(moduleId: string) {
  return takeImportersMap.get(moduleId)
}

function markForceDuplicateSharedChunk(sharedName: string) {
  if (!sharedName) {
    return
  }
  forceDuplicateSharedChunks.add(sharedName)
  forceDuplicateSharedChunks.add(`${sharedName}.js`)
}

function isForceDuplicateSharedChunk(fileName: string) {
  return forceDuplicateSharedChunks.has(fileName)
}

interface SharedChunkDiagnostics {
  ignoredMainImporters: string[]
}

const sharedChunkDiagnostics = new Map<string, SharedChunkDiagnostics>()
const takeImportersMap = new Map<string, Set<string>>()
const forceDuplicateSharedChunks = new Set<string>()

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
  /**
   * Optional tester that returns true when the module should be treated as safe to duplicate
   * even if it lives in the main package directory. Receives the relative path (based on srcRoot)
   * and absolute id.
   */
  forceDuplicateTester?: (relativeId: string, absoluteId: string) => boolean
}

export function resolveSharedChunkName(options: ResolveSharedChunkNameOptions): string | undefined {
  const {
    id,
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    strategy,
    forceDuplicateTester,
  } = options

  const subPackageRootList = Array.from(subPackageRoots)
  const moduleInfo = ctx.getModuleInfo(id)
  const takeImporters = getTakeImporters(id)
  if (takeImporters?.size) {
    const takeSharedName = resolveTakeSharedChunkName({
      id,
      ctx,
      relativeAbsoluteSrcRoot,
      subPackageRoots: subPackageRootList,
      importers: Array.from(takeImporters),
    })
    if (takeSharedName) {
      return takeSharedName
    }
  }
  if (strategy === 'hoist') {
    const relativeId = relativeAbsoluteSrcRoot(id)
    const moduleRoot = resolveSubPackagePrefix(relativeId, subPackageRootList)

    if (moduleRoot) {
      assertModuleScopedToRoot({
        moduleInfo,
        moduleRoot,
        relativeAbsoluteSrcRoot,
        subPackageRoots: subPackageRootList,
        moduleId: id,
      })
      if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
        return undefined
      }
      return path.join(moduleRoot, 'common')
    }

    if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
      return undefined
    }
    return 'common'
  }

  if (!moduleInfo?.importers || moduleInfo.importers.length <= 1) {
    return undefined
  }

  const { summary, ignoredMainImporters } = summarizeImportPrefixes({
    ctx,
    importers: moduleInfo.importers,
    relativeAbsoluteSrcRoot,
    subPackageRoots: subPackageRootList,
    forceDuplicateTester,
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
    const sharedName = createSharedChunkNameFromKeys(keys)
    if (ignoredMainImporters.length) {
      sharedChunkDiagnostics.set(sharedName, {
        ignoredMainImporters: Array.from(new Set(ignoredMainImporters)),
      })
      sharedChunkDiagnostics.set(`${sharedName}.js`, {
        ignoredMainImporters: Array.from(new Set(ignoredMainImporters)),
      })
    }
    return sharedName
  }

  return 'common'
}

interface SummarizeOptions {
  ctx: ChunkingContextLike
  importers: string[]
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  forceDuplicateTester?: ResolveSharedChunkNameOptions['forceDuplicateTester']
}

interface CollectorResult {
  prefixes: string[]
  hasRealMain: boolean
  ignored: string[]
}

interface CollectorState {
  cache: Map<string, CollectorResult>
  stack: Set<string>
}

function summarizeImportPrefixes(options: SummarizeOptions) {
  const {
    ctx,
    importers,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    forceDuplicateTester,
  } = options
  const summary: Record<string, number> = {}
  const ignoredImporters = new Set<string>()
  const state: CollectorState = {
    cache: new Map(),
    stack: new Set(),
  }

  for (const importer of importers) {
    const { prefixes, ignored } = collectEffectivePrefixes(importer, {
      ctx,
      relativeAbsoluteSrcRoot,
      subPackageRoots,
      forceDuplicateTester,
    }, state)

    for (const prefix of prefixes) {
      summary[prefix] = (summary[prefix] || 0) + 1
    }

    for (const entry of ignored) {
      ignoredImporters.add(entry)
    }
  }

  return {
    summary,
    ignoredMainImporters: Array.from(ignoredImporters),
  }
}

interface CollectorOptions {
  ctx: ChunkingContextLike
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  forceDuplicateTester?: ResolveSharedChunkNameOptions['forceDuplicateTester']
}

function collectEffectivePrefixes(
  importer: string,
  options: CollectorOptions,
  state: CollectorState,
): CollectorResult {
  const cached = state.cache.get(importer)
  if (cached) {
    return {
      prefixes: [...cached.prefixes],
      hasRealMain: cached.hasRealMain,
      ignored: [...cached.ignored],
    }
  }

  if (state.stack.has(importer)) {
    return {
      prefixes: [''],
      hasRealMain: true,
      ignored: [],
    }
  }

  state.stack.add(importer)

  const {
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    forceDuplicateTester,
  } = options

  const relativeId = relativeAbsoluteSrcRoot(importer)
  const subPackagePrefix = resolveSubPackagePrefix(relativeId, subPackageRoots)

  if (subPackagePrefix) {
    const result: CollectorResult = {
      prefixes: [subPackagePrefix],
      hasRealMain: false,
      ignored: [],
    }
    state.cache.set(importer, result)
    state.stack.delete(importer)
    return {
      prefixes: [...result.prefixes],
      hasRealMain: result.hasRealMain,
      ignored: [],
    }
  }

  const moduleInfo = ctx.getModuleInfo(importer)
  const importerParents = moduleInfo?.importers ?? []
  const forcedDuplicate = forceDuplicateTester?.(relativeId, importer) ?? false

  if (!importerParents.length) {
    const result: CollectorResult = forcedDuplicate
      ? {
          prefixes: [],
          hasRealMain: false,
          ignored: [relativeId],
        }
      : {
          prefixes: [''],
          hasRealMain: true,
          ignored: [],
        }
    state.cache.set(importer, result)
    state.stack.delete(importer)
    return {
      prefixes: [...result.prefixes],
      hasRealMain: result.hasRealMain,
      ignored: [...result.ignored],
    }
  }

  const aggregatedPrefixes = new Set<string>()
  let hasRealMain = false
  const aggregatedIgnored: string[] = []

  for (const parent of importerParents) {
    const collectorResult = collectEffectivePrefixes(parent, options, state)
    for (const prefix of collectorResult.prefixes) {
      aggregatedPrefixes.add(prefix)
    }
    if (collectorResult.hasRealMain) {
      hasRealMain = true
    }
    if (collectorResult.ignored.length) {
      aggregatedIgnored.push(...collectorResult.ignored)
    }
  }

  if (!aggregatedPrefixes.size) {
    aggregatedPrefixes.add('')
    hasRealMain = true
  }

  const shouldIgnoreAsMain = !aggregatedPrefixes.has('') && importerParents.length > 0
  const ignored: string[] = shouldIgnoreAsMain || (forcedDuplicate && !aggregatedPrefixes.has(''))
    ? [relativeId]
    : []

  const result: CollectorResult = {
    prefixes: Array.from(aggregatedPrefixes),
    hasRealMain,
    ignored: Array.from(new Set([...aggregatedIgnored, ...ignored])),
  }

  state.cache.set(importer, result)
  state.stack.delete(importer)

  return {
    prefixes: [...result.prefixes],
    hasRealMain: result.hasRealMain,
    ignored: [...result.ignored],
  }
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

interface ResolveTakeSharedChunkNameOptions {
  id: string
  ctx: ChunkingContextLike
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  importers: string[]
}

function resolveTakeSharedChunkName(options: ResolveTakeSharedChunkNameOptions) {
  const {
    ctx,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    importers,
  } = options

  if (!importers.length) {
    return undefined
  }

  const { summary } = summarizeImportPrefixes({
    ctx,
    importers,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
  })

  const keys = Object.keys(summary).filter(Boolean)
  if (!keys.length) {
    return undefined
  }

  const sharedName = createSharedChunkNameFromKeys(keys)
  markForceDuplicateSharedChunk(sharedName)
  return sharedName
}

function createSharedChunkNameFromKeys(keys: string[]) {
  const sanitize = (value: string) => value.replace(/[\\/]+/g, '_')
  const combination = keys
    .filter(Boolean)
    .map(sanitize)
    .sort()
    .join('+')
  const combinationSegment = combination ? `${combination}/` : ''
  return `${SHARED_CHUNK_VIRTUAL_PREFIX}/${combinationSegment}common`
}

interface ModuleScopeAssertionOptions {
  moduleInfo: ModuleInfoLike | null
  moduleRoot: string
  relativeAbsoluteSrcRoot: (id: string) => string
  subPackageRoots: string[]
  moduleId: string
}

function assertModuleScopedToRoot(options: ModuleScopeAssertionOptions) {
  const {
    moduleInfo,
    moduleRoot,
    relativeAbsoluteSrcRoot,
    subPackageRoots,
    moduleId,
  } = options

  if (!moduleRoot || !moduleInfo?.importers?.length) {
    return
  }

  for (const importer of moduleInfo.importers) {
    const importerRoot = resolveSubPackagePrefix(relativeAbsoluteSrcRoot(importer), subPackageRoots)
    if (importerRoot !== moduleRoot) {
      const moduleLabel = relativeAbsoluteSrcRoot(moduleId)
      const importerLabel = relativeAbsoluteSrcRoot(importer)
      throw new Error(
        `[subpackages] 模块 "${moduleLabel}" 位于分包 "${moduleRoot}"，但被 "${importerLabel}" 引用，`
        + '请将该模块移动到主包或公共目录以进行跨分包共享。',
      )
    }
  }
}

export interface SharedChunkDuplicateDetail {
  fileName: string
  importers: string[]
}

export interface SharedChunkDuplicatePayload {
  sharedFileName: string
  duplicates: SharedChunkDuplicateDetail[]
  ignoredMainImporters?: string[]
  /**
   * @description 单份共享代码的字节数（不含 source map）
   */
  chunkBytes?: number
  /**
   * @description 除首份以外因复制产生的冗余字节数
   */
  redundantBytes?: number
  retainedInMain?: boolean
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
  if (options.strategy !== 'duplicate' && forceDuplicateSharedChunks.size === 0) {
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

    const sourceMapKeys = collectSourceMapKeys(fileName, chunk)
    const sourceMapAssetInfo = findSourceMapAsset(bundle, sourceMapKeys)
    const resolvedSourceMap = resolveSourceMapSource(originalMap, sourceMapAssetInfo?.asset.source)
    const importerMap = new Map<string, { newFileName: string, importers: string[] }>()
    const mainImporters: string[] = []
    let hasMainImporter = false
    const shouldForceDuplicate = isForceDuplicateSharedChunk(originalSharedFileName)

    for (const importerFile of importers) {
      const root = resolveSubPackagePrefix(importerFile, subPackageRoots)
      if (!root) {
        hasMainImporter = true
        mainImporters.push(importerFile)
        continue
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

    const importerToChunk = new Map<string, string>()
    const duplicates: SharedChunkDuplicateDetail[] = []
    const diagnostics = consumeSharedChunkDiagnostics(originalSharedFileName)
    const shouldRetainOriginalChunk = shouldForceDuplicate && hasMainImporter

    if ((hasMainImporter || importerMap.size === 0) && (!shouldForceDuplicate || importerMap.size === 0)) {
      // Degrade to placing chunk in main package by stripping virtual prefix.
      let finalFileName = chunk.fileName
      if (fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)) {
        const newFileName = fileName.slice(SHARED_CHUNK_VIRTUAL_PREFIX.length + 1)
        chunk.fileName = newFileName
        if (typeof chunk.sourcemapFileName === 'string' && chunk.sourcemapFileName) {
          chunk.sourcemapFileName = `${newFileName}.map`
        }
        const targetKey = `${newFileName}.map`
        emitSourceMapAsset(this, targetKey, sourceMapAssetInfo, resolvedSourceMap)
        for (const mapKey of sourceMapKeys) {
          if (!mapKey || mapKey === targetKey) {
            continue
          }
          if (bundle[mapKey]) {
            delete bundle[mapKey]
          }
        }
        finalFileName = newFileName
      }
      if (finalFileName !== originalSharedFileName) {
        const fallbackImporterMap = new Map<string, string>()
        for (const importerFile of importers) {
          fallbackImporterMap.set(importerFile, finalFileName)
        }
        updateImporters(bundle, fallbackImporterMap, originalSharedFileName)
      }
      options.onFallback?.({
        sharedFileName: originalSharedFileName,
        finalFileName,
        reason: hasMainImporter ? 'main-package' : 'no-subpackage',
        importers: [...importers],
      })
      continue
    }

    if (shouldRetainOriginalChunk && fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)) {
      const newFileName = fileName.slice(SHARED_CHUNK_VIRTUAL_PREFIX.length + 1)
      chunk.fileName = newFileName
      if (typeof chunk.sourcemapFileName === 'string' && chunk.sourcemapFileName) {
        chunk.sourcemapFileName = `${newFileName}.map`
      }
      const targetKey = `${newFileName}.map`
      emitSourceMapAsset(this, targetKey, sourceMapAssetInfo, resolvedSourceMap)
      for (const mapKey of sourceMapKeys) {
        if (!mapKey || mapKey === targetKey) {
          continue
        }
        if (bundle[mapKey]) {
          delete bundle[mapKey]
        }
      }
      if (mainImporters.length) {
        const mainImporterMap = new Map<string, string>()
        for (const importerFile of mainImporters) {
          mainImporterMap.set(importerFile, newFileName)
        }
        updateImporters(bundle, mainImporterMap, originalSharedFileName)
      }
      options.onFallback?.({
        sharedFileName: originalSharedFileName,
        finalFileName: newFileName,
        reason: 'main-package',
        importers: [...importers],
      })
    }
    for (const { newFileName, importers: importerFiles } of importerMap.values()) {
      this.emitFile({
        type: 'asset',
        fileName: newFileName,
        source: originalCode,
      })

      if (resolvedSourceMap) {
        this.emitFile({
          type: 'asset',
          fileName: `${newFileName}.map`,
          source: cloneSourceLike(resolvedSourceMap),
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

    if (!shouldRetainOriginalChunk) {
      delete bundle[fileName]

      for (const mapKey of sourceMapKeys) {
        if (mapKey && bundle[mapKey]) {
          delete bundle[mapKey]
        }
      }
    }

    const chunkBytes = typeof originalCode === 'string' ? Buffer.byteLength(originalCode, 'utf8') : undefined
    const redundantBytes = typeof chunkBytes === 'number'
      ? chunkBytes * Math.max(duplicates.length - 1, 0)
      : undefined

    options.onDuplicate?.({
      sharedFileName: originalSharedFileName,
      duplicates,
      ignoredMainImporters: diagnostics?.ignoredMainImporters,
      chunkBytes,
      redundantBytes,
      retainedInMain: shouldRetainOriginalChunk,
    })
  }
}

function consumeSharedChunkDiagnostics(fileName: string) {
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

function emitSourceMapAsset(
  ctx: PluginContext,
  targetFileName: string,
  sourceMapAssetInfo: SourceMapAssetInfo | undefined,
  fallbackSource: SourceLike | undefined,
) {
  if (!targetFileName) {
    return
  }

  if (sourceMapAssetInfo?.asset && isSourceLike(sourceMapAssetInfo.asset.source)) {
    ctx.emitFile({
      type: 'asset',
      fileName: targetFileName,
      source: cloneSourceLike(sourceMapAssetInfo.asset.source),
      name: sourceMapAssetInfo.asset.name,
    })
    return
  }

  if (fallbackSource) {
    ctx.emitFile({
      type: 'asset',
      fileName: targetFileName,
      source: cloneSourceLike(fallbackSource),
    })
  }
}

/**
 * @internal
 */
export function __clearSharedChunkDiagnosticsForTest() {
  resetTakeImportRegistry()
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

function containsImportSpecifier(source: string, specifier: string) {
  if (!specifier) {
    return false
  }
  if (source.includes(specifier)) {
    return true
  }
  if (specifier.startsWith('./')) {
    const trimmed = specifier.slice(2)
    if (trimmed && source.includes(trimmed)) {
      return true
    }
  }
  return false
}

function hasInCollection(collection: unknown, value: string) {
  if (!collection || !value) {
    return false
  }
  if (collection instanceof Set) {
    return collection.has(value)
  }
  if (Array.isArray(collection)) {
    return collection.includes(value)
  }
  if (collection instanceof Map) {
    return collection.has(value)
  }
  return false
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

function createRelativeImport(fromFile: string, toFile: string) {
  const relative = path.relative(path.dirname(fromFile), toFile)
  if (!relative || relative.startsWith('.')) {
    return relative || './'
  }
  return `./${relative}`
}

type SourceLike = string | Uint8Array | Buffer

function collectSourceMapKeys(fileName: string, chunk: OutputChunk): Set<string> {
  const keys = new Set<string>()
  if (fileName) {
    keys.add(`${fileName}.map`)
  }
  if (typeof chunk.sourcemapFileName === 'string' && chunk.sourcemapFileName) {
    keys.add(chunk.sourcemapFileName)
  }
  return keys
}

interface SourceMapAssetInfo {
  asset: OutputAsset
  key: string
}

function findSourceMapAsset(bundle: OutputBundle, candidateKeys: Set<string>): SourceMapAssetInfo | undefined {
  for (const key of candidateKeys) {
    if (!key) {
      continue
    }
    const entry = bundle[key]
    if (entry?.type === 'asset') {
      return {
        asset: entry as OutputAsset,
        key,
      }
    }
  }
  return undefined
}

function resolveSourceMapSource(
  originalMap: OutputChunk['map'],
  assetSource: unknown,
): SourceLike | undefined {
  if (originalMap) {
    if (typeof originalMap === 'string') {
      return originalMap
    }
    if (originalMap instanceof Uint8Array || Buffer.isBuffer(originalMap)) {
      return Buffer.from(originalMap)
    }
    return JSON.stringify(originalMap)
  }

  if (isSourceLike(assetSource)) {
    return cloneSourceLike(assetSource)
  }

  return undefined
}

function isSourceLike(source: unknown): source is SourceLike {
  return typeof source === 'string' || source instanceof Uint8Array || Buffer.isBuffer(source)
}

function cloneSourceLike(source: SourceLike): SourceLike {
  if (typeof source === 'string') {
    return source
  }
  return Buffer.from(source)
}
