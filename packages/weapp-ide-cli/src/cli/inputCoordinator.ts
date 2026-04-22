import process from 'node:process'
import { emitKeypressEvents } from 'node:readline'

export interface SharedInputSessionOptions {
  onData?: (chunk: string | Uint8Array) => void
  onKeypress?: (str: string, key: { name?: string, ctrl?: boolean } | undefined) => void
}

export interface SharedInputSession {
  close: () => void
  resume: () => void
  suspend: () => void
}

export interface ExclusiveKeypressOptions<T> {
  ignoreInitialMs?: number
  timeoutMs?: number
  onKeypress: (
    str: string,
    key: { name?: string, ctrl?: boolean } | undefined,
  ) => T | undefined
}

interface SharedSessionRecord {
  closed: boolean
  options: SharedInputSessionOptions
  suspended: boolean
}

interface ExclusiveKeypressRecord<T> {
  ignoreUntil: number
  onKeypress: ExclusiveKeypressOptions<T>['onKeypress']
  resolve: (value: T | 'timeout') => void
  timeout: ReturnType<typeof setTimeout>
}

const sharedSessions = new Set<SharedSessionRecord>()
const exclusiveKeypressStack: ExclusiveKeypressRecord<unknown>[] = []

let initialized = false
let rawModeEnabled = false
let dataListenerAttached = false
let keypressListenerAttached = false

function hasInteractiveStdin() {
  return Boolean(process.stdin?.isTTY)
}

function canSetRawMode() {
  return typeof process.stdin?.setRawMode === 'function'
}

function updateTerminalState() {
  const shouldKeepInputActive = Array.from(sharedSessions).some(session => !session.closed && !session.suspended)
    || exclusiveKeypressStack.length > 0

  if (canSetRawMode() && rawModeEnabled !== shouldKeepInputActive) {
    process.stdin.setRawMode(shouldKeepInputActive)
    rawModeEnabled = shouldKeepInputActive
  }

  if (shouldKeepInputActive) {
    process.stdin.resume()
    return
  }

  process.stdin.pause()
}

function handleData(chunk: string | Uint8Array) {
  if (exclusiveKeypressStack.length > 0) {
    return
  }

  for (const session of sharedSessions) {
    if (session.closed || session.suspended || !session.options.onData) {
      continue
    }
    session.options.onData(chunk)
  }
}

function handleKeypress(str: string, key: { name?: string, ctrl?: boolean } | undefined) {
  const activeExclusive = exclusiveKeypressStack.at(-1)
  if (activeExclusive) {
    if (Date.now() < activeExclusive.ignoreUntil) {
      return
    }
    const nextValue = activeExclusive.onKeypress(str, key)
    if (nextValue !== undefined) {
      clearTimeout(activeExclusive.timeout)
      exclusiveKeypressStack.pop()
      updateTerminalState()
      activeExclusive.resolve(nextValue)
    }
    return
  }

  for (const session of sharedSessions) {
    if (session.closed || session.suspended || !session.options.onKeypress) {
      continue
    }
    session.options.onKeypress(str, key)
  }
}

function ensureCoordinatorInitialized() {
  if (initialized || !hasInteractiveStdin()) {
    return
  }

  emitKeypressEvents(process.stdin)

  if (!dataListenerAttached) {
    process.stdin.on('data', handleData)
    dataListenerAttached = true
  }
  if (!keypressListenerAttached) {
    process.stdin.on('keypress', handleKeypress)
    keypressListenerAttached = true
  }

  initialized = true
}

export function createSharedInputSession(options: SharedInputSessionOptions): SharedInputSession | undefined {
  if (!hasInteractiveStdin()) {
    return
  }

  ensureCoordinatorInitialized()

  const session: SharedSessionRecord = {
    closed: false,
    options,
    suspended: false,
  }
  sharedSessions.add(session)
  updateTerminalState()

  return {
    close() {
      if (session.closed) {
        return
      }
      session.closed = true
      sharedSessions.delete(session)
      updateTerminalState()
    },
    resume() {
      if (session.closed) {
        return
      }
      session.suspended = false
      updateTerminalState()
    },
    suspend() {
      if (session.closed) {
        return
      }
      session.suspended = true
      updateTerminalState()
    },
  }
}

export async function waitForExclusiveKeypress<T>(
  options: ExclusiveKeypressOptions<T>,
): Promise<T | 'timeout'> {
  if (!hasInteractiveStdin()) {
    return 'timeout'
  }

  ensureCoordinatorInitialized()

  return await new Promise<T | 'timeout'>((resolve) => {
    const normalizedTimeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs && options.timeoutMs > 0
      ? options.timeoutMs
      : 30_000
    const normalizedIgnoreInitialMs = Number.isFinite(options.ignoreInitialMs) && options.ignoreInitialMs && options.ignoreInitialMs > 0
      ? options.ignoreInitialMs
      : 0
    const record: ExclusiveKeypressRecord<T> = {
      ignoreUntil: Date.now() + normalizedIgnoreInitialMs,
      onKeypress: options.onKeypress,
      resolve,
      timeout: setTimeout(() => {
        const index = exclusiveKeypressStack.lastIndexOf(record as ExclusiveKeypressRecord<unknown>)
        if (index >= 0) {
          exclusiveKeypressStack.splice(index, 1)
        }
        updateTerminalState()
        resolve('timeout')
      }, normalizedTimeoutMs),
    }

    exclusiveKeypressStack.push(record as ExclusiveKeypressRecord<unknown>)
    updateTerminalState()
  })
}

export async function runWithSuspendedSharedInput<T>(runner: () => Promise<T>): Promise<T> {
  const previousStates = new Map<SharedSessionRecord, boolean>()

  for (const session of sharedSessions) {
    if (session.closed) {
      continue
    }
    previousStates.set(session, session.suspended)
    session.suspended = true
  }

  if (canSetRawMode() && rawModeEnabled) {
    process.stdin.setRawMode(false)
    rawModeEnabled = false
  }

  process.stdin.resume()

  try {
    return await runner()
  }
  finally {
    for (const [session, suspended] of previousStates) {
      if (!session.closed) {
        session.suspended = suspended
      }
    }
    updateTerminalState()
  }
}
