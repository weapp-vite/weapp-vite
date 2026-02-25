import process from 'node:process'
import { execa } from 'execa'

interface DevProcessExitInfo {
  exitCode: number | null | undefined
  signal: string | undefined
  reason: string
}

interface DevProcessController {
  waitFor: <T>(task: Promise<T>, description: string) => Promise<T>
  stop: (forceKillDelayMs?: number) => Promise<void>
}

const TRACKED_DEV_PIDS = new Set<number>()

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

async function terminatePid(pid: number, forceKillDelayMs: number) {
  if (!isPidAlive(pid)) {
    TRACKED_DEV_PIDS.delete(pid)
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
  }
  catch {}

  const deadline = Date.now() + forceKillDelayMs
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      TRACKED_DEV_PIDS.delete(pid)
      return
    }
    await sleep(100)
  }

  try {
    process.kill(pid, 'SIGKILL')
  }
  catch {}

  TRACKED_DEV_PIDS.delete(pid)
}

export async function cleanupTrackedDevProcesses(forceKillDelayMs = 3_000) {
  const pidList = [...TRACKED_DEV_PIDS]
  for (const pid of pidList) {
    await terminatePid(pid, forceKillDelayMs)
  }
}

export function startDevProcess(
  command: string,
  args: readonly string[],
  options?: Parameters<typeof execa>[2],
): DevProcessController {
  const child = execa(command, args, options)
  if (typeof child.pid === 'number') {
    TRACKED_DEV_PIDS.add(child.pid)
  }

  const settledExit = child.then<DevProcessExitInfo>(
    result => ({
      exitCode: result.exitCode,
      signal: result.signal ?? undefined,
      reason: 'process exited unexpectedly',
    }),
    (error: unknown) => {
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
    },
  )

  void settledExit.finally(() => {
    if (typeof child.pid === 'number') {
      TRACKED_DEV_PIDS.delete(child.pid)
    }
  })

  const waitFor = async <T>(task: Promise<T>, description: string) => {
    const winner = await Promise.race([
      task.then(value => ({ type: 'task' as const, value })),
      settledExit.then(info => ({ type: 'exit' as const, info })),
    ])
    if (winner.type === 'task') {
      return winner.value
    }
    throw new Error(`Dev process exited before ${description}: ${formatExitInfo(winner.info)}`)
  }

  const stop = async (forceKillDelayMs = 3_000) => {
    if (typeof child.pid === 'number') {
      await terminatePid(child.pid, forceKillDelayMs)
    }
    else if (child.exitCode == null) {
      child.kill('SIGTERM')
    }
    await settledExit
  }

  return {
    waitFor,
    stop,
  }
}
