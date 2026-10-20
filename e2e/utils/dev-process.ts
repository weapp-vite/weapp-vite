/* eslint-disable e18e/ban-dependencies -- e2e dev 进程控制需要 execa 驱动子进程并清理残留 watcher。 */
import type { Options } from 'execa'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { createDevProcessCleanup } from './devProcessCleanup'
import { createDevProcessDiagnostics } from './devProcessDiagnostics'
import { captureDevProcessOutput } from './devProcessStdio'
import { createDevProcessTrace } from './devProcessTrace'
import { resolveReportProjectPath } from './ideWarningReport'

interface DevProcessExitInfo {
  exitCode: number | null | undefined
  signal: string | undefined
  reason: string
  error?: unknown
}

interface DevProcessController {
  pid: number | undefined
  waitFor: <T>(task: Promise<T>, description: string) => Promise<T>
  waitForOutput: (matcher: string | RegExp, description: string, timeoutMs?: number) => Promise<string>
  waitForInitialBuild: (timeoutMs?: number) => Promise<string>
  getOutput: () => string
  getBuildErrors: () => readonly string[]
  stop: (forceKillDelayMs?: number) => Promise<void>
}

interface DevProcessSpawnInfo {
  args: readonly string[]
  command: string
  cwd?: string | URL
}

const TRACKED_DEV_DISPOSERS = new Set<(forceKillDelayMs: number) => Promise<void>>()

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
  const projectPath = options?.cwd instanceof URL ? fileURLToPath(options.cwd) : options?.cwd
  const project = resolveReportProjectPath(projectPath)
  const trace = createDevProcessTrace(project)
  const withTraceFailure = (error: unknown) => {
    const traceFailure = trace?.getFailure()
    return traceFailure ? new AggregateError([error, traceFailure], 'Dev process and output trace failed.', { cause: error }) : error
  }
  const spawn = () => {
    try {
      return execa(command, args, {
        ...captureDevProcessOutput(options),
        env: options?.env ?? process.env,
        extendEnv: false,
      })
    }
    catch (error) {
      trace?.close({ reason: 'spawn-failed' })
      throw withTraceFailure(error)
    }
  }
  const child = spawn()
  let exited = false
  let stopTask: Promise<void> | undefined
  let stopSucceeded = false
  const outputChunks: string[] = []
  const diagnostics = createDevProcessDiagnostics(project)

  const appendOutput = (stream: 'all' | 'stdout' | 'stderr', chunk: unknown) => {
    if (typeof chunk === 'string') {
      trace?.write(stream, chunk)
      outputChunks.push(chunk)
      diagnostics.write(chunk)
      return
    }
    if (chunk instanceof Uint8Array) {
      trace?.write(stream, chunk)
      outputChunks.push(Buffer.from(chunk).toString('utf8'))
      diagnostics.write(chunk)
    }
  }

  if (child.all) {
    child.all.on('data', chunk => appendOutput('all', chunk))
  }
  else {
    child.stdout?.on('data', chunk => appendOutput('stdout', chunk))
    child.stderr?.on('data', chunk => appendOutput('stderr', chunk))
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
        error,
      }
    })

  const waitFor = async <T>(task: Promise<T>, description: string) => {
    const winner = await Promise.race([
      task
        .then(value => ({ type: 'task' as const, value }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          throw withTraceFailure(new Error(appendRecentOutput(message, outputChunks, spawnInfo), { cause: error }))
        }),
      settledExit.then(info => ({ type: 'exit' as const, info })),
    ])
    if (winner.type === 'task') {
      if (trace?.getFailure()) {
        throw trace.getFailure()
      }
      return winner.value
    }
    throw withTraceFailure(new Error(appendRecentOutput(
      `Dev process exited before ${description}: ${formatExitInfo(winner.info)}`,
      outputChunks,
      spawnInfo,
    ), { cause: winner.info.error }))
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
    throw withTraceFailure(new Error(appendRecentOutput(`Timed out waiting for dev output: ${description}`, outputChunks, spawnInfo)))
  }

  const cleanup = createDevProcessCleanup({
    pid: child.pid,
    settledExit,
    isRootHeld: () => !exited && child.nodeChildProcess?.exitCode == null && child.nodeChildProcess?.signalCode == null,
    disconnectRoot: () => {
      if (!child.nodeChildProcess?.connected) {
        return false
      }
      child.nodeChildProcess.disconnect()
      return true
    },
  })

  const stop = (forceKillDelayMs = 3_000) => {
    const traceFailure = trace?.getFailure()
    if (stopSucceeded && traceFailure) {
      // 已完成的清理不重跑；迟到输出使后续 stop 稳定观察到新的采集失败。
      stopSucceeded = false
      stopTask = Promise.reject(traceFailure)
    }
    if (!stopTask) {
      // 并发调用共享同一次清理；只有核验退出和输出排空后才撤销登记。
      const cleanupTask = cleanup(forceKillDelayMs).then(() => {
        TRACKED_DEV_DISPOSERS.delete(stop)
      }).catch((error: unknown) => {
        stopTask = undefined
        throw withTraceFailure(error)
      })
      stopTask = cleanupTask.then(() => {
        if (trace?.getFailure()) {
          throw trace.getFailure()
        }
        stopSucceeded = true
      })
    }
    return stopTask
  }
  TRACKED_DEV_DISPOSERS.add(stop)

  void settledExit.then((info) => {
    try {
      diagnostics.flush()
    }
    finally {
      trace?.close({ exitCode: info.exitCode, signal: info.signal, reason: 'process-exited' })
      exited = true
    }
  })

  return {
    pid: child.pid,
    waitFor,
    waitForOutput,
    waitForInitialBuild: (timeoutMs?: number) => waitForOutput('小程序初次构建完成', 'mini program initial build completion', timeoutMs),
    getOutput: () => outputChunks.join(''),
    getBuildErrors: diagnostics.getBuildErrors,
    stop,
  }
}
