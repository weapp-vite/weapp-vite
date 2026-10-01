/* eslint-disable e18e/ban-dependencies -- e2e dev 进程控制需要 execa 驱动子进程并清理残留 watcher。 */
import type { Options } from 'execa'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { createDevProcessDiagnostics } from './devProcessDiagnostics'
import { captureDevProcessOutput } from './devProcessStdio'
import { resolveReportProjectPath } from './ideWarningReport'

interface DevProcessExitInfo {
  exitCode: number | null | undefined
  signal: string | undefined
  reason: string
}

interface DevProcessController {
  pid: number | undefined
  waitFor: <T>(task: Promise<T>, description: string) => Promise<T>
  waitForOutput: (matcher: string | RegExp, description: string, timeoutMs?: number) => Promise<string>
  waitForInitialBuild: (timeoutMs?: number) => Promise<string>
  getOutput: () => string
  stop: (forceKillDelayMs?: number) => Promise<void>
}

interface DevProcessSpawnInfo {
  args: readonly string[]
  command: string
  cwd?: string | URL
}

const TRACKED_DEV_DISPOSERS = new Set<(forceKillDelayMs: number) => Promise<void>>()

interface ProcessEntry {
  pid: number
  ppid: number
  command: string
}

const PROCESS_ENTRY_SEPARATOR_RE = /\s+/

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return String(error)
}

function formatExitInfo(info: DevProcessExitInfo) {
  const parts = [
    `exitCode=${info.exitCode == null ? 'unknown' : String(info.exitCode)}`,
    `signal=${info.signal ?? 'none'}`,
  ]
  if (info.reason) {
    parts.push(`reason=${info.reason}`)
  }
  return parts.join(', ')
}

function appendRecentOutput(
  message: string,
  outputChunks: string[],
  spawnInfo?: DevProcessSpawnInfo,
) {
  const output = outputChunks.join('')
  const spawnDetail = spawnInfo
    ? [
        `command=${spawnInfo.command}`,
        `args=${spawnInfo.args.join(' ')}`,
        ...(spawnInfo.cwd ? [`cwd=${String(spawnInfo.cwd)}`] : []),
      ].join('\n')
    : ''
  if (!output.trim()) {
    return spawnDetail ? `${message}\n\nDev process:\n${spawnDetail}` : message
  }

  const recentOutput = output.length > 12000
    ? output.slice(-12000)
    : output

  return `${message}${spawnDetail ? `\n\nDev process:\n${spawnDetail}` : ''}\n\nRecent dev output:\n${recentOutput}`
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}

async function listUnixProcesses() {
  const { stdout } = await execa('ps', ['-Ao', 'pid=,ppid=,command='], {
    stdin: 'ignore',
  })

  return stdout
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return null
      }

      const [pidSegment, ppidSegment, ...commandSegments] = trimmed.split(PROCESS_ENTRY_SEPARATOR_RE)
      if (!pidSegment || !ppidSegment || commandSegments.length === 0) {
        return null
      }

      return {
        pid: Number(pidSegment),
        ppid: Number(ppidSegment),
        command: commandSegments.join(' '),
      } satisfies ProcessEntry
    })
    .filter((entry): entry is ProcessEntry => entry != null)
}

function collectProcessTreePids(rootPid: number, processList: ProcessEntry[]) {
  const childrenMap = new Map<number, number[]>()
  for (const processEntry of processList) {
    if (!childrenMap.has(processEntry.ppid)) {
      childrenMap.set(processEntry.ppid, [])
    }
    childrenMap.get(processEntry.ppid)!.push(processEntry.pid)
  }

  const orderedPids: number[] = []
  const visit = (pid: number) => {
    const childPidList = childrenMap.get(pid) ?? []
    for (const childPid of childPidList) {
      visit(childPid)
    }
    orderedPids.push(pid)
  }
  visit(rootPid)
  return orderedPids
}

async function terminateWindowsPid(pid: number, forceKillDelayMs: number) {
  await execa('taskkill', ['/PID', String(pid), '/T', '/F'], {
    reject: false,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  })

  const deadline = Date.now() + forceKillDelayMs
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return
    }
    await sleep(100)
  }
}

async function terminatePid(pid: number, forceKillDelayMs: number, isHeld: () => boolean) {
  if (!isHeld() || !isPidAlive(pid)) {
    return
  }

  if (process.platform === 'win32') {
    await terminateWindowsPid(pid, forceKillDelayMs)
    return
  }

  let targetPidList = [pid]
  try {
    const processList = await listUnixProcesses()
    targetPidList = collectProcessTreePids(pid, processList)
  }
  catch {}

  if (!isHeld()) {
    return
  }

  try {
    for (const targetPid of targetPidList) {
      if (!isHeld()) {
        return
      }
      process.kill(targetPid, 'SIGTERM')
    }
  }
  catch {}

  const deadline = Date.now() + forceKillDelayMs
  while (Date.now() < deadline) {
    if (targetPidList.every(targetPid => !isPidAlive(targetPid))) {
      return
    }
    await sleep(100)
  }

  try {
    for (const targetPid of targetPidList) {
      if (!isHeld()) {
        return
      }
      if (isPidAlive(targetPid)) {
        process.kill(targetPid, 'SIGKILL')
      }
    }
  }
  catch {}
}

