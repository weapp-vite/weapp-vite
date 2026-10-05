import type { ManagedWechatWindowCloseEvidence } from '../types'
import path from 'node:path'

type Scalar = string | number | boolean | undefined

function decodeString(value: string) {
  const quote = value[0]
  if (!quote || !['\'', '"', '`'].includes(quote) || value.at(-1) !== quote) {
    return undefined
  }
  let result = ''
  for (let index = 1; index < value.length - 1; index++) {
    const char = value[index]!
    if (char === quote) {
      throw new Error('Unsupported quoted window-close evidence.')
    }
    if (char !== '\\') {
      result += char
      continue
    }
    const escaped = value[++index]!
    if (['\\', '\'', '"', '`'].includes(escaped)) {
      result += escaped
    }
    else if (escaped === 'x' || escaped === 'u') {
      const length = escaped === 'x' ? 2 : 4
      const digits = value.slice(index + 1, index + 1 + length)
      if (digits.length !== length || !/^[\da-f]+$/i.test(digits)) {
        throw new Error('Unsupported escaped window-close evidence.')
      }
      result += String.fromCharCode(Number.parseInt(digits, 16))
      index += length
    }
    else {
      const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }
      if (!(escaped in escapes)) {
        throw new Error('Unsupported escaped window-close evidence.')
      }
      result += escapes[escaped]
    }
  }
  return result
}

/** 只读取 inspect 对象的顶层标量；日志从不作为 JavaScript 执行。 */
function fields(source: string) {
  if (!source.startsWith('{') || !source.endsWith('}')) {
    throw new Error('Incomplete window-close trace object.')
  }
  const parts: string[] = []
  let quote = ''
  let depth = 0
  let start = 1
  for (let index = 1; index < source.length - 1; index++) {
    const char = source[index]!
    if (quote) {
      if (char === '\\') {
        index++
      }
      else if (char === quote) {
        quote = ''
      }
    }
    else if (['\'', '"', '`'].includes(char)) {
      quote = char
    }
    else if (char === '{' || char === '[') {
      depth++
    }
    else if (char === '}' || char === ']') {
      depth--
    }
    else if (char === ',' && depth === 0) {
      parts.push(source.slice(start, index))
      start = index + 1
    }
  }
  if (quote || depth !== 0) {
    throw new Error('Incomplete window-close trace fields.')
  }
  parts.push(source.slice(start, -1))
  const result = new Map<string, Scalar>()
  for (const part of parts) {
    const match = /^(\w+):([\s\S]+)$/.exec(part.trim())
    if (!match || result.has(match[1]!)) {
      throw new Error('Ambiguous window-close trace fields.')
    }
    const value = match[2]!.trim()
    result.set(match[1]!, value === 'true' ? true : value === 'false' ? false : /^\d+$/.test(value) ? Number(value) : decodeString(value))
  }
  return result
}

/** 目前核对过的协议来自所选 Stable 2.02.2608070 的主进程关闭日志。 */
export function consumeWindowCloseTrace(evidence: ManagedWechatWindowCloseEvidence, projectPath: string, input: { fileIdentity: string, line: string }) {
  const match = /^\[([^\]]+)\]\[(?:WARN|INFO)\]\[([^\]]+)\]\[MAIN\].*? \[win-close-trace\] ([\w:-]+) (.*)$/.exec(input.line)
  if (!match) {
    return
  }
  const [, timestamp, version, event, source] = match
  if (!['native-close-call', 'close-requested', 'native-window-close-cancelled', 'native-window-closed', 'webcontents-destroyed'].includes(event!)) {
    return
  }
  if (version !== evidence.productVersion) {
    throw new Error('Managed DevTools window-close trace belongs to a different product version.')
  }
  const at = new Date(timestamp!.replace(' ', 'T')).toISOString()
  if (at < evidence.capturedAt) {
    throw new Error('Managed DevTools window-close trace predates this close attempt.')
  }
  const values = fields(source!)
  const winId = values.get('winId')
  if (typeof winId !== 'string' || !winId) {
    throw new Error('Managed DevTools window-close trace has no window identity.')
  }
  const sameWindow = evidence.window?.winId === winId && evidence.window.fileIdentity === input.fileIdentity
  if (event === 'native-close-call') {
    const browserWindowId = values.get('browserWindowId')
    if (typeof browserWindowId !== 'number' || !Number.isSafeInteger(browserWindowId) || browserWindowId <= 0) {
      throw new Error('Managed DevTools close call has no native window identity.')
    }
    if (sameWindow && (browserWindowId !== evidence.window!.browserWindowId || values.get('forceClose') !== true)) {
      throw new Error('Managed DevTools window-close identity was reused or another close was requested.')
    }
    if (values.get('forceClose') === false) {
      evidence.calls.push({ fileIdentity: input.fileIdentity, winId, browserWindowId, calledAt: at })
      if (evidence.calls.length > 100) {
        throw new Error('Managed DevTools close call evidence is ambiguous.')
      }
    }
  }
  else if (event === 'close-requested') {
    const projectId = values.get('projectId')
    const matchesProject = typeof projectId === 'string' && path.isAbsolute(projectId) && path.normalize(projectId) === path.normalize(projectPath)
    if (!matchesProject) {
      if (sameWindow) {
        throw new Error('Managed DevTools window-close project identity changed.')
      }
      return
    }
    const calls = evidence.calls.filter(call => call.winId === winId && call.fileIdentity === input.fileIdentity)
    const runtimeId = values.get('runtimeId')
    if (evidence.window || calls.length !== 1 || calls[0]!.cancelled || typeof runtimeId !== 'string' || !runtimeId
      || values.get('windowType') !== 'project' || values.get('status') !== 'opened' || calls[0]!.calledAt > at) {
      throw new Error('Managed DevTools exact project close request has ambiguous window identity.')
    }
    evidence.window = { ...calls[0]!, runtimeId, requestedAt: at }
  }
  else if (event === 'native-window-close-cancelled') {
    for (const call of evidence.calls.filter(call => call.winId === winId && call.fileIdentity === input.fileIdentity)) {
      call.cancelled = true
    }
    if (sameWindow) {
      throw new Error('Managed DevTools exact project close was cancelled.')
    }
  }
  else if (sameWindow && evidence.window) {
    if (at < evidence.window.requestedAt) {
      throw new Error('Managed DevTools window destruction predates its exact close request.')
    }
    if (event === 'native-window-closed') {
      if (values.get('wasClosing') !== true) {
        throw new Error('Managed DevTools native window closed without its pending close request.')
      }
      evidence.window.nativeClosedAt = at
    }
    else if (event === 'webcontents-destroyed') {
      if (values.get('browserWindowId') !== evidence.window.browserWindowId || values.get('destroyed') !== true) {
        throw new Error('Managed DevTools webcontents destruction has a different native window identity.')
      }
      evidence.window.webContentsDestroyedAt = at
    }
  }
}
