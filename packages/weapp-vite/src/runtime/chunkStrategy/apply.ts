import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
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
  if (options.strategy !== 'duplicate' && !hasForceDuplicateSharedChunks()) {
    return
  }

  if (!this) {
    throw new Error('applySharedChunkStrategy 需要 PluginContext。')
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

function isSharedVirtualChunk(fileName: string, output: OutputBundle[string]) {
  return output?.type === 'chunk' && fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)
}
