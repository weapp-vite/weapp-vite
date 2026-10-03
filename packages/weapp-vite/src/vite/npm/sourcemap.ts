import { Buffer } from 'node:buffer'
import path from 'pathe'

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i
const INLINE_MAP = /(\/\/[#@]\s*sourceMappingURL=data:application\/json(?:;charset=[^;,]*)?;base64,)([a-z\d+/=]+)/gi

/** npm 镜像目录深度可能不同，重定位相对源码路径但保持 URL 与绝对来源不变。 */
export function relocateNpmSourcemap(source: string | Uint8Array, from: string, to: string): string | Uint8Array {
  if (!from.endsWith('.map')) {
    if (/\.[cm]?js$/.test(from)) {
      const code = typeof source === 'string' ? source : Buffer.from(source).toString('utf8')
      return code.replace(INLINE_MAP, (_match, prefix: string, encoded: string) => {
        const map = relocateNpmSourcemap(Buffer.from(encoded, 'base64'), `${from}.map`, `${to}.map`)
        return `${prefix}${Buffer.from(map).toString('base64')}`
      })
    }
    return source
  }
  let value: unknown
  try {
    value = JSON.parse(typeof source === 'string' ? source : Buffer.from(source).toString('utf8'))
  }
  catch {
    return source
  }
  if (!value || typeof value !== 'object' || !('sources' in value) || !Array.isArray(value.sources)
    || !value.sources.every(item => typeof item === 'string')) {
    return source
  }
  const sourceRoot = 'sourceRoot' in value && typeof value.sourceRoot === 'string' ? value.sourceRoot : ''
  if (URL_SCHEME.test(sourceRoot)) {
    return source
  }
  const sources = (value.sources as string[]).map((item) => {
    if (URL_SCHEME.test(item) || path.isAbsolute(item)) {
      return item
    }
    return path.relative(path.dirname(to), path.resolve(path.dirname(from), sourceRoot, item))
  })
  return JSON.stringify({ ...value, sourceRoot: '', sources })
}
