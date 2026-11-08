import { Buffer } from 'node:buffer'
import MagicString from 'magic-string'
import path from 'pathe'

const REQUIRE_ASYNC_TARGET_MARKER_PREFIX = '__weapp_vite_require_async_target__'
const REQUIRE_ASYNC_TARGET_MARKER_RE = new RegExp(
  [
    `\\brequire\\s*\\.\\s*async\\(\\s*([${String.fromCharCode(39, 34, 96)}])`,
    REQUIRE_ASYNC_TARGET_MARKER_PREFIX,
    '([\\w-]+)\\1\\s*\\)',
  ].join(''),
  'g',
)

export function createRequireAsyncTargetMarker(fileName: string) {
  return `${REQUIRE_ASYNC_TARGET_MARKER_PREFIX}${Buffer.from(fileName).toString('base64url')}`
}

/** 在路径重写前读取当前 chunk 声明的原生异步目标，不借用上一代发射记录。 */
export function collectRequireAsyncChunkTargets(code: string) {
  return new Set(Array.from(code.matchAll(REQUIRE_ASYNC_TARGET_MARKER_RE), match =>
    Buffer.from(match[2]!, 'base64url').toString('utf8')))
}

/** 按最终 chunk 文件名修正异步分包加载路径。 */
export function rewriteRequireAsyncChunkPaths(code: string, importerFileName: string) {
  const source = new MagicString(code)
  let changed = false
  for (const match of code.matchAll(REQUIRE_ASYNC_TARGET_MARKER_RE)) {
    const targetFileName = Buffer.from(match[2]!, 'base64url').toString('utf8')
    if (typeof match.index !== 'number' || !targetFileName) {
      continue
    }
    const relative = path.relative(path.dirname(importerFileName), targetFileName)
    const literalStart = match.index + match[0].indexOf(match[1]!)
    const literalEnd = literalStart + REQUIRE_ASYNC_TARGET_MARKER_PREFIX.length + match[2]!.length + 2
    source.overwrite(literalStart, literalEnd, JSON.stringify(relative.startsWith('.') ? relative : `./${relative}`))
    changed = true
  }
  return changed ? { code: source.toString(), map: source.generateMap({ hires: 'boundary' }) } : null
}
