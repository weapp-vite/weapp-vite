import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const DEVTOOLS_LOG_ROOT_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_LOG_ROOT'
const DEVTOOLS_PROFILE_NAME_PATTERN = /^[\w.-]+$/
const DEVTOOLS_LOG_FILE_PATTERN = /\.log$/i
const DEVTOOLS_LOG_TIMESTAMP_PATTERN = /^\[(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\.(\d{3})(Z|[+-]\d{2}:\d{2})?\]/
const DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS = [
  /simulator launch catch error/i,
  /simulator not found/i,
  /模拟器启动失败/,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
] as const
const DEVTOOLS_SIMULATOR_NOT_FOUND_PATTERN = /\[SimulatorService\]\s+updateSimulatorCompileOptions:\s+simulator not found\s+(\S+)/i
const DEVTOOLS_SIMULATOR_INIT_PATTERN = /\[SimulatorService\]\s+init simulator\s+(\S+)\s+with clientSid\b/i
const DEVTOOLS_SIMULATOR_CONTEXT_PATTERN = /\[rt:[^,\]]+,win:([^\]]+)\]/i
const DEVTOOLS_GENERIC_SIMULATOR_LAUNCH_ERROR_PATTERN = /\bsimulator launch catch error Error:\s*simulator launch failed\s*$/i
const DEVTOOLS_SIMULATOR_LAUNCH_SUCCESS_PATTERN = /\bsimulator launch success\b/i

export interface DevtoolsLogIssue {
  file: string
  line: string
}

export type DevtoolsLogBaseline = Record<string, number>

const DEFAULT_LOG_QUIET_WINDOW_MS = 1_000
const DEFAULT_LOG_QUIET_POLL_INTERVAL_MS = 100
const DEFAULT_LOG_QUIET_TIMEOUT_MS = 5_000

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function resolveDefaultDevtoolsDataRoot() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/微信开发者工具')
  }
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData/Roaming/微信开发者工具')
  }
  return path.join(os.homedir(), '.config/微信开发者工具')
}

export function resolveDevtoolsLogRoot() {
  return process.env[DEVTOOLS_LOG_ROOT_ENV] || resolveDefaultDevtoolsDataRoot()
}

function safeReadDir(dir: string) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return []
  }
}

function safeStat(filePath: string) {
  try {
    return fs.statSync(filePath)
  }
  catch {
    return null
  }
}

function resolveWeappLogDirs(rootDir: string) {
  return safeReadDir(rootDir)
    .filter(entry => entry.isDirectory() && DEVTOOLS_PROFILE_NAME_PATTERN.test(entry.name))
    .map(entry => path.join(rootDir, entry.name, 'WeappLog/logs'))
    .filter(logDir => safeStat(logDir)?.isDirectory())
}

function resolveRecentLogFiles(rootDir: string, sinceMs: number) {
  return resolveWeappLogDirs(rootDir)
    .flatMap((logDir) => {
      return safeReadDir(logDir)
        .filter(entry => entry.isFile() && DEVTOOLS_LOG_FILE_PATTERN.test(entry.name))
        .map(entry => path.join(logDir, entry.name))
    })
    .filter((filePath) => {
      const stat = safeStat(filePath)
      return stat && stat.mtimeMs >= sinceMs - 1_000
    })
}

export function captureDevtoolsLogBaseline(options: {
  rootDir?: string
} = {}): DevtoolsLogBaseline {
  const rootDir = options.rootDir || resolveDevtoolsLogRoot()
  const baseline: DevtoolsLogBaseline = {}

  for (const logDir of resolveWeappLogDirs(rootDir)) {
    for (const entry of safeReadDir(logDir)) {
      if (!entry.isFile() || !DEVTOOLS_LOG_FILE_PATTERN.test(entry.name)) {
        continue
      }
      const filePath = path.join(logDir, entry.name)
      const stat = safeStat(filePath)
      if (stat) {
        baseline[filePath] = stat.size
      }
    }
  }

  return baseline
}

function isSameDevtoolsLogBaseline(left: DevtoolsLogBaseline, right: DevtoolsLogBaseline) {
  const leftEntries = Object.entries(left)
  const rightKeys = Object.keys(right)
  return leftEntries.length === rightKeys.length
    && leftEntries.every(([filePath, size]) => right[filePath] === size)
}

