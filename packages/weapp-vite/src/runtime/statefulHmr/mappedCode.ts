import type { EncodedSourceMapLike } from '../../utils/sourcemap'
import { Buffer } from 'node:buffer'
import MagicString from 'magic-string'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../utils/sourcemap'

export interface PreparedHmrCode {
  code: string
  filename: string
  map?: EncodedSourceMapLike | null
}

export function wrapHmrCode(part: PreparedHmrCode, prefix = '', suffix = ''): string {
  const source = new MagicString(part.code).prepend(prefix).append(suffix)
  const code = source.toString()
  if (!part.map) {
    return code
  }
  const map = composeSourceMaps(source.generateMap({ source: part.filename, includeContent: true, hires: true }), part.map)
  return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`
}

export function readMappedHmrCode(code: string, filename: string): PreparedHmrCode {
  const match = /\n\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,(\S+)\s*$/.exec(code)
  if (!match) {
    return { code, filename }
  }
  return {
    code: code.slice(0, match.index),
    filename,
    map: normalizeEncodedSourceMapLike(JSON.parse(Buffer.from(match[1]!, 'base64').toString('utf8'))),
  }
}
