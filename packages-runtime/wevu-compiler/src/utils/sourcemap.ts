import type { SourceMapInput } from '@jridgewell/remapping'
import remapping from '@jridgewell/remapping'
import { TraceMap } from '@jridgewell/trace-mapping'

export interface EncodedSourceMapLike {
  version: number | string
  file?: string
  names: string[]
  sourceRoot?: string
  sources: string[]
  sourcesContent?: Array<string | null>
  mappings: string
}

export function isEncodedSourceMapLike(value: unknown): value is EncodedSourceMapLike {
  return Boolean(
    value
    && typeof value === 'object'
    && 'version' in value
    && 'mappings' in value
    && 'names' in value
    && 'sources' in value,
  )
}

export function composeSourceMaps(
  transformedMap: EncodedSourceMapLike | null | undefined,
  originalMap: EncodedSourceMapLike | null | undefined,
): EncodedSourceMapLike | null {
  if (isEncodedSourceMapLike(transformedMap) && isEncodedSourceMapLike(originalMap)) {
    return remapping(
      [
        transformedMap as unknown as SourceMapInput,
        originalMap as unknown as SourceMapInput,
      ],
      () => null,
    ) as EncodedSourceMapLike
  }
  if (isEncodedSourceMapLike(transformedMap)) {
    return transformedMap
  }
  if (isEncodedSourceMapLike(originalMap)) {
    return originalMap
  }
  return null
}

export function composeSourceMapForSource(
  transformedMap: EncodedSourceMapLike | null | undefined,
  originalMap: EncodedSourceMapLike | null | undefined,
  sourceFile: string,
): EncodedSourceMapLike | null {
  if (!isEncodedSourceMapLike(transformedMap)) {
    return null
  }
  if (!isEncodedSourceMapLike(originalMap)) {
    return transformedMap
  }
  const transformedMapInput = transformedMap as unknown as SourceMapInput
  const sourceIndex = transformedMap.sources.indexOf(sourceFile)
  if (sourceIndex < 0) {
    return transformedMap
  }
  const resolvedSourceFile = new TraceMap(transformedMapInput).resolvedSources[sourceIndex]
  return remapping(
    transformedMapInput,
    (file, context) => {
      if (context.depth !== 1 || file !== resolvedSourceFile) {
        return null
      }
      // 原 map 的 sources 已使用入口标识，不能再相对该入口的目录解析。
      context.source = ''
      return originalMap as unknown as SourceMapInput
    },
  ) as EncodedSourceMapLike
}
