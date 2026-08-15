import type { OutputBundle, OutputChunk } from 'rolldown'
import type { EncodedSourceMapLike } from './sourcemap'
import { Buffer } from 'node:buffer'
import MagicString from 'magic-string'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from './sourcemap'

const INLINE_SOURCE_MAP_RE = /\n?\/\/[#@]\s*sourceMappingURL=(data:application\/json\S*)\s*$/u

export interface OutputChunkCodeReplacement {
  content: string
  end: number
  start: number
}

interface OutputChunkRewriteOptions {
  hires?: boolean | 'boundary'
}

function resolveInlineSourceMap(code: string) {
  const match = INLINE_SOURCE_MAP_RE.exec(code)
  if (typeof match?.index !== 'number') {
    return null
  }
  const dataUrl = match[1]
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) {
    return null
  }

  try {
    const metadata = dataUrl.slice(0, commaIndex)
    const payload = dataUrl.slice(commaIndex + 1)
    const json = metadata.includes(';base64')
      ? Buffer.from(payload, 'base64').toString('utf8')
      : decodeURIComponent(payload)
    const map = normalizeEncodedSourceMapLike(JSON.parse(json))
    return map
      ? {
          code: code.slice(0, match.index),
          map,
          start: match.index,
        }
      : null
  }
  catch {
    return null
  }
}

function appendInlineSourceMap(code: string, map: EncodedSourceMapLike) {
  const separator = code.endsWith('\n') ? '' : '\n'
  const payload = Buffer.from(JSON.stringify(map)).toString('base64')
  return `${code}${separator}//# sourceMappingURL=data:application/json;charset=utf-8;base64,${payload}`
}

/**
 * 返回不含 inline sourcemap 数据 URI 的实际脚本，供 AST 转换使用。
 */
export function resolveOutputChunkTransformCode(chunk: OutputChunk) {
  return resolveInlineSourceMap(chunk.code)?.code ?? chunk.code
}

/**
 * 应用 MagicString 改写，并把本轮映射与 chunk 既有映射组合。
 */
export function applyMagicStringChunkRewrite(
  chunk: OutputChunk,
  magicString: MagicString,
  options?: OutputChunkRewriteOptions,
) {
  const previousCode = chunk.code
  const inlineSourceMap = resolveInlineSourceMap(previousCode)
  if (inlineSourceMap) {
    magicString.remove(inlineSourceMap.start, previousCode.length)
  }
  const nextCode = magicString.toString()
  const previousTransformCode = inlineSourceMap?.code ?? previousCode
  if (nextCode === previousTransformCode) {
    return false
  }

  const previousMap = normalizeEncodedSourceMapLike(chunk.map) ?? inlineSourceMap?.map
  if (previousMap) {
    const nextMap = magicString.generateMap({
      hires: options?.hires ?? 'boundary',
      includeContent: true,
      source: chunk.fileName,
    })
    const composedMap = composeSourceMaps(nextMap as any, previousMap)
    chunk.map = composedMap as any
    chunk.code = inlineSourceMap && composedMap
      ? appendInlineSourceMap(nextCode, composedMap)
      : nextCode
  }
  else {
    chunk.code = nextCode
  }
  return true
}

/**
 * 在 chunk 当前代码上执行一次可追踪编辑。
 */
export function editOutputChunkCode(
  chunk: OutputChunk,
  edit: (magicString: MagicString, code: string) => void,
  options?: OutputChunkRewriteOptions,
) {
  const code = chunk.code
  const magicString = new MagicString(code)
  edit(magicString, code)
  return applyMagicStringChunkRewrite(chunk, magicString, options)
}

/**
 * 在 chunk 前方插入无源代码，同时保留原代码映射。
 */
export function prependOutputChunkCode(chunk: OutputChunk, code: string) {
  if (!code) {
    return false
  }
  return editOutputChunkCode(chunk, magicString => magicString.prepend(code))
}

