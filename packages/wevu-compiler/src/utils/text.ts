/**
 * 统一文本换行符为 LF，消除不同系统（CRLF/CR/LF）差异。
 */
export function normalizeLineEndings(source: string) {
  if (!source.includes('\r')) {
    return source
  }
  return source.replace(/\r\n?/g, '\n')
}
