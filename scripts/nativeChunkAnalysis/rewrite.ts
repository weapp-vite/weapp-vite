import type { OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from '../../packages/weapp-vite/src/plugins/core/lifecycle/emit/rewrite/platform'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { mayNeedChunkScriptAnalysis, normalizeNpmImportByPlatform, rewriteBundleNpmImportsByPlatform, rewriteBundlePlatformApi } from '../../packages/weapp-vite/src/plugins/core/lifecycle/emit/rewrite/platform'
import { applyMagicStringChunkRewrite } from '../../packages/weapp-vite/src/utils/outputChunk'
import { createWeapiAccessExpression } from '../../packages/weapp-vite/src/utils/weapi'

export interface ChunkInput {
  code: string
  filename: string
}

export interface SourceRange {
  start: number
  end: number
}

export interface ChunkRewriteSummary {
  requireLiterals: Array<SourceRange & { value: string }>
  platformApiObjects: SourceRange[]
}

export interface ChunkBinding {
  analyzeChunkRewritesNative: (inputs: ChunkInput[]) => ChunkRewriteSummary[]
}

export interface RewriteOptions {
  dependencies: Record<string, string>
  globalName: string
}

function assertRanges(ranges: SourceRange[], code: string) {
  let previousEnd = 0
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end)
      || range.start < previousEnd || range.end <= range.start || range.end > code.length) {
      throw new Error('Invalid or overlapping native UTF-16 ranges')
    }
    previousEnd = range.end
  }
}

/** 实验适配器沿用生产的两次映射组合，只用初始摘要平移第二阶段位置。 */
export function rewriteChunkFromSummary(chunk: OutputChunk, summary: ChunkRewriteSummary, options: RewriteOptions) {
  assertRanges([...summary.requireLiterals, ...summary.platformApiObjects], chunk.code)
  const edits = summary.requireLiterals.map((literal) => {
    if (typeof literal.value !== 'string') {
      throw new TypeError('Invalid native require literal')
    }
    const nextValue = normalizeNpmImportByPlatform('alipay', literal.value, options.dependencies)
    return nextValue === literal.value ? undefined : { ...literal, content: JSON.stringify(nextValue) }
  }).filter(edit => edit !== undefined).sort((a, b) => a.start - b.start)

  if (edits.length) {
    const magicString = new MagicString(chunk.code)
    for (const edit of edits) {
      magicString.update(edit.start, edit.end, edit.content)
    }
    applyMagicStringChunkRewrite(chunk, magicString)
  }

  if (summary.platformApiObjects.length) {
    const magicString = new MagicString(chunk.code)
    let editIndex = 0
    let offset = 0
    for (const range of [...summary.platformApiObjects].sort((a, b) => a.start - b.start)) {
      while (editIndex < edits.length && edits[editIndex]!.end <= range.start) {
        const edit = edits[editIndex++]!
        offset += edit.content.length - (edit.end - edit.start)
      }
      magicString.update(range.start + offset, range.end + offset, WEAPP_VITE_INJECTED_API_IDENTIFIER)
    }
    magicString.prepend(`var ${WEAPP_VITE_INJECTED_API_IDENTIFIER} = ${createWeapiAccessExpression(options.globalName)};\n`)
    applyMagicStringChunkRewrite(chunk, magicString)
  }
  return chunk
}

export function createChunk(input: ChunkInput, inlineMap = false): OutputChunk {
  const map = new MagicString(input.code).generateMap({ hires: true, includeContent: true, source: `source/${input.filename}` })
  return {
    code: inlineMap ? `${input.code}\n//# sourceMappingURL=${map.toUrl()}` : input.code,
    fileName: input.filename,
    map: inlineMap ? null : map,
    type: 'chunk',
  } as unknown as OutputChunk
}

/** 基线直接调用现有产物改写入口，避免复制 Babel 逻辑作为对照。 */
export function rewriteWithProduction(chunks: OutputChunk[], options: RewriteOptions) {
  const bundle = Object.fromEntries(chunks.map(chunk => [chunk.fileName, chunk]))
  const analysisCache: ChunkScriptAnalysisCache = new WeakMap()
  rewriteBundleNpmImportsByPlatform('alipay', bundle, options.dependencies, undefined, { analysisCache, astEngine: 'babel' })
  rewriteBundlePlatformApi(bundle, options.globalName, { analysisCache, astEngine: 'babel' })
  return chunks
}

/** 一次跨界处理整个批次；任一结果缺失或无效时，在提交编辑前回退整个批次。 */
export function rewriteWithNative(chunks: OutputChunk[], binding: ChunkBinding, options: RewriteOptions) {
  const candidates = chunks.map((chunk, index) => ({ chunk, index })).filter(({ chunk }) => mayNeedChunkScriptAnalysis(chunk.code))
  const summaries: ChunkRewriteSummary[] = chunks.map(() => ({ requireLiterals: [], platformApiObjects: [] }))
  const coverage = { nativeInputs: candidates.length, skippedInputs: chunks.length - candidates.length }
  try {
    if (candidates.some(({ chunk }) => !chunk.code.isWellFormed())) {
      throw new Error('Native UTF-8 conversion cannot preserve lone UTF-16 surrogates')
    }
    const results = candidates.length
      ? binding.analyzeChunkRewritesNative(candidates.map(({ chunk }) => ({ code: chunk.code, filename: chunk.fileName })))
      : []
    if (results.length !== candidates.length) {
      throw new Error('Native batch result length differs from input')
    }
    for (const [index, summary] of results.entries()) {
      const candidate = candidates[index]!
      assertRanges([...summary.requireLiterals, ...summary.platformApiObjects], candidate.chunk.code)
      if (summary.requireLiterals.some(literal => typeof literal.value !== 'string')) {
        throw new Error('Native batch contains invalid require values')
      }
      summaries[candidate.index] = summary
    }
  }
  catch (error) {
    return { chunks: rewriteWithProduction(chunks, options), fallback: String(error), summaries: undefined, ...coverage }
  }
  return {
    chunks: chunks.map((chunk, index) => rewriteChunkFromSummary(chunk, summaries[index]!, options)),
    fallback: undefined,
    summaries,
    ...coverage,
  }
}
