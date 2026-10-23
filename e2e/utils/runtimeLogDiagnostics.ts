interface RuntimeLogCallFrame {
  functionName?: string
  url?: string
  lineNumber?: number
  columnNumber?: number
}

interface RuntimeLogStackTrace {
  callFrames: RuntimeLogCallFrame[]
  parent?: RuntimeLogStackTrace
  truncated?: boolean
}

interface RuntimeLogExceptionDetails {
  exceptionId?: number
  text?: string
  url?: string
  lineNumber?: number
  columnNumber?: number
  executionContextId?: number
  stackTrace?: RuntimeLogStackTrace
}

export interface RuntimeLogDiagnostics {
  sessionId: string
  /** 当前监听器接收事件时的订阅尝试标识，不是原始 CDP 请求或事件的来源标识。 */
  subscriptionId: string
  /** SDK 完成结构化错误检查并触发监听器时的接收时间，不是 WebSocket 到达时间。 */
  receivedAtMonotonicMs: number
  /** 保留 CDP 原始 timestamp，不用日志接收时间替代。 */
  originalTimestamp?: number
  executionContextId?: number
  stackTrace?: RuntimeLogStackTrace
  exceptionDetails?: RuntimeLogExceptionDetails
}

type DiagnosticClock = Pick<RuntimeLogDiagnostics, 'sessionId' | 'subscriptionId' | 'receivedAtMonotonicMs'>
type SanitizeText = (value: string) => string

function diagnosticBasename(file: string) {
  return file.split('/').filter(Boolean).at(-1) ?? '<external-path>'
}

