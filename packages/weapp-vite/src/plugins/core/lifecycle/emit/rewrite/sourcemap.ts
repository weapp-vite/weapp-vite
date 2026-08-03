import type MagicString from 'magic-string'
import type { OutputChunk } from 'rolldown'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../../../../utils/sourcemap'

export function applyMagicStringChunkRewrite(chunk: OutputChunk, magicString: MagicString) {
  const previousCode = chunk.code
  const nextCode = magicString.toString()
  if (nextCode === previousCode) {
    return false
  }

  const previousMap = normalizeEncodedSourceMapLike(chunk.map)

  chunk.code = nextCode
  if (previousMap) {
    const nextMap = magicString.generateMap({
      hires: 'boundary',
      includeContent: true,
      source: chunk.fileName,
    })
    chunk.map = composeSourceMaps(nextMap as any, previousMap) as any
  }
  return true
}
