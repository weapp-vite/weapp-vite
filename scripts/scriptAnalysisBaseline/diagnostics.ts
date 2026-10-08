/** 仅清理落盘副本；兼容 Windows 路径在 JSON、嵌套输出和代码字符串中的多次转义。 */
export function sanitizeScriptDiagnostic(value: unknown, prefixes: readonly string[]): unknown {
  const text = (input: string) => {
    let result = input
    for (const prefix of prefixes.flatMap(prefix => [prefix, prefix.replaceAll('\\', '/')]).filter(Boolean)) {
      let encoded = prefix
      while (encoded.length <= result.length) {
        result = result.replaceAll(encoded, '<workspace>/')
        const next = JSON.stringify(encoded).slice(1, -1)
        if (next === encoded) {
          break
        }
        encoded = next
      }
    }
    return result
  }
  if (typeof value === 'string') {
    return text(value)
  }
  if (Array.isArray(value)) {
    return value.map(entry => sanitizeScriptDiagnostic(entry, prefixes))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [text(key), sanitizeScriptDiagnostic(entry, prefixes)]))
  }
  return value
}
