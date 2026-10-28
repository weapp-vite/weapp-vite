export const TERMINAL_RUNTIME_FAILURE_MARKER = '[e2e:runtime-terminal] '

export type TerminalRuntimeFailureCode
  = | 'E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED'
    | 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE'

export interface TerminalRuntimeFailure {
  code: TerminalRuntimeFailureCode
  reason: string
}

const terminalReasons: Record<TerminalRuntimeFailureCode, string> = {
  E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED: 'WeChat DevTools simulator failed to start before webview page ready.',
  E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE: 'Runtime log subscription did not complete before the launch deadline.',
}

function isTerminalRuntimeFailureCode(code: unknown): code is TerminalRuntimeFailureCode {
  return code === 'E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED'
    || code === 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE'
}

/** 只沿真实错误链识别终态错误码，避免把普通日志文案当成停止信号。 */
export function classifyTerminalRuntimeFailure(error: unknown): TerminalRuntimeFailure | undefined {
  const seen = new Set<Error>()
  let current = error
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current)
    const code: unknown = (current as Error & { code?: unknown }).code
    if (isTerminalRuntimeFailureCode(code)) {
      // 标记只携带固定诊断，不复制可能含路径或凭据的原始错误；完整首错由原日志保留。
      return { code, reason: terminalReasons[code] }
    }
    current = current.cause
  }
  return undefined
}

/** 严格解析独立终态标记行，不接受其他日志前缀或未声明的错误码。 */
export function parseTerminalRuntimeFailureLine(line: string): TerminalRuntimeFailure | undefined {
  if (!line.startsWith(TERMINAL_RUNTIME_FAILURE_MARKER)) {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(line.slice(TERMINAL_RUNTIME_FAILURE_MARKER.length))
    if (value === null || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'code') || !Object.hasOwn(value, 'reason')) {
      return undefined
    }
    const record = value as Record<string, unknown>
    if (!isTerminalRuntimeFailureCode(record.code) || typeof record.reason !== 'string' || !record.reason.trim()) {
      return undefined
    }
    return { code: record.code, reason: record.reason.trim() }
  }
  catch {
    return undefined
  }
}
