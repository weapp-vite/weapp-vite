import { Buffer } from 'node:buffer'
import process from 'node:process'
import { execa } from 'execa'

interface DevProcessExitInfo {
  exitCode: number | null | undefined
  signal: string | undefined
  reason: string
}

interface DevProcessController {
  waitFor: <T>(task: Promise<T>, description: string) => Promise<T>
  waitForOutput: (matcher: string | RegExp, description: string, timeoutMs?: number) => Promise<string>
  getOutput: () => string
  stop: (forceKillDelayMs?: number) => Promise<void>
}

const TRACKED_DEV_PIDS = new Set<number>()

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

async function terminatePid(pid: number, forceKillDelayMs: number) {
  if (!isPidAlive(pid)) {
    TRACKED_DEV_PIDS.delete(pid)
    return
  }

  let targetPidList = [pid]
  try {
    const processList = await listUnixProcesses()
    targetPidList = collectProcessTreePids(pid, processList)
  }
  catch {}

  try {
    for (const targetPid of targetPidList) {
      process.kill(targetPid, 'SIGTERM')
    }
  }
  catch {}

  const deadline = Date.now() + forceKillDelayMs
  while (Date.now() < deadline) {
    if (targetPidList.every(targetPid => !isPidAlive(targetPid))) {
      TRACKED_DEV_PIDS.delete(pid)
      return
    }
    await sleep(100)
  }

  try {
    for (const targetPid of targetPidList) {
      if (isPidAlive(targetPid)) {
        process.kill(targetPid, 'SIGKILL')
      }
    }
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

export async function cleanupProcessesByCommandPatterns(
  commandPatterns: readonly string[],
  forceKillDelayMs = 3_000,
) {
  const processList = await listUnixProcesses()
  const matchedPidSet = new Set<number>()

  for (const processEntry of processList) {
    if (commandPatterns.some(pattern => processEntry.command.includes(pattern))) {
      matchedPidSet.add(processEntry.pid)
    }
  }

  for (const pid of matchedPidSet) {
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
  const outputChunks: string[] = []

  const appendOutput = (chunk: unknown) => {
    if (typeof chunk === 'string') {
      outputChunks.push(chunk)
      return
    }
    if (chunk instanceof Uint8Array) {
      outputChunks.push(Buffer.from(chunk).toString('utf8'))
    }
  }

  child.stdout?.on('data', appendOutput)
  child.stderr?.on('data', appendOutput)
  child.all?.on('data', appendOutput)

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

  const waitForOutput = async (matcher: string | RegExp, description: string, timeoutMs = 90_000) => {
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
    throw new Error(`Timed out waiting for dev output: ${description}`)
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
    waitForOutput,
    getOutput: () => outputChunks.join(''),
    stop,
  }
}
