import type { DevProcessIdentity } from './processes'
import process from 'node:process'
import { sameManagedProcess } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { traceCleanupStage } from '../cleanupTrace'
import { captureDevProcessTree, isDevProcessAlive, killWindowsDevProcesses, readDevProcessIdentities, UnconfirmedDevProcessTreeError } from './processes'

interface DevProcessCleanupOptions {
  pid?: number
  isRootHeld: () => boolean
  disconnectRoot: () => boolean
  settledExit: Promise<unknown>
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function waitForExit(settledExit: Promise<unknown>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      settledExit.then(() => true),
      new Promise<boolean>(resolve => timer = setTimeout(resolve, timeoutMs, false)),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

/** 登记身份跨 stop 重试保留；根退出仅撤销根的权限，不撤销已登记后代的独立身份。 */
export function createDevProcessCleanup(options: DevProcessCleanupOptions) {
  const pending = new Map<number, DevProcessIdentity>()
  let captured = false
  let disconnected = false
  let unconfirmed: UnconfirmedDevProcessTreeError | undefined

  const forgetExitedRoot = () => {
    if (options.pid != null && !options.isRootHeld()) {
      pending.delete(options.pid)
    }
  }

  const reconcileIdentities = async () => {
    forgetExitedRoot()
    const current = await traceCleanupStage('dev-reconcile', () => readDevProcessIdentities([...pending.keys()]), { processCount: pending.size })
    forgetExitedRoot()
    for (const [pid, identity] of pending) {
      const live = current.get(pid)
      if (!live || !sameManagedProcess(identity, live)) {
        pending.delete(pid)
      }
    }
  }

  const waitForOwnedExit = async (timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs
    while (true) {
      forgetExitedRoot()
      for (const pid of pending.keys()) {
        if (!isDevProcessAlive(pid)) {
          pending.delete(pid)
        }
      }
      if (!pending.size) {
        return true
      }
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        return false
      }
      await sleep(Math.min(100, remaining))
    }
  }

  const signalOwned = async (signal: 'SIGTERM' | 'SIGKILL') => {
    await reconcileIdentities()
    if (process.platform === 'win32') {
      await killWindowsDevProcesses([...pending.keys()])
      return
    }
    const errors: unknown[] = []
    for (const pid of pending.keys()) {
      if (pid === options.pid && !options.isRootHeld()) {
        pending.delete(pid)
        continue
      }
      try {
        process.kill(pid, signal)
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
          pending.delete(pid)
        }
        else {
          errors.push(error)
        }
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Failed to signal owned dev processes; cleanup remains registered for retry.')
    }
  }

  return async (forceKillDelayMs: number) => {
    if (unconfirmed) {
      const candidates = [...unconfirmed.pids]
      const current = await traceCleanupStage('dev-recheck-unconfirmed', () => readDevProcessIdentities(candidates), { processCount: candidates.length })
      const remaining = unconfirmed.candidates.filter((candidate) => {
        const live = current.get(candidate.pid)
        return live && (!candidate.started || candidate.started === live.started)
          && (!candidate.executable || candidate.executable === live.executable)
      })
      if (!remaining.length) {
        unconfirmed = undefined
      }
      else {
        unconfirmed = new UnconfirmedDevProcessTreeError(remaining, { cause: unconfirmed.cause })
        if (!options.isRootHeld()) {
          throw unconfirmed
        }
      }
    }
    if (!captured && options.pid != null && options.isRootHeld()) {
      let identities: DevProcessIdentity[]
      try {
        const rootPid = options.pid
        identities = await traceCleanupStage('dev-capture', () => captureDevProcessTree(rootPid, options.isRootHeld))
      }
      catch (error) {
        if (error instanceof UnconfirmedDevProcessTreeError) {
          const candidates = new Map([...(unconfirmed?.candidates ?? []), ...error.candidates].map(candidate => [candidate.pid, candidate]))
          unconfirmed = new UnconfirmedDevProcessTreeError([...candidates.values()], { cause: error.cause })
        }
        throw error
      }
      if (unconfirmed) {
        const remaining = unconfirmed.candidates.filter(candidate => !identities.some(identity => identity.pid === candidate.pid))
        if (remaining.length) {
          unconfirmed = new UnconfirmedDevProcessTreeError(remaining, { cause: unconfirmed.cause })
          throw unconfirmed
        }
        unconfirmed = undefined
      }
      for (const identity of identities) {
        pending.set(identity.pid, identity)
      }
      captured = true
    }
    if (!disconnected && options.isRootHeld() && options.disconnectRoot()) {
      disconnected = true
      await traceCleanupStage('dev-ipc-exit', () => waitForExit(options.settledExit, forceKillDelayMs), { timeoutMs: forceKillDelayMs })
    }
    forgetExitedRoot()
    if (pending.size) {
      if (process.platform !== 'win32') {
        await signalOwned('SIGTERM')
        await traceCleanupStage('dev-owned-exit', () => waitForOwnedExit(forceKillDelayMs), { processCount: pending.size, timeoutMs: forceKillDelayMs })
      }
      if (pending.size) {
        await signalOwned('SIGKILL')
        if (!await traceCleanupStage('dev-owned-exit', () => waitForOwnedExit(forceKillDelayMs + 1_000), { processCount: pending.size, timeoutMs: forceKillDelayMs + 1_000 })) {
          await reconcileIdentities()
          if (pending.size) {
            throw new Error('Owned dev processes did not exit; cleanup remains registered for retry.')
          }
        }
      }
    }
    if (!await traceCleanupStage('dev-stdio-drain', () => waitForExit(options.settledExit, forceKillDelayMs + 1_000), { timeoutMs: forceKillDelayMs + 1_000 })) {
      throw new Error('Dev process exit or stdio drain timed out; cleanup remains registered for retry.')
    }
  }
}
