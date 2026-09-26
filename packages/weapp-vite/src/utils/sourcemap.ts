import remapping from '@jridgewell/remapping'

export interface EncodedSourceMapLike {
  version: number
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
    && typeof (value as { version?: unknown }).version === 'number'
    && 'mappings' in value
    && 'names' in value
    && 'sources' in value,
  )
}

export function normalizeEncodedSourceMapLike(value: unknown): EncodedSourceMapLike | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const sourceMap = value as Partial<EncodedSourceMapLike> & { version?: unknown }
  const numericVersion = typeof sourceMap.version === 'number'
    ? sourceMap.version
    : typeof sourceMap.version === 'string'
      ? Number(sourceMap.version)
      : Number.NaN

  if (!Number.isFinite(numericVersion)) {
    return null
  }

  const normalized = {
    ...sourceMap,
    version: numericVersion,
  }

  return isEncodedSourceMapLike(normalized) ? normalized : null
}

export function composeSourceMaps(
  transformedMap: EncodedSourceMapLike | null | undefined,
  originalMap: EncodedSourceMapLike | null | undefined,
): EncodedSourceMapLike | null {
  if (isEncodedSourceMapLike(transformedMap) && isEncodedSourceMapLike(originalMap)) {
    return remapping([transformedMap as any, originalMap as any], () => null) as EncodedSourceMapLike
  }
  if (isEncodedSourceMapLike(transformedMap)) {
    return transformedMap
  }
  if (isEncodedSourceMapLike(originalMap)) {
    return originalMap
  }
  return null
}

/** 空来源名代表本轮转换输入；补齐身份和内容后再与上一层映射组合。 */
export function labelSourceMapInput(value: unknown, fileName: string, code: string): EncodedSourceMapLike | null {
  const map = normalizeEncodedSourceMapLike(value)
  if (!map?.sources.includes('')) {
    return map
  }
  return {
    ...map,
    sources: map.sources.map(source => source || fileName),
    sourcesContent: map.sources.map((source, index) => map.sourcesContent?.[index] ?? (source === '' ? code : null)),
  }
}
