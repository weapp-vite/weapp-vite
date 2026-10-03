import { Buffer } from 'node:buffer'
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
  const integrityBytes: Record<string, number> = { 256: 32, 384: 48, 512: 64 }
  const integrityTokens = new Map<string, string>()
  let integrityPrefix = '<sequence-integrity:'
  while (decoded.includes(integrityPrefix)) {
    integrityPrefix = `<${integrityPrefix}`
  }
  // SRI 中的斜杠是摘要字节；只保护完整且长度、填充均规范的 token，周围诊断仍须脱敏。
  decoded = decoded.replace(/(?<![\w+/-])sha(256|384|512)-([A-Za-z\d+/]+={0,2})(?![A-Za-z\d+/=])/g, (token, algorithm: string, encoded: string) => {
    const bytes = Buffer.from(encoded, 'base64')
    if (bytes.length !== integrityBytes[algorithm] || bytes.toString('base64') !== encoded) {
      return token
    }
    const marker = `${integrityPrefix}${integrityTokens.size}>`
    integrityTokens.set(marker, token)
    return marker
  })
  const roots = [[fixtureRoot, '<fixture>'], [repoRoot, '<repo>']] as const
  for (const [root, label] of [...roots].sort((left, right) => right[0].length - left[0].length)) {
    const normalized = root.replaceAll('\\', '/').replace(/\/$/, '')
    for (const spelling of new Set([normalized, normalized.replaceAll('/', '\\')])) {
      decoded = decoded.replaceAll(spelling, label)
    }
  }
  // 仅归一化已识别路径的尾部，不能改写其他诊断文本中的反斜杠。
  decoded = decoded.replace(/(<(?:fixture|repo)>)([\\/][^\r\n"'`<>()[\]{},;:]*)/g, (_, label: string, suffix: string) => `${label}${suffix.replaceAll('\\', '/')}`)
  if (/^(?:file:\/\/)?(?:[a-z]:)?[\\/]/i.test(decoded)) {
    return '<external>'
  }
  let redacted = decoded
    .replace(/(["'`])(?:file:\/\/)?(?:[a-z]:)?[\\/][^"'`\r\n]*\1/gi, '$1<external>$1')
    .replace(/(?<![\w>])(?:[a-z]:)?[\\/][^\r\n"'`<>()[\]{},;]*/gi, '<external>')
  for (const [marker, token] of integrityTokens) {
    redacted = redacted.replaceAll(marker, token)
  }
  return redacted
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
