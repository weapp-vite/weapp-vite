import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const DEVTOOLS_LOG_ROOT_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_LOG_ROOT'
const DEVTOOLS_PROFILE_NAME_PATTERN = /^[\w.-]+$/
const DEVTOOLS_LOG_FILE_PATTERN = /\.log$/i
const DEVTOOLS_LOG_TIMESTAMP_PATTERN = /^\[(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\.(\d{3})\]/
const DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS = [
  /simulator launch catch error/i,
  /simulator not found/i,
  /模拟器启动失败/,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
  /subPackages[\s\S]{0,80}undefined/i,
] as const

export interface DevtoolsLogIssue {
  file: string
  line: string
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

function isSimulatorBootIssue(line: string) {
  return DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS.some(pattern => pattern.test(line))
}

function parseDevtoolsLogLineTime(line: string) {
  const match = line.match(DEVTOOLS_LOG_TIMESTAMP_PATTERN)
  if (!match) {
    return null
  }
  const timestamp = Date.parse(`${match[1]}T${match[2]}.${match[3]}`)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function scanRecentDevtoolsSimulatorBootIssues(options: {
  rootDir?: string
  sinceMs: number
}): DevtoolsLogIssue[] {
  const rootDir = options.rootDir || resolveDevtoolsLogRoot()
  const issues: DevtoolsLogIssue[] = []

  for (const filePath of resolveRecentLogFiles(rootDir, options.sinceMs)) {
    let content = ''
    try {
      content = fs.readFileSync(filePath, 'utf8')
    }
    catch {
      continue
    }
    for (const line of content.split(/\r?\n/)) {
      const lineTime = parseDevtoolsLogLineTime(line)
      if (lineTime !== null && lineTime < options.sinceMs - 1_000) {
        continue
      }
      if (isSimulatorBootIssue(line)) {
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
