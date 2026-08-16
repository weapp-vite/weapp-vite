import type { OutputChunk } from 'rolldown'
import type { SharedChunkDuplicateDetail, SharedChunkRuntimeContext } from './types'
import { Buffer } from 'node:buffer'
import { posix as path } from 'pathe'
import { applyMagicStringChunkRewrite } from '../../../../utils/outputChunk'
import { resolveSubPackagePrefix } from '../../collector'
import { SUB_PACKAGE_SHARED_DIR } from '../../constants'
import {
  cloneSourceLike,
  collectSourceMapKeys,
  findSourceMapAsset,
  resolveEncodedSourceMap,
  resolveSourceMapSource,
} from '../../sourcemap'
import { createChunkImportSpecifiersRewrite, createChunkSourceFileNameCandidates, reserveUniqueFileName } from '../rewrite'
import { chunkReferencesRuntime } from '../runtime'

export const ROLLDOWN_RUNTIME_FILE_NAME = 'rolldown-runtime.js'
export const SLASHES_PATTERN = /[\\/]+/g

export function createCrossSubPackageDuplicateBaseName(sourceRoot: string, fileName: string) {
  const rootTag = sourceRoot.replace(SLASHES_PATTERN, '_')
  return `${rootTag}.${path.basename(fileName)}`
}

export function ensureLocalizedDuplicate(args: {
  runtimeContext: SharedChunkRuntimeContext
  pendingLocalizedDuplicates: Array<{
    root: string
    sourceFileName: string
    targetFileName: string
    chunk: OutputChunk
  }>
  root: string
  sourceFileName: string
}) {
  const { runtimeContext, pendingLocalizedDuplicates, root, sourceFileName } = args
  const sourceRoot = resolveSubPackagePrefix(sourceFileName, runtimeContext.subPackageRoots)
  if (!sourceRoot || sourceRoot === root) {
    return sourceFileName
  }

  const key = `${root}::${sourceFileName}`
  const existing = runtimeContext.localizedDuplicateFileMap.get(key)
  if (existing) {
    return existing
  }

  const sourceOutput = runtimeContext.bundle[sourceFileName]
  if (sourceOutput?.type !== 'chunk') {
    return sourceFileName
  }

  const duplicateBaseName = createCrossSubPackageDuplicateBaseName(sourceRoot, sourceFileName)
  const targetFileName = reserveUniqueFileName(runtimeContext.reservedFileNames, path.join(root, SUB_PACKAGE_SHARED_DIR, duplicateBaseName))
  runtimeContext.localizedDuplicateFileMap.set(key, targetFileName)
  pendingLocalizedDuplicates.push({
    root,
    sourceFileName,
    targetFileName,
    chunk: sourceOutput as OutputChunk,
  })
  return targetFileName
}

export function rewriteDuplicatedChunkSource(args: {
  runtimeContext: SharedChunkRuntimeContext
  pendingLocalizedDuplicates: Array<{
    root: string
    sourceFileName: string
    targetFileName: string
    chunk: OutputChunk
  }>
  root: string
  sourceFileName: string
  targetFileName: string
  chunk: OutputChunk
}) {
  const runtimeFileName = path.join(args.root, ROLLDOWN_RUNTIME_FILE_NAME)
  const sourceMapKeys = collectSourceMapKeys(args.sourceFileName, args.chunk)
  const sourceMapAssetInfo = findSourceMapAsset(args.runtimeContext.bundle, sourceMapKeys)
  const rewrittenChunk = {
    ...args.chunk,
    map: resolveEncodedSourceMap(args.chunk.map, sourceMapAssetInfo?.asset.source),
  } as OutputChunk
  const rewrite = createChunkImportSpecifiersRewrite(rewrittenChunk.code ?? '', {
    sourceFileNames: createChunkSourceFileNameCandidates(args.sourceFileName),
    targetFileName: args.targetFileName,
    imports: args.chunk.imports,
    dynamicImports: args.chunk.dynamicImports,
    runtimeFileName,
    resolveImportTarget: (specifier) => {
      return ensureLocalizedDuplicate({
        runtimeContext: args.runtimeContext,
        pendingLocalizedDuplicates: args.pendingLocalizedDuplicates,
        root: args.root,
        sourceFileName: specifier,
      })
    },
  })
  applyMagicStringChunkRewrite(rewrittenChunk, rewrite)

  for (const specifier of [...args.chunk.imports, ...args.chunk.dynamicImports]) {
    const localizedSpecifier = ensureLocalizedDuplicate({
      runtimeContext: args.runtimeContext,
      pendingLocalizedDuplicates: args.pendingLocalizedDuplicates,
      root: args.root,
      sourceFileName: specifier,
    })
    if (!localizedSpecifier || localizedSpecifier === specifier) {
      continue
    }
    const localizedRewrite = createChunkImportSpecifiersRewrite(rewrittenChunk.code, {
      sourceFileName: args.targetFileName,
      targetFileName: args.targetFileName,
      imports: [specifier],
      dynamicImports: [],
      runtimeFileName,
      resolveImportTarget: () => localizedSpecifier,
    })
    applyMagicStringChunkRewrite(rewrittenChunk, localizedRewrite)
  }

  return rewrittenChunk
}

