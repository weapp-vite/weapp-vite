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

export function startDevProcess(
  command: string,
  args: readonly string[],
  options?: Parameters<typeof execa>[2],
): DevProcessController {
  const child = execa(command, args, options)

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
    if (child.exitCode == null) {
      child.kill('SIGTERM')
    }
    const killTimer = setTimeout(() => {
      if (child.exitCode == null) {
        child.kill('SIGKILL')
      }
    }, forceKillDelayMs)
    await settledExit
    clearTimeout(killTimer)
  }

  return {
    waitFor,
    stop,
  }
}
