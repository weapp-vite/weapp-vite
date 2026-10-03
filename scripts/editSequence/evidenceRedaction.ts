import path from 'node:path'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')

/** 诊断可能把路径再次序列化或 URL 编码；先展开这些表示，再统一脱敏。 */
export function redactSequenceEvidenceText(value: string, fixtureRoot: string, repoRoot = repositoryRoot) {
  let decoded = value
  for (;;) {
    const next = decoded
      .replace(/\\u([\da-f]{4})/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
      .replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
        try {
          return decodeURIComponent(encoded)
        }
        catch {
          return encoded
        }
      })
      .replace(/\\([\\/])/g, '$1')
    if (next === decoded) {
      break
    }
    decoded = next
  }
  const roots = [[fixtureRoot, '<fixture>'], [repoRoot, '<repo>']] as const
  for (const [root, label] of [...roots].sort((left, right) => right[0].length - left[0].length)) {
    const normalized = root.replaceAll('\\', '/').replace(/\/$/, '')
    for (const spelling of new Set([normalized, normalized.replaceAll('/', '\\')])) {
      decoded = decoded.replaceAll(spelling, label)
    }
  }
  if (/^(?:file:\/\/)?(?:[a-z]:)?[\\/]/i.test(decoded)) {
    return '<external>'
  }
  return decoded
    .replace(/(["'`])(?:file:\/\/)?(?:[a-z]:)?[\\/][^"'`\r\n]*\1/gi, '$1<external>$1')
    .replace(/(?<![\w>])(?:[a-z]:)?[\\/][^\r\n"'`<>()[\]{},;]*/gi, '<external>')
}

/** 所有字符串字段都需要脱敏，包括未知版本、嵌套错误和未参与统计的记录。 */
export function redactSequenceEvidence<T>(value: T, fixtureRoot: string): T {
  if (typeof value === 'string') {
    return redactSequenceEvidenceText(value, fixtureRoot) as T
  }
  if (Array.isArray(value)) {
    return value.map(item => redactSequenceEvidence(item, fixtureRoot)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [redactSequenceEvidenceText(key, fixtureRoot), redactSequenceEvidence(item, fixtureRoot)])) as T
  }
  return value
}
