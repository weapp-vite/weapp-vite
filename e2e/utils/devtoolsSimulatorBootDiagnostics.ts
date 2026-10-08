const BOOT_ERROR_PATTERNS = [
  /simulator launch catch error/i,
  /simulator not found/i,
  /模拟器启动失败/,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
  /cannot read propert(?:y|ies).+\bMaxSubPackageLimit\b/i,
] as const
const SIMULATOR_NOT_FOUND_PATTERN = /\[SimulatorService\]\s+updateSimulatorCompileOptions:\s+simulator not found\s+(\S+)/i
const SIMULATOR_INIT_PATTERN = /\[SimulatorService\]\s+init simulator\s+(\S+)\s+with clientSid\b/i
const GENERIC_LAUNCH_FAILURE_PATTERN = /simulator launch catch error(?: stack)?\s+(?:Error:\s*)?simulator launch failed\s*$/i
const WEBVIEW_PAGE_READY_PATTERN = /\[devtools\]\s+webview page ready/i
const WINDOW_ID_PATTERN = /\bwin:([^\]\s]+)/i

export interface DevtoolsLogIssue {
  file: string
  line: string
}

export interface DevtoolsSimulatorBootDiagnostic extends DevtoolsLogIssue {
  state: 'pending' | 'fatal' | 'recovered'
  windowId?: string
  readyLine?: string
}

/** 只用同一日志内、首错之后的同窗口页面就绪回执确认通用启动错误已恢复。 */
export function classifyDevtoolsSimulatorBootLine(lines: string[], index: number): Omit<DevtoolsSimulatorBootDiagnostic, 'file' | 'line'> | undefined {
  const line = lines[index]
  if (!line || !BOOT_ERROR_PATTERNS.some(pattern => pattern.test(line))) {
    return
  }
  const simulatorId = line.match(SIMULATOR_NOT_FOUND_PATTERN)?.[1]
  if (simulatorId && lines.some(candidate => candidate.match(SIMULATOR_INIT_PATTERN)?.[1] === simulatorId)) {
    return
  }

  const windowId = line.match(WINDOW_ID_PATTERN)?.[1]
  if (!windowId || !GENERIC_LAUNCH_FAILURE_PATTERN.test(line)) {
    return { state: 'fatal', windowId }
  }

  const readyLine = lines.slice(index + 1).find(candidate => WEBVIEW_PAGE_READY_PATTERN.test(candidate) && candidate.match(WINDOW_ID_PATTERN)?.[1] === windowId)?.trim()
  return { state: readyLine ? 'recovered' : 'pending', windowId, readyLine }
}