export function emitDuplicatedChunkAsset(args: {
  runtimeContext: SharedChunkRuntimeContext
  pendingLocalizedDuplicates: Array<{
    root: string
    sourceFileName: string
    targetFileName: string
    chunk: OutputChunk
  }>
  emittedLocalizedDuplicateFiles: Set<string>
  root: string
  sourceFileName: string
  targetFileName: string
  chunk: OutputChunk
}) {
  if (args.emittedLocalizedDuplicateFiles.has(args.targetFileName)) {
    return
  }

  const duplicatedChunk = rewriteDuplicatedChunkSource({
    runtimeContext: args.runtimeContext,
    pendingLocalizedDuplicates: args.pendingLocalizedDuplicates,
    root: args.root,
    sourceFileName: args.sourceFileName,
    targetFileName: args.targetFileName,
    chunk: args.chunk,
  })
  args.runtimeContext.pluginContext.emitFile({
    type: 'asset',
    fileName: args.targetFileName,
    source: duplicatedChunk.code,
  })

  const sourceMapKeys = collectSourceMapKeys(args.sourceFileName, args.chunk)
  const sourceMapAssetInfo = findSourceMapAsset(args.runtimeContext.bundle, sourceMapKeys)
  const unchangedSourceMap = duplicatedChunk.code === args.chunk.code
    ? resolveSourceMapSource(args.chunk.map, sourceMapAssetInfo?.asset.source)
    : undefined
  if (duplicatedChunk.map) {
    const sourceMapFileName = reserveUniqueFileName(args.runtimeContext.reservedFileNames, `${args.targetFileName}.map`)
    args.runtimeContext.pluginContext.emitFile({
      type: 'asset',
      fileName: sourceMapFileName,
      source: JSON.stringify(duplicatedChunk.map),
    })
  }
  else if (unchangedSourceMap) {
    const sourceMapFileName = reserveUniqueFileName(args.runtimeContext.reservedFileNames, `${args.targetFileName}.map`)
    args.runtimeContext.pluginContext.emitFile({
      type: 'asset',
      fileName: sourceMapFileName,
      source: cloneSourceLike(unchangedSourceMap),
    })
  }

  args.emittedLocalizedDuplicateFiles.add(args.targetFileName)
}

export function buildDuplicateDiagnostics(args: {
  chunk: OutputChunk
  duplicates: SharedChunkDuplicateDetail[]
  redundantDuplicateCount: number
  sourceRoot?: string
}) {
  const chunkBytes = typeof args.chunk.code === 'string' ? Buffer.byteLength(args.chunk.code, 'utf8') : undefined
  const redundantBytes = typeof chunkBytes === 'number'
    ? chunkBytes * Math.max(args.redundantDuplicateCount, 0)
    : undefined
  const requiresRuntimeLocalization = chunkReferencesRuntime(
    args.chunk,
    ROLLDOWN_RUNTIME_FILE_NAME,
    new Set(
      args.sourceRoot
        ? [path.join(args.sourceRoot, ROLLDOWN_RUNTIME_FILE_NAME), ROLLDOWN_RUNTIME_FILE_NAME]
        : [ROLLDOWN_RUNTIME_FILE_NAME],
    ),
  )

  return {
    chunkBytes,
    redundantBytes,
    requiresRuntimeLocalization,
  }
}
