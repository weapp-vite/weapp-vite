import { execFileSync } from 'node:child_process'
import { rmSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const DEFAULT_STALE_MS = 10 * 60 * 1000

function parseUnixProcessList(output) {
  return output
    .split('\n')
    .map((line) => {
      const fields = line.trim().split(/\s+/)
      if (fields.length < 3 || !/^\d+$/.test(fields[0]) || !/^\d+$/.test(fields[1])) {
        return null
      }
      return { pid: Number(fields[0]), ppid: Number(fields[1]), command: fields.slice(2).join(' ') }
    })
    .filter(Boolean)
}

function parseWindowsProcessList(output) {
  return output
    .split('\n')
    .map((line) => {
      const fields = [...line.matchAll(/"([^"]*)"/g)].map(match => match[1])
      if (fields.length < 2 || !/^\d+$/.test(fields[1])) {
        return null
      }
      return { pid: Number(fields[1]), ppid: null, command: fields[0] }
    })
    .filter(Boolean)
}

export function isGitProcessCommand(command) {
  const executable = command.trim().split(/\s+/, 1)[0]?.replace(/^['"]|['"]$/g, '') ?? ''
  return /(?:^|[\\/])git(?:\.exe)?$/i.test(executable)
}

export function findActiveGitProcesses(processes) {
  return processes.filter(processInfo => isGitProcessCommand(processInfo.command))
}

export function parseProcessList(output, platform = process.platform) {
  return platform === 'win32'
    ? parseWindowsProcessList(output)
    : parseUnixProcessList(output)
}

export function listProcesses({ platform = process.platform, execFileSyncImpl = execFileSync } = {}) {
  try {
    const output = platform === 'win32'
      ? execFileSyncImpl('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' })
      : execFileSyncImpl('ps', ['-eo', 'pid=,ppid=,command='], { encoding: 'utf8' })
    return parseProcessList(output, platform)
  }
  catch {
    return []
  }
}

export function resolveGitIndexLockPath({ cwd = process.cwd(), execFileSyncImpl = execFileSync } = {}) {
  const output = execFileSyncImpl('git', ['rev-parse', '--git-path', 'index.lock'], {
    cwd,
    encoding: 'utf8',
  }).trim()
  return path.resolve(cwd, output)
}

export function assessIndexLock({
  lockPath,
  now = Date.now(),
  staleMs = DEFAULT_STALE_MS,
  statSyncImpl = statSync,
  activeProcesses = [],
} = {}) {
  if (!lockPath) {
    throw new TypeError('lockPath is required')
  }

  let stats
  try {
    stats = statSyncImpl(lockPath)
  }
  catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        exists: false,
        lockPath,
        activeProcesses,
        ageMs: null,
        stale: false,
      }
    }
    throw error
  }

  const ageMs = Math.max(0, now - stats.mtimeMs)
  return {
    exists: true,
    lockPath,
    activeProcesses,
    ageMs,
    stale: ageMs >= staleMs,
  }
}

function formatAge(ageMs) {
  if (ageMs < 1000) {
    return `${Math.round(ageMs)}ms`
  }
  return `${Math.round(ageMs / 1000)}s`
}

function formatProcesses(processes) {
  return processes
    .slice(0, 6)
    .map(processInfo => `- pid ${processInfo.pid}: ${processInfo.command}`)
    .join('\n')
}

export function parseStaleMs(argv = process.argv.slice(2)) {
  const value = argv.find(arg => arg.startsWith('--stale-ms='))?.slice('--stale-ms='.length)
  if (!value) {
    return DEFAULT_STALE_MS
  }
  const staleMs = Number(value)
  if (!Number.isFinite(staleMs) || staleMs < 0) {
    throw new Error(`Invalid --stale-ms value: ${value}`)
  }
  return staleMs
}

export function inspectIndexLock({ cwd = process.cwd(), staleMs = DEFAULT_STALE_MS } = {}) {
  const lockPath = resolveGitIndexLockPath({ cwd })
  const activeProcesses = findActiveGitProcesses(listProcesses())
  return assessIndexLock({
    lockPath,
    staleMs,
    activeProcesses,
  })
}

export function formatDoctorReport(state) {
  if (!state.exists) {
    return `[git-index-lock] no index lock found: ${state.lockPath}`
  }

  const lines = [
    `[git-index-lock] found: ${state.lockPath}`,
    `[git-index-lock] age: ${formatAge(state.ageMs)} (${state.stale ? 'past stale threshold' : 'recent'})`,
  ]
  if (state.activeProcesses.length > 0) {
    lines.push('[git-index-lock] active Git processes detected:', formatProcesses(state.activeProcesses))
  }
  else {
    lines.push('[git-index-lock] no active Git process detected')
  }
  return lines.join('\n')
}

export function cleanIndexLock(state, { removeSyncImpl = rmSync } = {}) {
  if (!state.exists) {
    return { removed: false, reason: 'missing' }
  }
  if (state.activeProcesses.length > 0) {
    return { removed: false, reason: 'active-git-process' }
  }
  if (!state.stale) {
    return { removed: false, reason: 'recent-lock' }
  }

  removeSyncImpl(state.lockPath, { force: true })
  return { removed: true, reason: 'stale-lock' }
}

function printUsage() {
  console.log('Usage: node scripts/git-index-lock-doctor.mjs <doctor|clean> [--stale-ms=<milliseconds>]')
}

export function run(command, {
  cwd = process.cwd(),
  staleMs = parseStaleMs(),
} = {}) {
  if (command !== 'doctor' && command !== 'clean') {
    printUsage()
    return 2
  }

  const state = inspectIndexLock({ cwd, staleMs })
  console.log(formatDoctorReport(state))
  if (command === 'doctor') {
    return state.exists ? 1 : 0
  }

  const result = cleanIndexLock(state)
  if (result.removed) {
    console.log(`[git-index-lock] removed stale lock: ${state.lockPath}`)
    return 0
  }
  if (result.reason === 'missing') {
    return 0
  }
  if (result.reason === 'active-git-process') {
    console.error('[git-index-lock] refusing to remove the lock while a Git process is active')
  }
  else {
    console.error('[git-index-lock] refusing to remove a recent lock; wait for Git to finish or inspect the process manually')
  }
  return 1
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  process.exitCode = run(process.argv[2])
}