// 坐标是任意来源文件的可靠终点；不跨过下一条本地引用或远程 URL。
const UNQUOTED_LOCAL_STACK_REFERENCE = /(^|[\s"'`(=])((?:file:\/\/[^/\s]*\/|[a-z]:\/|\/)(?:(?!\s(?:[a-z][a-z\d+.-]*:\/\/|[a-z]:\/|\/))[^\r\n"'`<>()[\]{},;])*?)(:\d+(?::\d+)?)(?=$|[\s"'`<>()[\]{},;])/gi
// 无坐标的脚本以文件后缀为终点，避免吞掉业务尾文或误停在带点目录。
const UNQUOTED_LOCAL_SCRIPT_REFERENCE = /(^|[\s"'`(=])((?:file:\/\/[^/\s]*\/|[a-z]:\/|\/)(?:(?!\s(?:[a-z][a-z\d+.-]*:\/\/|[a-z]:\/|\/))[^\r\n"'`<>()[\]{},;])*?\.(?:[cm]?[jt]sx?|vue|wxs))(?=$|[\s"'`<>()[\]{},;])/gi

function redactUnquotedLocalReferences(value: string) {
  return value
    .replace(UNQUOTED_LOCAL_STACK_REFERENCE, (_match, prefix: string, file: string, coordinates: string) => `${prefix}${diagnosticBasename(file)}${coordinates}`)
    .replace(UNQUOTED_LOCAL_SCRIPT_REFERENCE, (_match, prefix: string, file: string) => `${prefix}${diagnosticBasename(file)}`)
}

function sanitizeDiagnosticText(value: string, sanitize: SanitizeText) {
  const normalized = value.replaceAll('\\', '/')
  const withoutCompletePaths = /^(?:file:\/\/[^/\s]*\/|[a-z]:\/|\/)/i.test(normalized)
    ? diagnosticBasename(normalized)
    : normalized.replace(/(["'`])((?:file:\/\/[^/\s]*\/|[a-z]:\/|\/)[^\r\n]*?)\1/gi, (_match, quote: string, file: string) => `${quote}${diagnosticBasename(file)}${quote}`)
  const sanitized = sanitize(redactUnquotedLocalReferences(withoutCompletePaths))
  return sanitized.replace(/(^|[\s"'`(=])((?:file:\/\/[^/\s]*\/|[a-z]:\/|\/)[^\s"'`<>()[\]{}]+)/gi, (_match, prefix: string, file: string) => {
    return `${prefix}${diagnosticBasename(file)}`
  })
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function numericFields(value: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.flatMap((key) => {
    const field = value[key]
    return typeof field === 'number' && Number.isFinite(field) ? [[key, field]] : []
  })) as Record<string, number>
}

function textFields(value: Record<string, unknown>, keys: string[], sanitize: SanitizeText) {
  return Object.fromEntries(keys.flatMap((key) => {
    const field = value[key]
    return typeof field === 'string' ? [[key, sanitize(field)]] : []
  })) as Record<string, string>
}

function readStackTrace(value: unknown, sanitize: SanitizeText, depth = 0): RuntimeLogStackTrace | undefined {
  const stack = asRecord(value)
  if (!stack || !Array.isArray(stack.callFrames)) {
    return undefined
  }
  const frames = stack.callFrames.slice(0, 32).flatMap((value) => {
    const frame = asRecord(value)
    return frame
      ? [{
          ...textFields(frame, ['functionName', 'url'], sanitize),
          ...numericFields(frame, ['lineNumber', 'columnNumber']),
        }]
      : []
  })
  const parent = depth < 3 ? readStackTrace(stack.parent, sanitize, depth + 1) : undefined
  return {
    callFrames: frames,
    ...(parent ? { parent } : {}),
    ...(stack.truncated === true || stack.callFrames.length > 32 || (depth === 3 && stack.parent) ? { truncated: true } : {}),
  }
}

function readExceptionDetails(value: unknown, sanitize: SanitizeText): RuntimeLogExceptionDetails | undefined {
  const details = asRecord(value)
  if (!details) {
    return undefined
  }
  const stackTrace = readStackTrace(details.stackTrace, sanitize)
  return {
    ...textFields(details, ['text', 'url'], sanitize),
    ...numericFields(details, ['exceptionId', 'lineNumber', 'columnNumber', 'executionContextId']),
    ...(stackTrace ? { stackTrace } : {}),
  }
}

function readOrigin(value: Record<string, unknown>, sanitize: SanitizeText, timestampKey = 'originalTimestamp') {
  const timestamp = value[timestampKey]
  const stackTrace = readStackTrace(value.stackTrace, sanitize)
  const exceptionDetails = readExceptionDetails(value.exceptionDetails, sanitize)
  return {
    ...(typeof timestamp === 'number' && Number.isFinite(timestamp) ? { originalTimestamp: timestamp } : {}),
    ...numericFields(value, ['executionContextId']),
    ...(stackTrace ? { stackTrace } : {}),
    ...(exceptionDetails ? { exceptionDetails } : {}),
  }
}

/** 只保留 CDP 来源元信息，不复制参数、远程对象、预览或任意业务值。 */
export function captureRuntimeLogDiagnostics(value: unknown, clock: DiagnosticClock): RuntimeLogDiagnostics {
  const outer = asRecord(value) ?? {}
  const payload = asRecord(outer.entry) ?? asRecord(outer.message) ?? asRecord(outer.params) ?? outer
  return {
    ...clock,
    ...readOrigin(payload, text => text, 'timestamp'),
  }
}

/** 写入和读取报告时使用同一白名单，并复用既有路径脱敏规则。 */
export function sanitizeRuntimeLogDiagnostics(value: unknown, sanitize: SanitizeText): RuntimeLogDiagnostics | undefined {
  const diagnostics = asRecord(value)
  if (!diagnostics || typeof diagnostics.sessionId !== 'string' || typeof diagnostics.subscriptionId !== 'string'
    || typeof diagnostics.receivedAtMonotonicMs !== 'number' || !Number.isFinite(diagnostics.receivedAtMonotonicMs)) {
    return undefined
  }
  const sanitizeText = (text: string) => sanitizeDiagnosticText(text, sanitize)
  return {
    sessionId: sanitizeText(diagnostics.sessionId),
    subscriptionId: sanitizeText(diagnostics.subscriptionId),
    receivedAtMonotonicMs: diagnostics.receivedAtMonotonicMs,
    ...readOrigin(diagnostics, sanitizeText),
  }
}