/**
 * 在 chunk 后方插入无源代码，同时保留原代码映射。
 */
export function appendOutputChunkCode(chunk: OutputChunk, code: string) {
  if (!code) {
    return false
  }
  return editOutputChunkCode(chunk, magicString => magicString.append(code))
}

/**
 * 按原始代码坐标批量替换互不重叠的区间。
 */
export function replaceOutputChunkCodeRanges(
  chunk: OutputChunk,
  replacements: OutputChunkCodeReplacement[],
) {
  if (replacements.length === 0) {
    return false
  }

  const sorted = [...replacements].sort((left, right) => left.start - right.start)
  let previousEnd = -1
  for (const replacement of sorted) {
    if (
      replacement.start < 0
      || replacement.end < replacement.start
      || replacement.end > chunk.code.length
      || replacement.start < previousEnd
    ) {
      throw new RangeError(`Invalid or overlapping output chunk replacement: ${replacement.start}-${replacement.end}`)
    }
    previousEnd = replacement.end
  }

  return editOutputChunkCode(chunk, (magicString) => {
    for (const replacement of sorted) {
      magicString.overwrite(replacement.start, replacement.end, replacement.content)
    }
  })
}

/**
 * 使用正则匹配的原始坐标改写 chunk，避免整段字符串替换破坏映射。
 */
export function replaceOutputChunkCode(
  chunk: OutputChunk,
  pattern: RegExp,
  replace: (match: RegExpExecArray) => string | undefined,
) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const matcher = new RegExp(pattern.source, flags)
  const replacements: OutputChunkCodeReplacement[] = []

  for (const match of chunk.code.matchAll(matcher)) {
    if (typeof match.index !== 'number') {
      continue
    }
    const content = replace(match)
    if (content == null || content === match[0]) {
      continue
    }
    replacements.push({
      content,
      end: match.index + match[0].length,
      start: match.index,
    })
  }

  return replaceOutputChunkCodeRanges(chunk, replacements)
}

/**
 * 应用自带映射的完整代码转换，并组合 chunk 既有映射。
 */
export function applyOutputChunkTransform(
  chunk: OutputChunk,
  code: string,
  map: EncodedSourceMapLike | null | undefined,
) {
  const previousInlineSourceMap = resolveInlineSourceMap(chunk.code)
  const transformedInlineSourceMap = resolveInlineSourceMap(code)
  const previousCode = previousInlineSourceMap?.code ?? chunk.code
  const transformedCode = transformedInlineSourceMap?.code ?? code
  if (transformedCode === previousCode) {
    return false
  }

  const previousMap = normalizeEncodedSourceMapLike(chunk.map) ?? previousInlineSourceMap?.map
  const transformedMap = normalizeEncodedSourceMapLike(map)
  if (previousMap && !transformedMap) {
    throw new Error(`Output chunk transform for ${chunk.fileName} must provide a source map`)
  }

  if (previousMap && transformedMap) {
    const composedMap = composeSourceMaps(transformedMap, previousMap)
    chunk.map = composedMap as any
    chunk.code = previousInlineSourceMap && composedMap
      ? appendInlineSourceMap(transformedCode, composedMap)
      : transformedCode
  }
  else {
    chunk.code = transformedCode
  }
  return true
}

/**
 * 将 generateBundle 阶段组合后的 chunk map 提交到 Rolldown 管理的 map asset。
 */
export function syncOutputChunkSourceMapAssets(bundle: OutputBundle) {
  let synced = 0
  for (const output of Object.values(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const map = normalizeEncodedSourceMapLike(output.map)
    if (!map) {
      continue
    }
    const sourcemapFileName = output.sourcemapFileName ?? `${output.fileName}.map`
    const mapAsset = bundle[sourcemapFileName]
    if (!mapAsset || mapAsset.type !== 'asset') {
      continue
    }
    mapAsset.source = JSON.stringify(map)
    synced += 1
  }
  return synced
}
