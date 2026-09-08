import os from 'node:os'

/** 保留开发进程错误语义，同时脱敏可上传报告中的机器路径与凭据。 */
export function sanitizeBenchmarkDevLog(value: string, repoRoot: string, home = os.homedir()) {
  // 图协议会编码真实源码路径；先解码连续转义，再统一执行路径与凭据脱敏。
  const decoded = value.replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
    try {
      return decodeURIComponent(encoded)
    }
    catch {
      return encoded
    }
  })
  let result = decoded.replaceAll('\\', '/').replaceAll('\r\n', '\n')
  for (const [prefix, replacement] of [[repoRoot, '<repo>'], [home, '<home>']]) {
    const normalized = prefix!.replaceAll('\\', '/').replace(/\/$/, '')
    if (normalized) {
      result = result.replaceAll(normalized, replacement!)
    }
  }
  return result
    .replace(/(?<![\w/])(?:[A-Z]:)?\/(?:Users|home)\/[^\s/"'<>]+/gi, '<home>')
    .replace(/(?<![\w/])(?:[A-Z]:\/|\/(?:private|var|tmp|Applications|opt)\/)[^\s"'<>)]*/gi, '<external-path>')
    .replace(/\b(?:Bearer\s+|(?:token|password|secret|appid|authorization)["']?\s*[=:]\s*["']?(?:Bearer\s+)?)[^\s,"'<>]+/gi, '<redacted>')
    .replace(/\b[\w.%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<email>')
}
