const CRLF_RE = /\r\n?/g
const HYPHENATE_RE = /\B([A-Z])/g

export function hyphenate(value: string) {
  return value.replace(HYPHENATE_RE, '-$1').toLowerCase()
}

/**
 * 统一文本换行符为 LF，消除不同系统（CRLF/CR/LF）差异。
 */
export function normalizeLineEndings(source: string) {
  if (!source.includes('\r')) {
    return source
  }
  return source.replace(CRLF_RE, '\n')
}
