export const OPERATION_TIMEOUT_CODE = 'DEVTOOLS_OPERATION_TIMEOUT'

export type OperationErrorCategory = 'invalid-path' | 'login-required' | 'service-unavailable' | 'connection-transient' | 'protocol-rejected' | 'timeout' | 'canceled' | 'unknown'

/** 根据原始错误链分类；未知错误默认不重试，路径和登录错误优先。 */
export function classifyOperationError(error: unknown): OperationErrorCategory {
  const seen = new Set<unknown>()
  const parts: string[] = []
  let originalText = ''
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const item = current as { name?: unknown, code?: unknown, message?: unknown, stderr?: unknown, stdout?: unknown, cause?: unknown }
    const values = [item.name, item.code === 10 ? 'code: 10' : item.code, item.message, item.stderr, item.stdout].filter((part): part is string => typeof part === 'string')
    parts.push(...values)
    originalText = values.join('\n')
    current = item.cause
  }
  const text = parts.join('\n')
  if (/ENOENT|EACCES|not found|doesn't exist|cliPath is not correct|projectPath is not provided/i.test(text)) {
    return 'invalid-path'
  }
  if (/DEVTOOLS_LOGIN_REQUIRED|需要重新登录|need\s+re-?login|code\s*[:=]\s*10\b/i.test(text)) {
    return 'login-required'
  }
  if (/unexpected server response|requires at least version|protocol.*reject|unsupported response|invalid JSON|invalid autoPort/i.test(text)) {
    return 'protocol-rejected'
  }
  if (/DEVTOOLS_OPERATION_TIMEOUT|DEVTOOLS_PROTOCOL_TIMEOUT|timed? ?out/i.test(text)) {
    return 'timeout'
  }
  if (/ECONNREFUSED|service port.*disabled|http port is open/i.test(text)) {
    return 'service-unavailable'
  }
  if (/ECONNRESET|EPIPE|Extension context invalidated|Failed connecting to|closed before handshake/i.test(originalText)) {
    return 'connection-transient'
  }
  if (/AbortError|ABORT_ERR|cancel(?:led|ed)/i.test(text)) {
    return 'canceled'
  }
  return 'unknown'
}

export function isRecoverableOperationError(error: unknown) {
  const category = classifyOperationError(error)
  return category === 'connection-transient' || category === 'service-unavailable' || category === 'timeout'
}
