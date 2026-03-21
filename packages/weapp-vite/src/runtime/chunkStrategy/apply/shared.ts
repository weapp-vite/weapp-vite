import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import type { SharedChunkStrategy } from '../../../types'
import { Buffer } from 'node:buffer'
import { posix as path } from 'pathe'
import { findChunkImporters, updateImporters } from '../bundle'
import { resolveSubPackagePrefix } from '../collector'
import { SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from '../constants'
import {
  cloneSourceLike,
  collectSourceMapKeys,
  emitSourceMapAsset,
  findSourceMapAsset,
  resolveSourceMapSource,
} from '../sourcemap'
import { consumeSharedChunkDiagnostics, hasForceDuplicateSharedChunks, isForceDuplicateSharedChunk } from '../state'
import { createChunkSourceFileNameCandidates, reserveUniqueFileName, rewriteChunkImportSpecifiersInCode } from './rewrite'
import { chunkReferencesRuntime } from './runtime'

const ROLLDOWN_RUNTIME_FILE_NAME = 'rolldown-runtime.js'
const SLASHES_PATTERN = /[\\/]+/g

export interface SharedChunkDuplicateDetail {
  fileName: string
  importers: string[]
}

export interface SharedChunkDuplicatePayload {
  sharedFileName: string
  duplicates: SharedChunkDuplicateDetail[]
  ignoredMainImporters?: string[]
  requiresRuntimeLocalization?: boolean
  chunkBytes?: number
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
      let finalFileName = chunk.fileName
      if (fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)) {
        const newFileName = fileName.slice(SHARED_CHUNK_VIRTUAL_PREFIX.length + 1)
        chunk.code = rewriteChunkImportSpecifiersInCode(chunk.code ?? '', {
          sourceFileNames: createChunkSourceFileNameCandidates(fileName),
          targetFileName: newFileName,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          runtimeFileName: ROLLDOWN_RUNTIME_FILE_NAME,
        })
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
      chunk.code = rewriteChunkImportSpecifiersInCode(chunk.code ?? '', {
        sourceFileNames: createChunkSourceFileNameCandidates(fileName),
        targetFileName: newFileName,
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        runtimeFileName: ROLLDOWN_RUNTIME_FILE_NAME,
      })
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
      const duplicatedSource = rewriteChunkImportSpecifiersInCode(originalCode, {
        sourceFileNames: createChunkSourceFileNameCandidates(fileName),
        targetFileName: newFileName,
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
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
    const requiresRuntimeLocalization = chunkReferencesRuntime(
      chunk,
      ROLLDOWN_RUNTIME_FILE_NAME,
      new Set([ROLLDOWN_RUNTIME_FILE_NAME]),
    )

    options.onDuplicate?.({
      sharedFileName: originalSharedFileName,
      duplicates,
      ignoredMainImporters: diagnostics?.ignoredMainImporters,
      requiresRuntimeLocalization,
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
    const requiresRuntimeLocalization = chunkReferencesRuntime(
      chunk,
      ROLLDOWN_RUNTIME_FILE_NAME,
      new Set([path.join(sourceRoot, ROLLDOWN_RUNTIME_FILE_NAME), ROLLDOWN_RUNTIME_FILE_NAME]),
    )

    onDuplicate?.({
      sharedFileName: fileName,
      duplicates,
      requiresRuntimeLocalization,
      chunkBytes,
      redundantBytes,
      retainedInMain: true,
    })
  }
}

function createCrossSubPackageDuplicateBaseName(sourceRoot: string, fileName: string) {
  const rootTag = sourceRoot.replace(SLASHES_PATTERN, '_')
  return `${rootTag}.${path.basename(fileName)}`
}
