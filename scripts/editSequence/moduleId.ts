import path from 'pathe'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const absolute = (value: string) => value.startsWith('/') || /^[a-z]:\//i.test(value)

/** 只归一化真实路径字段，保留虚拟模块种类、角色、查询键及非路径值。 */
export function normalizeSequenceModuleId(id: string, fixtureRoot: string, repoRoot = repositoryRoot) {
  const normalizePath = (value: string) => {
    const file = value.replaceAll('\\', '/')
    if (!absolute(file)) {
      return value
    }
    for (const [root, label] of [[fixtureRoot, '<fixture>'], [repoRoot, '<repo>']] as const) {
      const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/, '')
      if (file === normalizedRoot || file.startsWith(`${normalizedRoot}/`)) {
        return `${label}${file.slice(normalizedRoot.length)}`
      }
    }
    // 范围外依赖只展示文件名；集合去重使用原始 ID，避免脱敏合并不同依赖。
    return `<external>/${path.basename(file)}`
  }
  const normalizeEncodedPath = (value: string) => {
    try {
      const decoded = decodeURIComponent(value)
      const normalized = normalizePath(decoded)
      return normalized === decoded ? value : encodeURIComponent(normalized)
    }
    catch {
      return value
    }
  }
  const queryAt = id.indexOf('?')
  const source = queryAt < 0 ? id : id.slice(0, queryAt)
  const normalizedSource = /^\0?weapp-vite:/.test(source)
    ? source.split(':').map(normalizeEncodedPath).join(':')
    : normalizePath(source)
  if (queryAt < 0) {
    return normalizedSource
  }
  const query = id.slice(queryAt + 1).split('&').map((part) => {
    const equalsAt = part.indexOf('=')
    return equalsAt < 0 ? part : `${part.slice(0, equalsAt + 1)}${normalizeEncodedPath(part.slice(equalsAt + 1))}`
  }).join('&')
  return `${normalizedSource}?${query}`
}
