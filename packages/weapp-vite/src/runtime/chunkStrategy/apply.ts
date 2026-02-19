import type { OutputAsset, OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import type { SharedChunkStrategy } from '../../types'
import { Buffer } from 'node:buffer'
import { posix as path } from 'pathe'
import { ensureUniqueFileName, findChunkImporters, updateImporters } from './bundle'
import { resolveSubPackagePrefix } from './collector'
import { SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from './constants'
import {
  cloneSourceLike,
  collectSourceMapKeys,
  emitSourceMapAsset,
  findSourceMapAsset,
  resolveSourceMapSource,
} from './sourcemap'
import { consumeSharedChunkDiagnostics, hasForceDuplicateSharedChunks, isForceDuplicateSharedChunk } from './state'
import { replaceAll } from './utils'

const ROLLDOWN_RUNTIME_FILE_NAME = 'rolldown-runtime.js'

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

export interface RuntimeChunkDuplicateDetail {
  fileName: string
  importers: string[]
}

export interface RuntimeChunkDuplicatePayload {
  runtimeFileName: string
  duplicates: RuntimeChunkDuplicateDetail[]
}

export interface ApplyRuntimeChunkLocalizationOptions {
  subPackageRoots: Iterable<string>
  runtimeFileName?: string
  onDuplicate?: (payload: RuntimeChunkDuplicatePayload) => void
}

export function applySharedChunkStrategy(
  this: PluginContext | undefined,
  bundle: OutputBundle,
  options: ApplySharedChunkStrategyOptions,
) {
  if (options.strategy !== 'duplicate' && !hasForceDuplicateSharedChunks()) {
    return
  }

  if (!this) {
    throw new Error('applySharedChunkStrategy 需要 PluginContext。')
  }

  const subPackageRoots = Array.from(options.subPackageRoots).filter(Boolean)
  const reservedFileNames = new Set(Object.keys(bundle))

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
      const uniqueFileName = reserveUniqueFileName(reservedFileNames, intendedFileName)
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
      // 回退：移除虚拟前缀，将 chunk 放回主包输出路径
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
    for (const [root, { newFileName, importers: importerFiles }] of importerMap.entries()) {
      const runtimeFileName = path.join(root, ROLLDOWN_RUNTIME_FILE_NAME)
      const duplicatedSource = rewriteRuntimeImportInCode(originalCode, {
        fromFileName: newFileName,
        runtimeFileName,
      })
      this.emitFile({
        type: 'asset',
        fileName: newFileName,
        source: duplicatedSource,
      })

      if (resolvedSourceMap) {
        const sourceMapFileName = reserveUniqueFileName(reservedFileNames, `${newFileName}.map`)
        this.emitFile({
          type: 'asset',
          fileName: sourceMapFileName,
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

  localizeCrossSubPackageChunkLeaks.call(this, bundle, {
    subPackageRoots,
    reservedFileNames,
    onDuplicate: options.onDuplicate,
  })
}

function isSharedVirtualChunk(fileName: string, output: OutputBundle[string]) {
  return output?.type === 'chunk' && fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)
}

function localizeCrossSubPackageChunkLeaks(
  this: PluginContext,
  bundle: OutputBundle,
  options: {
    subPackageRoots: string[]
    reservedFileNames: Set<string>
    onDuplicate?: (payload: SharedChunkDuplicatePayload) => void
  },
) {
  const { subPackageRoots, reservedFileNames, onDuplicate } = options
  if (subPackageRoots.length === 0) {
    return
  }

  const entries = Object.entries(bundle)
  for (const [fileName, output] of entries) {
    if (output?.type !== 'chunk') {
      continue
    }
    if (isSharedVirtualChunk(fileName, output)) {
      continue
    }
    if (path.basename(fileName) === ROLLDOWN_RUNTIME_FILE_NAME) {
      continue
    }

    const sourceRoot = resolveSubPackagePrefix(fileName, subPackageRoots)
    if (!sourceRoot) {
      continue
    }

    const importers = findChunkImporters(bundle, fileName)
    if (importers.length === 0) {
      continue
    }

    const crossRootImporters = new Map<string, string[]>()
    for (const importerFile of importers) {
      const importerRoot = resolveSubPackagePrefix(importerFile, subPackageRoots)
      if (!importerRoot || importerRoot === sourceRoot) {
        continue
      }
      const list = crossRootImporters.get(importerRoot)
      if (list) {
        list.push(importerFile)
      }
      else {
        crossRootImporters.set(importerRoot, [importerFile])
      }
    }

    if (crossRootImporters.size === 0) {
      continue
    }
    const chunk = output as OutputChunk
    const sourceMapKeys = collectSourceMapKeys(fileName, chunk)
    const sourceMapAssetInfo = findSourceMapAsset(bundle, sourceMapKeys)
    const resolvedSourceMap = resolveSourceMapSource(chunk.map, sourceMapAssetInfo?.asset.source)
    const importerToChunk = new Map<string, string>()
    const duplicates: SharedChunkDuplicateDetail[] = []

    for (const [targetRoot, importerFiles] of crossRootImporters.entries()) {
      const duplicateBaseName = createCrossSubPackageDuplicateBaseName(sourceRoot, fileName)
      const intendedFileName = path.join(targetRoot, SUB_PACKAGE_SHARED_DIR, duplicateBaseName)
      const uniqueFileName = reserveUniqueFileName(reservedFileNames, intendedFileName)
      const runtimeFileName = path.join(targetRoot, ROLLDOWN_RUNTIME_FILE_NAME)
      const duplicatedSource = rewriteChunkImportSpecifiersInCode(chunk.code ?? '', {
        sourceFileName: fileName,
        targetFileName: uniqueFileName,
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        runtimeFileName,
      })
      this.emitFile({
        type: 'asset',
        fileName: uniqueFileName,
        source: duplicatedSource,
      })

      if (resolvedSourceMap) {
        const sourceMapFileName = reserveUniqueFileName(reservedFileNames, `${uniqueFileName}.map`)
        this.emitFile({
          type: 'asset',
          fileName: sourceMapFileName,
          source: cloneSourceLike(resolvedSourceMap),
        })
      }

      for (const importerFile of importerFiles) {
        importerToChunk.set(importerFile, uniqueFileName)
      }
      duplicates.push({
        fileName: uniqueFileName,
        importers: [...importerFiles],
      })
    }

    updateImporters(bundle, importerToChunk, fileName)
    const chunkBytes = typeof chunk.code === 'string' ? Buffer.byteLength(chunk.code, 'utf8') : undefined
    const redundantBytes = typeof chunkBytes === 'number'
      ? chunkBytes * duplicates.length
      : undefined

    onDuplicate?.({
      sharedFileName: fileName,
      duplicates,
      chunkBytes,
      redundantBytes,
      retainedInMain: true,
    })
  }
}

function createCrossSubPackageDuplicateBaseName(sourceRoot: string, fileName: string) {
  const rootTag = sourceRoot.replace(/[\\/]+/g, '_')
  return `${rootTag}.${path.basename(fileName)}`
}

function reserveUniqueFileName(reservedFileNames: Set<string>, fileName: string) {
  if (!reservedFileNames.has(fileName)) {
    reservedFileNames.add(fileName)
    return fileName
  }

  const { dir, name, ext } = path.parse(fileName)
  let index = 1
  let candidate = fileName
  while (reservedFileNames.has(candidate)) {
    const nextName = `${name}.${index}`
    candidate = dir ? path.join(dir, `${nextName}${ext}`) : `${nextName}${ext}`
    index += 1
  }
  reservedFileNames.add(candidate)
  return candidate
}

export function applyRuntimeChunkLocalization(
  this: PluginContext | undefined,
  bundle: OutputBundle,
  options: ApplyRuntimeChunkLocalizationOptions,
) {
  if (!this) {
    throw new Error('applyRuntimeChunkLocalization 需要 PluginContext。')
  }

  const runtimeFileName = options.runtimeFileName ?? ROLLDOWN_RUNTIME_FILE_NAME
  const runtimeRecord = resolveRuntimeBundleRecord(bundle, runtimeFileName)
  if (!runtimeRecord) {
    return
  }
  const { output: runtimeOutput, lookupKeys: runtimeLookupKeys } = runtimeRecord

  const runtimeSource = resolveRuntimeSource(runtimeOutput)
  if (!runtimeSource) {
    return
  }

  const subPackageRoots = Array.from(options.subPackageRoots).filter(Boolean)
  if (!subPackageRoots.length) {
    return
  }

  const runtimeLookupSet = new Set(runtimeLookupKeys)
  const rootToImporters = new Map<string, string[]>()
  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const root = resolveSubPackagePrefix(fileName, subPackageRoots)
    if (!root) {
      continue
    }
    if (!chunkReferencesRuntime(output as OutputChunk, runtimeFileName, runtimeLookupSet)) {
      continue
    }

    const existing = rootToImporters.get(root)
    if (existing) {
      existing.push(fileName)
    }
    else {
      rootToImporters.set(root, [fileName])
    }
  }

  if (!rootToImporters.size) {
    return
  }

  const importerToRuntime = new Map<string, string>()
  const duplicates: RuntimeChunkDuplicateDetail[] = []

  for (const [root, importerFiles] of rootToImporters.entries()) {
    const duplicateBaseName = path.basename(runtimeFileName)
    const intendedFileName = path.join(root, duplicateBaseName)
    const uniqueFileName = ensureUniqueFileName(bundle, intendedFileName)

    this.emitFile({
      type: 'asset',
      fileName: uniqueFileName,
      source: cloneSourceLike(runtimeSource),
    })

    for (const importerFile of importerFiles) {
      importerToRuntime.set(importerFile, uniqueFileName)
    }
    duplicates.push({
      fileName: uniqueFileName,
      importers: [...importerFiles],
    })
  }

  for (const target of runtimeLookupKeys) {
    updateImporters(bundle, importerToRuntime, target)
  }
  options.onDuplicate?.({
    runtimeFileName,
    duplicates,
  })
}

function resolveRuntimeBundleRecord(
  bundle: OutputBundle,
  runtimeFileName: string,
): { output: OutputChunk | OutputAsset, lookupKeys: string[] } | undefined {
  const direct = bundle[runtimeFileName]
  if (isRuntimeBundleOutput(direct)) {
    const directFileName = resolveBundleOutputFileName(direct, runtimeFileName)
    return {
      output: direct,
      lookupKeys: dedupeLookupKeys([runtimeFileName, directFileName]),
    }
  }

  for (const [key, output] of Object.entries(bundle)) {
    if (!isRuntimeBundleOutput(output)) {
      continue
    }
    const fileName = resolveBundleOutputFileName(output, key)
    if (fileName !== runtimeFileName && path.basename(fileName) !== runtimeFileName) {
      continue
    }
    return {
      output,
      lookupKeys: dedupeLookupKeys([runtimeFileName, key, fileName]),
    }
  }

  return undefined
}

function resolveRuntimeSource(output: OutputChunk | OutputAsset) {
  if (output.type === 'chunk') {
    return output.code || undefined
  }
  if (typeof output.source === 'string' || output.source instanceof Uint8Array || Buffer.isBuffer(output.source)) {
    return output.source
  }
  if (output.source == null) {
    return undefined
  }
  return String(output.source)
}

function chunkReferencesRuntime(
  chunk: OutputChunk,
  runtimeFileName: string,
  runtimeLookupSet: Set<string>,
) {
  const hasRuntimeReference = (specifier: string) =>
    runtimeLookupSet.has(specifier) || path.basename(specifier) === runtimeFileName

  if (chunk.imports.some(hasRuntimeReference) || chunk.dynamicImports.some(hasRuntimeReference)) {
    return true
  }

  const metadata = (chunk as any).viteMetadata
  if (metadata) {
    const importedChunks = metadata.importedChunks
    if (hasInCollection(importedChunks, runtimeFileName)) {
      return true
    }
    for (const lookupKey of runtimeLookupSet) {
      if (hasInCollection(importedChunks, lookupKey)) {
        return true
      }
    }

    const importedScripts = metadata.importedScripts ?? metadata.importedScriptsByUrl
    if (hasInCollection(importedScripts, runtimeFileName)) {
      return true
    }
    for (const lookupKey of runtimeLookupSet) {
      if (hasInCollection(importedScripts, lookupKey)) {
        return true
      }
    }
  }

  return (chunk.code ?? '').includes(runtimeFileName)
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

function resolveBundleOutputFileName(output: OutputChunk | OutputAsset, fallback: string) {
  if (typeof output.fileName === 'string' && output.fileName) {
    return output.fileName
  }
  return fallback
}

function dedupeLookupKeys(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function isRuntimeBundleOutput(output: OutputBundle[string] | undefined): output is OutputChunk | OutputAsset {
  return output?.type === 'chunk' || output?.type === 'asset'
}

function rewriteRuntimeImportInCode(
  sourceCode: string,
  options: {
    fromFileName: string
    runtimeFileName: string
  },
) {
  const { fromFileName, runtimeFileName } = options
  if (!sourceCode.includes(ROLLDOWN_RUNTIME_FILE_NAME)) {
    return sourceCode
  }

  const importPath = createRelativeImportPath(fromFileName, runtimeFileName)
  if (!importPath) {
    return sourceCode
  }

  return sourceCode.replace(
    /(['"`])([^'"`]*rolldown-runtime\.js)\1/g,
    (_match, quote: string) => `${quote}${importPath}${quote}`,
  )
}

function rewriteChunkImportSpecifiersInCode(
  sourceCode: string,
  options: {
    sourceFileName: string
    targetFileName: string
    imports: string[]
    dynamicImports: string[]
    runtimeFileName: string
  },
) {
  const { sourceFileName, targetFileName, imports, dynamicImports, runtimeFileName } = options
  const specifiers = new Set([...imports, ...dynamicImports].filter(Boolean))
  let rewrittenCode = sourceCode
  for (const specifier of specifiers) {
    const sourceImportPath = createRelativeImportPath(sourceFileName, specifier)
    if (!sourceImportPath) {
      continue
    }
    const resolvedTargetSpecifier = path.basename(specifier) === ROLLDOWN_RUNTIME_FILE_NAME
      ? runtimeFileName
      : specifier
    const targetImportPath = createRelativeImportPath(targetFileName, resolvedTargetSpecifier)
    if (!targetImportPath || sourceImportPath === targetImportPath) {
      continue
    }
    rewrittenCode = replaceAll(rewrittenCode, sourceImportPath, targetImportPath)
  }
  return rewrittenCode
}

function createRelativeImportPath(fromFileName: string, toFileName: string) {
  const relativePath = path.relative(path.dirname(fromFileName), toFileName)
  if (!relativePath || relativePath.startsWith('.')) {
    return relativePath || './'
  }
  return `./${relativePath}`
}
