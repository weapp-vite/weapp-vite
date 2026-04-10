import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import type { SharedChunkDuplicateDetail, SharedChunkDuplicatePayload } from './types'
import { posix as path } from 'pathe'
import { findChunkImporters, updateImporters } from '../../bundle'
import { resolveSubPackagePrefix } from '../../collector'
import { SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from '../../constants'
import { cloneSourceLike, collectSourceMapKeys, findSourceMapAsset, resolveSourceMapSource } from '../../sourcemap'
import { reserveUniqueFileName, rewriteChunkImportSpecifiersInCode } from '../rewrite'
import {
  buildDuplicateDiagnostics,
  createCrossSubPackageDuplicateBaseName,
  ROLLDOWN_RUNTIME_FILE_NAME,
} from './runtime'

export function localizeCrossSubPackageChunkLeaks(
  this: PluginContext,
  bundle: OutputBundle,
  options: {
    subPackageRoots: string[]
    reservedFileNames: Set<string>
    localizedDuplicateFileMap: Map<string, string>
    onDuplicate?: (payload: SharedChunkDuplicatePayload) => void
  },
) {
  const { subPackageRoots, reservedFileNames, localizedDuplicateFileMap, onDuplicate } = options
  if (subPackageRoots.length === 0) {
    return
  }

  const entries = Object.entries(bundle)
  for (const [fileName, output] of entries) {
    if (output?.type !== 'chunk') {
      continue
    }
    if (fileName.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`)) {
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
      const duplicateKey = `${targetRoot}::${fileName}`
      const existingDuplicateFileName = localizedDuplicateFileMap.get(duplicateKey)
      const uniqueFileName = existingDuplicateFileName ?? (() => {
        const duplicateBaseName = createCrossSubPackageDuplicateBaseName(sourceRoot, fileName)
        const intendedFileName = path.join(targetRoot, SUB_PACKAGE_SHARED_DIR, duplicateBaseName)
        const createdFileName = reserveUniqueFileName(reservedFileNames, intendedFileName)
        localizedDuplicateFileMap.set(duplicateKey, createdFileName)
        return createdFileName
      })()
      const runtimeFileName = path.join(targetRoot, ROLLDOWN_RUNTIME_FILE_NAME)
      if (!existingDuplicateFileName) {
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
    const diagnostics = buildDuplicateDiagnostics({
      chunk,
      duplicates,
      redundantDuplicateCount: duplicates.length,
      sourceRoot,
    })

    onDuplicate?.({
      sharedFileName: fileName,
      duplicates,
      requiresRuntimeLocalization: diagnostics.requiresRuntimeLocalization,
      chunkBytes: diagnostics.chunkBytes,
      redundantBytes: diagnostics.redundantBytes,
      retainedInMain: true,
    })
  }
}
