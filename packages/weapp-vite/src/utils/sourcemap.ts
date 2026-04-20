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
