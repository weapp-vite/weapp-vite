import type { OutputChunk } from 'rolldown'
import type { NativeNpmChunkAnalysis } from '../../../../../ast'
import type { NpmChunkTextEdit } from './nativeNpmChunks'
import type { ChunkScriptAnalysisCache } from './platform'
import { projectNpmChunkAnalysis } from './nativeNpmChunks'

export function getChunkNpmChunkAnalysis(chunk: OutputChunk, cache?: ChunkScriptAnalysisCache) {
  const cached = cache?.get(chunk)
  return cached?.code === chunk.code ? cached.npmChunkAnalysis : undefined
}

export function getChunkNpmPlatformApiRanges(chunk: OutputChunk, cache?: ChunkScriptAnalysisCache) {
  const cached = cache?.get(chunk)
  return cached?.code === chunk.code
    ? cached.npmPlatformApiRanges ?? cached.npmChunkAnalysis?.platformApiRanges
    : undefined
}

/** 消费 npm 事实后只保留投影的 API 范围，重复 npm 改写仍走完整 JS 路径。 */
export function rememberProjectedNpmChunkAnalysis(
  chunk: OutputChunk,
  analysis: NativeNpmChunkAnalysis,
  edits: NpmChunkTextEdit[],
  cache?: ChunkScriptAnalysisCache,
) {
  const projected = projectNpmChunkAnalysis(analysis, edits)
  const previous = cache?.get(chunk)
  cache?.set(chunk, {
    analysis: previous?.analysis ?? {
      hasPlatformApiAccess: analysis.platformApiRanges.length > 0,
      hasStaticRequireLiteral: analysis.requires.length > 0
        || analysis.localRootFacts.some(fact => fact.kind === 'interop' && fact.importee !== undefined),
    },
    code: chunk.code,
    npmPlatformApiRanges: projected?.platformApiRanges,
  })
}

/** 标记本代摘要不可消费，避免失败后再次调用 native 或使用已失效范围。 */
export function discardChunkNpmAnalysis(chunk: OutputChunk, cache?: ChunkScriptAnalysisCache) {
  const previous = cache?.get(chunk)
  if (previous?.code === chunk.code) {
    cache?.set(chunk, {
      analysis: previous.analysis,
      code: chunk.code,
    })
  }
}