export async function waitForDevtoolsLogQuiescence(options: {
  pollIntervalMs?: number
  quietWindowMs?: number
  rootDir?: string
  timeoutMs?: number
} = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_LOG_QUIET_POLL_INTERVAL_MS
  const quietWindowMs = options.quietWindowMs ?? DEFAULT_LOG_QUIET_WINDOW_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOG_QUIET_TIMEOUT_MS
  let baseline = captureDevtoolsLogBaseline(options)
  let quietSince = Date.now()
  const deadline = quietSince + timeoutMs

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)
    const current = captureDevtoolsLogBaseline(options)
    if (!isSameDevtoolsLogBaseline(baseline, current)) {
      baseline = current
      quietSince = Date.now()
      continue
    }
    if (Date.now() - quietSince >= quietWindowMs) {
      return baseline
    }
  }

  return baseline
}

function isSimulatorBootIssue(line: string) {
  return DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS.some(pattern => pattern.test(line))
}

function isTransientSimulatorNotFoundWarning(lines: string[], index: number) {
  const simulatorId = lines[index]?.match(DEVTOOLS_SIMULATOR_NOT_FOUND_PATTERN)?.[1]
  if (!simulatorId) {
    return false
  }

  return lines.some((line) => {
    return line.match(DEVTOOLS_SIMULATOR_INIT_PATTERN)?.[1] === simulatorId
  })
}

function isRecoveredGenericSimulatorLaunchError(lines: string[], index: number) {
  const line = lines[index] ?? ''
  if (!DEVTOOLS_GENERIC_SIMULATOR_LAUNCH_ERROR_PATTERN.test(line)) {
    return false
  }

  const simulatorContext = line.match(DEVTOOLS_SIMULATOR_CONTEXT_PATTERN)?.[1]
  if (!simulatorContext) {
    return false
  }

  return lines.slice(index + 1).some((candidate) => {
    return DEVTOOLS_SIMULATOR_LAUNCH_SUCCESS_PATTERN.test(candidate)
      && candidate.match(DEVTOOLS_SIMULATOR_CONTEXT_PATTERN)?.[1] === simulatorContext
  })
}

function parseDevtoolsLogLineTime(line: string) {
  const match = line.match(DEVTOOLS_LOG_TIMESTAMP_PATTERN)
  if (!match) {
    return null
  }
  const timestamp = Date.parse(`${match[1]}T${match[2]}.${match[3]}${match[4] || ''}`)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function scanRecentDevtoolsSimulatorBootIssues(options: {
  baseline?: DevtoolsLogBaseline
  rootDir?: string
  sinceMs: number
}): DevtoolsLogIssue[] {
  const rootDir = options.rootDir || resolveDevtoolsLogRoot()
  const issues: DevtoolsLogIssue[] = []

  for (const filePath of resolveRecentLogFiles(rootDir, options.sinceMs)) {
    let content = ''
    try {
      const raw = fs.readFileSync(filePath)
      const baselineSize = options.baseline?.[filePath]
      const start = typeof baselineSize === 'number' && baselineSize > 0 && baselineSize <= raw.length
        ? baselineSize
        : 0
      content = raw.subarray(start).toString('utf8')
    }
    catch {
      continue
    }
    const lines = content.split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      const lineTime = parseDevtoolsLogLineTime(line)
      if (lineTime !== null && lineTime < options.sinceMs - 1_000) {
        continue
      }
      if (
        isSimulatorBootIssue(line)
        && !isTransientSimulatorNotFoundWarning(lines, index)
        && !isRecoveredGenericSimulatorLaunchError(lines, index)
      ) {
        issues.push({ file: filePath, line: line.trim() })
      }
    }
  }

  return issues
}

export function assertNoRecentDevtoolsSimulatorBootIssues(options: {
  label: string
  rootDir?: string
  sinceMs: number
}) {
  const issues = scanRecentDevtoolsSimulatorBootIssues(options)
  if (issues.length === 0) {
    return
  }

  const firstIssue = issues[0]!
  throw new Error(
    `[${options.label}] WeChat DevTools simulator boot error detected in IDE log: ${firstIssue.line}`,
  )
}