async function waitForExitWithTimeout(
  settledExit: Promise<DevProcessExitInfo>,
  timeoutMs: number,
) {
  await Promise.race([
    settledExit,
    sleep(timeoutMs),
  ])
}

export async function cleanupTrackedDevProcesses(forceKillDelayMs = 3_000) {
  for (const dispose of [...TRACKED_DEV_DISPOSERS]) {
    await dispose(forceKillDelayMs)
  }
}

export function startDevProcess(
  command: string,
  args: readonly string[],
  options?: Options,
): DevProcessController {
  const spawnInfo: DevProcessSpawnInfo = {
    args,
    command,
    cwd: options?.cwd,
  }
  const child = execa(command, args, {
    ...captureDevProcessOutput(options),
    env: options?.env ?? process.env,
    extendEnv: false,
  })
  let exited = false
  let stopTask: Promise<void> | undefined
  const outputChunks: string[] = []
  const projectPath = options?.cwd instanceof URL ? fileURLToPath(options.cwd) : options?.cwd
  const diagnostics = createDevProcessDiagnostics(resolveReportProjectPath(projectPath))

  const appendOutput = (chunk: unknown) => {
    if (typeof chunk === 'string') {
      outputChunks.push(chunk)
      diagnostics.write(chunk)
      return
    }
    if (chunk instanceof Uint8Array) {
      outputChunks.push(Buffer.from(chunk).toString('utf8'))
      diagnostics.write(chunk)
    }
  }

  if (child.all) {
    child.all.on('data', appendOutput)
  }
  else {
    child.stdout?.on('data', appendOutput)
    child.stderr?.on('data', appendOutput)
  }

  const settledExit: Promise<DevProcessExitInfo> = child
    .then(result => ({
      exitCode: result.exitCode,
      signal: result.signal ?? undefined,
      reason: 'process exited unexpectedly',
    }))
    .catch((error: unknown) => {
      const candidate = error as {
        exitCode?: number | null
        signal?: string
        shortMessage?: string
        stderr?: string
      }
      const reason = candidate.stderr?.trim() || candidate.shortMessage || normalizeErrorMessage(error)
      return {
        exitCode: candidate.exitCode,
        signal: candidate.signal,
        reason,
      }
    })

  const waitFor = async <T>(task: Promise<T>, description: string) => {
    const winner = await Promise.race([
      task
        .then(value => ({ type: 'task' as const, value }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(appendRecentOutput(message, outputChunks, spawnInfo))
        }),
      settledExit.then(info => ({ type: 'exit' as const, info })),
    ])
    if (winner.type === 'task') {
      return winner.value
    }
    throw new Error(appendRecentOutput(
      `Dev process exited before ${description}: ${formatExitInfo(winner.info)}`,
      outputChunks,
      spawnInfo,
    ))
  }

  const waitForOutput = async (matcher: string | RegExp, description: string, timeoutMs = 90_000) => {
    if (!child.all && !child.stdout && !child.stderr) {
      throw new Error(appendRecentOutput(`Waiting for ${description} requires captured stdout or stderr; use pipe or inherit output`, outputChunks, spawnInfo))
    }
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const output = outputChunks.join('')
      const matched = typeof matcher === 'string'
        ? output.includes(matcher)
        : matcher.test(output)
      if (matched) {
        return output
      }
      const exited = await Promise.race([
        sleep(200).then(() => false),
        settledExit.then(() => true),
      ])
      if (exited) {
        break
      }
    }
    throw new Error(appendRecentOutput(`Timed out waiting for dev output: ${description}`, outputChunks, spawnInfo))
  }

  const stop = (forceKillDelayMs = 3_000) => {
    if (!stopTask) {
      stopTask = (async () => {
        TRACKED_DEV_DISPOSERS.delete(stop)
        // 原子持有清理任务，避免 stop 与恢复并发释放；退出的句柄不再授权旧 PID。
        if (exited) {
          return
        }
        if (child.nodeChildProcess?.exitCode != null || child.nodeChildProcess?.signalCode != null) {
          // 原生进程退出先撤销终止权限，仍等待 execa 排空输出并完成诊断。
          await waitForExitWithTimeout(settledExit, forceKillDelayMs + 1_000)
          return
        }
        if (typeof child.pid === 'number') {
          await terminatePid(child.pid, forceKillDelayMs, () => !exited && child.nodeChildProcess?.exitCode == null && child.nodeChildProcess?.signalCode == null)
        }
        else {
          child.kill('SIGTERM')
        }
        await waitForExitWithTimeout(settledExit, forceKillDelayMs + 1_000)
      })()
    }
    return stopTask
  }
  TRACKED_DEV_DISPOSERS.add(stop)

  void settledExit.finally(() => {
    diagnostics.flush()
    exited = true
    TRACKED_DEV_DISPOSERS.delete(stop)
  })

  return {
    pid: child.pid,
    waitFor,
    waitForOutput,
    waitForInitialBuild: (timeoutMs?: number) => waitForOutput('小程序初次构建完成', 'mini program initial build completion', timeoutMs),
    getOutput: () => outputChunks.join(''),
    stop,
  }
}
