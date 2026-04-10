/* eslint-disable ts/no-use-before-define */
import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import type {
  ApplySharedChunkStrategyOptions,
  SharedChunkDuplicateDetail,
  SharedChunkRuntimeContext,
} from './shared/types'
import { posix as path } from 'pathe'
import { findChunkImporters, updateImporters } from '../bundle'
import { resolveSubPackagePrefix } from '../collector'
import { SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from '../constants'
import {
  collectSourceMapKeys,
  emitSourceMapAsset,
  findSourceMapAsset,
  resolveSourceMapSource,
} from '../sourcemap'
import { consumeSharedChunkDiagnostics, hasForceDuplicateSharedChunks, isForceDuplicateSharedChunk } from '../state'
import { createChunkSourceFileNameCandidates, reserveUniqueFileName, rewriteChunkImportSpecifiersInCode } from './rewrite'
import { localizeCrossSubPackageChunkLeaks } from './shared/leaks'
import {
  buildDuplicateDiagnostics,
  emitDuplicatedChunkAsset,
  ROLLDOWN_RUNTIME_FILE_NAME,
} from './shared/runtime'

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
  const localizedDuplicateFileMap = new Map<string, string>()
  const runtimeContext: SharedChunkRuntimeContext = {
    pluginContext: this,
    bundle,
    subPackageRoots,
    reservedFileNames,
    localizedDuplicateFileMap,
  }
  const pendingLocalizedDuplicates: Array<{
    root: string
    sourceFileName: string
    targetFileName: string
    chunk: OutputChunk
  }> = []
  const emittedLocalizedDuplicateFiles = new Set<string>()

  const entries = Object.entries(bundle)
  for (const [fileName, output] of entries) {
    if (!isSharedVirtualChunk(fileName, output)) {
      continue
    }

    const originalSharedFileName = fileName
    const chunk = output as OutputChunk
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
      emitDuplicatedChunkAsset({
        runtimeContext,
        pendingLocalizedDuplicates,
        emittedLocalizedDuplicateFiles,
        root,
        sourceFileName: fileName,
        targetFileName: newFileName,
        chunk,
      })

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

    const duplicateDiagnostics = buildDuplicateDiagnostics({
      chunk,
      duplicates,
      redundantDuplicateCount: Math.max(duplicates.length - 1, 0),
    })

    options.onDuplicate?.({
      sharedFileName: originalSharedFileName,
      duplicates,
      ignoredMainImporters: diagnostics?.ignoredMainImporters,
      requiresRuntimeLocalization: duplicateDiagnostics.requiresRuntimeLocalization,
      chunkBytes: duplicateDiagnostics.chunkBytes,
      redundantBytes: duplicateDiagnostics.redundantBytes,
      retainedInMain: shouldRetainOriginalChunk,
    })
  }

  localizeCrossSubPackageChunkLeaks.call(this, bundle, {
    subPackageRoots,
    reservedFileNames,
    localizedDuplicateFileMap,
    onDuplicate: options.onDuplicate,
  })

  for (const task of pendingLocalizedDuplicates) {
    emitDuplicatedChunkAsset({
      runtimeContext,
      pendingLocalizedDuplicates,
      emittedLocalizedDuplicateFiles,
      ...task,
    })
  }
}

function isSharedVirtualChunk(fileName: string, output: OutputBundle[string]) {
  return output?.type === 'chunk' && fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)
}

export type {
  ApplySharedChunkStrategyOptions,
  SharedChunkDuplicateDetail,
  SharedChunkDuplicatePayload,
  SharedChunkFallbackPayload,
  SharedChunkFallbackReason,
} from './shared/types'
