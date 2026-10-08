import type { DevtoolsLogIssue, DevtoolsSimulatorBootDiagnostic } from './devtoolsSimulatorBootDiagnostics'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { classifyDevtoolsSimulatorBootLine } from './devtoolsSimulatorBootDiagnostics'

export type { DevtoolsLogIssue, DevtoolsSimulatorBootDiagnostic } from './devtoolsSimulatorBootDiagnostics'

const DEVTOOLS_LOG_ROOT_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_LOG_ROOT'
const DEVTOOLS_PROFILE_NAME_PATTERN = /^[\w.-]+$/
const DEVTOOLS_LOG_FILE_PATTERN = /\.log$/i
const DEVTOOLS_LOG_TIMESTAMP_PATTERN = /^\[(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\.(\d{3})(Z|[+-]\d{2}:\d{2})?\]/
const DEVTOOLS_UTILITY_PROCESS_OPEN_PATTERN = /utility process .*\bopened\b/i
const DEVTOOLS_UTILITY_PROCESS_CLOSE_PATTERN = /utility process (?:exit!|.*\bdestroyed\b)/i

export type DevtoolsLogBaseline = Record<string, number>

// DevTools 在项目窗口销毁后可能要数秒才重建 backend utility process。
// 清理门禁会在发现退出事件后等待对应的 opened 事件，再观察稳定窗口；
// 总预算只作为宿主没有给出重启回执时的硬上限。
const DEFAULT_LOG_QUIET_WINDOW_MS = 2_000
const DEFAULT_LOG_QUIET_POLL_INTERVAL_MS = 100
const DEFAULT_LOG_QUIET_TIMEOUT_MS = 30_000
const DEFAULT_UTILITY_RESTART_GRACE_MS = 5_000

interface DevtoolsUtilityProcessEvent {
  at: number
  kind: 'closed' | 'opened'
}

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

function parseDevtoolsLogLineTime(line: string) {
  const match = line.match(DEVTOOLS_LOG_TIMESTAMP_PATTERN)
  if (!match) {
    return null
  }
  const timestamp = Date.parse(`${match[1]}T${match[2]}.${match[3]}${match[4] || ''}`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function resolveLatestDevtoolsUtilityProcessEvent(rootDir: string): DevtoolsUtilityProcessEvent | undefined {
  let latest: DevtoolsUtilityProcessEvent | undefined
  for (const logDir of resolveWeappLogDirs(rootDir)) {
    for (const entry of safeReadDir(logDir)) {
      if (!entry.isFile() || !DEVTOOLS_LOG_FILE_PATTERN.test(entry.name)) {
        continue
      }
      const filePath = path.join(logDir, entry.name)
      const stat = safeStat(filePath)
      if (!stat) {
        continue
      }
      let content = ''
      try {
        const raw = fs.readFileSync(filePath)
        content = raw.subarray(Math.max(0, raw.length - 128 * 1024)).toString('utf8')
      }
      catch {
        continue
      }
      for (const line of content.split(/\r?\n/)) {
        const kind = DEVTOOLS_UTILITY_PROCESS_OPEN_PATTERN.test(line)
          ? 'opened'
          : DEVTOOLS_UTILITY_PROCESS_CLOSE_PATTERN.test(line)
            ? 'closed'
            : undefined
        if (!kind) {
          continue
        }
        const at = parseDevtoolsLogLineTime(line) ?? stat.mtimeMs
        if (!latest || at >= latest.at) {
          latest = { at, kind }
        }
      }
    }
  }
  return latest
}

export async function waitForDevtoolsLogQuiescence(options: {
  pollIntervalMs?: number
  quietWindowMs?: number
  rootDir?: string
  timeoutMs?: number
  utilityRestartGraceMs?: number
} = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_LOG_QUIET_POLL_INTERVAL_MS
  const quietWindowMs = options.quietWindowMs ?? DEFAULT_LOG_QUIET_WINDOW_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOG_QUIET_TIMEOUT_MS
  const utilityRestartGraceMs = options.utilityRestartGraceMs ?? DEFAULT_UTILITY_RESTART_GRACE_MS
  const rootDir = options.rootDir || resolveDevtoolsLogRoot()
  let baseline = captureDevtoolsLogBaseline(options)
  let quietSince = Date.now()
  const deadline = quietSince + timeoutMs
  const initialUtilityEvent = resolveLatestDevtoolsUtilityProcessEvent(rootDir)
  const pendingUtilityRestartAt = initialUtilityEvent?.kind === 'closed' ? initialUtilityEvent.at : undefined
  let utilityRestartObserved = pendingUtilityRestartAt === undefined
  const utilityRestartDeadline = pendingUtilityRestartAt === undefined
    ? undefined
    : Date.now() + Math.min(timeoutMs, Math.max(0, utilityRestartGraceMs))

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)
    const current = captureDevtoolsLogBaseline(options)
    if (!utilityRestartObserved && pendingUtilityRestartAt !== undefined) {
      const utilityEvent = resolveLatestDevtoolsUtilityProcessEvent(rootDir)
      if (utilityEvent?.kind === 'opened' && utilityEvent.at > pendingUtilityRestartAt) {
        utilityRestartObserved = true
        quietSince = Date.now()
      }
    }
    if (!isSameDevtoolsLogBaseline(baseline, current)) {
      baseline = current
      quietSince = Date.now()
      continue
    }
    const restartGraceElapsed = utilityRestartDeadline !== undefined && Date.now() >= utilityRestartDeadline
    if ((utilityRestartObserved || restartGraceElapsed) && Date.now() - quietSince >= quietWindowMs) {
      return baseline
    }
  }

  return baseline
}

interface DevtoolsLogScanOptions {
  baseline?: DevtoolsLogBaseline
  rootDir?: string
  sinceMs: number
}

export function scanRecentDevtoolsSimulatorBootDiagnostics(options: DevtoolsLogScanOptions): DevtoolsSimulatorBootDiagnostic[] {
  const rootDir = options.rootDir || resolveDevtoolsLogRoot()
  const issues: DevtoolsSimulatorBootDiagnostic[] = []

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
      const diagnostic = classifyDevtoolsSimulatorBootLine(lines, index)
      if (diagnostic) {
        // IDE 的 launch().catch(...).then(...) 在失败后也会记录 success，不能据此丢弃首错。
        issues.push({ file: filePath, line: line.trim(), ...diagnostic })
      }
    }
  }

  return issues
}

export function scanRecentDevtoolsSimulatorBootIssues(options: DevtoolsLogScanOptions): DevtoolsLogIssue[] {
  return scanRecentDevtoolsSimulatorBootDiagnostics(options)
    .filter(issue => issue.state !== 'recovered')
    .map(({ file, line }) => ({ file, line }))
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
