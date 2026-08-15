import type MagicString from 'magic-string'
import MagicStringConstructor from 'magic-string'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from './sourcemap'

interface CodeTransformResult {
  code: string
  map?: unknown
}

/**
 * 对 load/transform 结果执行可追踪编辑，并按需组合已有映射。
 */
export function editCodeTransformResult<T extends CodeTransformResult>(
  result: T,
  sourceId: string,
  edit: (magicString: MagicString, code: string) => void,
  options?: {
    sourceMap?: boolean
  },
): T {
  const magicString = new MagicStringConstructor(result.code)
  edit(magicString, result.code)
  const code = magicString.toString()
  if (code === result.code) {
    return result
  }
  const previousMap = normalizeEncodedSourceMapLike(result.map)
  if (!options?.sourceMap && !previousMap) {
    return {
      ...result,
      code,
    }
  }

  const rewriteMap = magicString.generateMap({
    hires: true,
    includeContent: true,
    source: sourceId,
  }) as any
  return {
    ...result,
    code,
    map: previousMap
      ? composeSourceMaps(rewriteMap, previousMap)
      : rewriteMap,
  }
}
