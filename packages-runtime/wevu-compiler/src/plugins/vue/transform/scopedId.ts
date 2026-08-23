const SOURCE_ROOT_RE = /(?:^|\/)src\/(.+)$/

function normalizeScopedIdInput(filename: string) {
  const normalized = filename.replace(/\\/g, '/')
  return normalized.match(SOURCE_ROOT_RE)?.[1] ?? normalized.replace(/^.*?\/(pages|components|layouts)\//, '$1/')
}

/**
 * 根据项目内相对路径生成跨机器稳定的 scoped ID。
 */
export function generateScopedId(filename: string): string {
  const input = normalizeScopedIdInput(filename)
  let hash = 0x811C9DC5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
