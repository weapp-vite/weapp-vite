/* eslint-disable e18e/ban-dependencies -- e2e dev 进程控制需要 execa 驱动子进程并清理残留 watcher。 */
import type { Options } from 'execa'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { createDevProcessCleanup } from './devProcessCleanup'
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
    if (!stopTask) {
      // 并发调用共享同一次清理；只有核验退出和输出排空后才撤销登记。
      stopTask = cleanup(forceKillDelayMs).then(() => {
        TRACKED_DEV_DISPOSERS.delete(stop)
      }).catch((error: unknown) => {
        stopTask = undefined
        throw error
      })
    }
    return stopTask
  }
  TRACKED_DEV_DISPOSERS.add(stop)

  void settledExit.finally(() => {
    diagnostics.flush()
    exited = true
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
