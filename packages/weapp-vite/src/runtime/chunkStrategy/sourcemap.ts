import type { OutputAsset, OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import { Buffer } from 'node:buffer'

export type SourceLike = string | Uint8Array | Buffer

export interface SourceMapAssetInfo {
  asset: OutputAsset
  key: string
}

export function collectSourceMapKeys(fileName: string, chunk: OutputChunk): Set<string> {
  const keys = new Set<string>()
  if (fileName) {
    keys.add(`${fileName}.map`)
  }
  if (typeof chunk.sourcemapFileName === 'string' && chunk.sourcemapFileName) {
    keys.add(chunk.sourcemapFileName)
  }
  return keys
}

export function findSourceMapAsset(bundle: OutputBundle, candidateKeys: Set<string>): SourceMapAssetInfo | undefined {
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

export function resolveSourceMapSource(
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

export function emitSourceMapAsset(
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

function isSourceLike(source: unknown): source is SourceLike {
  return typeof source === 'string' || source instanceof Uint8Array || Buffer.isBuffer(source)
}

export function cloneSourceLike(source: SourceLike): SourceLike {
  if (typeof source === 'string') {
    return source
  }
  return Buffer.from(source)
}
