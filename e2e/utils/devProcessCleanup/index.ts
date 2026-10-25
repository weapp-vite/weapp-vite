import type { DevProcessIdentity } from './processes'
import type { DevProcessForcedShutdown, DevProcessStopOptions } from './shutdown'
import process from 'node:process'
import { sameManagedProcess } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/processIdentity'
import { traceCleanupStage } from '../cleanupTrace'
import { captureDevProcessTree, DevProcessTerminationError, isDevProcessAlive, killWindowsDevProcesses, readDevProcessIdentities, UnconfirmedDevProcessTreeError } from './processes'
import { waitForGracefulExit } from './shutdown'

interface DevProcessCleanupOptions {
  pid?: number
  isRootHeld: () => boolean
  disconnectRoot: () => boolean
  requestRootShutdown?: () => Promise<void>
  settledExit: Promise<unknown>
  /** 完整快照仅缺失根身份时，用原始 ChildProcess 退出事件收敛内核与 JS 通知时序。 */
  confirmRootExit?: (timeoutMs: number) => Promise<boolean>
  /** 根未收到强制信号且全部资源排空后，通知调用方核验 IPC 退出状态。 */
  onIpcExit?: () => void
  /** 正常关闭等待已取消、超时或根已收到强制信号；全部登记进程终结后仍须报告验收失败。 */
  onForcedRootExit?: (evidence: DevProcessForcedShutdown) => void
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
  let rootTerminationRequested = false
  let forcedShutdown: DevProcessForcedShutdown | undefined
  let unconfirmed: UnconfirmedDevProcessTreeError | undefined
  let incompleteCapture: { cause: unknown } | undefined

  const assertCaptureComplete = () => {
    if (incompleteCapture) {
      throw new Error('Dev process snapshot remains incomplete after root exit; descendant ownership cannot be confirmed.', incompleteCapture)
    }
  }

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
      const terminatesRoot = options.pid != null && pending.has(options.pid)
      try {
        await killWindowsDevProcesses([...pending.keys()])
        rootTerminationRequested ||= terminatesRoot
      }
      catch (error) {
        if (!(error instanceof DevProcessTerminationError)) {
          throw error
        }
        // 原生命令启动失败没有终止回执，不能豁免随后自然完成的 IPC 退出核验。
        rootTerminationRequested ||= terminatesRoot
        try {
          await reconcileIdentities()
        }
        catch (inspectionError) {
          throw new AggregateError([error, inspectionError], 'Dev process termination and independent exit verification failed.', { cause: error })
        }
        // 已登记进程可能在核验与 taskkill 派发之间退出；原回执保留，不能仅凭退出码推断终结。
        try {
          process.stdout.write(`[e2e-cleanup-termination] ${JSON.stringify({ ...error.evidence, ownedProcessesTerminated: pending.size === 0 })}\n`)
        }
        catch {
          // 诊断失败不能覆盖原终止错误，也不能改变独立核验得到的清理结果。
        }
        if (pending.size) {
          throw error
        }
      }
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
        rootTerminationRequested ||= pid === options.pid
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

  return async (forceKillDelayMs: number, stopOptions: DevProcessStopOptions = {}) => {
    if (!options.isRootHeld()) {
      assertCaptureComplete()
    }
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
        const timeoutMs = forceKillDelayMs + 1_000
        const confirmRootExit = options.confirmRootExit
        const observeRootExit = confirmRootExit
          ? () => traceCleanupStage('dev-native-root-exit', () => confirmRootExit(timeoutMs), { timeoutMs })
          : undefined
        identities = await traceCleanupStage('dev-capture', () => captureDevProcessTree(rootPid, options.isRootHeld, observeRootExit))
      }
      catch (error) {
        if (error instanceof UnconfirmedDevProcessTreeError) {
          const candidates = new Map([...(unconfirmed?.candidates ?? []), ...error.candidates].map(candidate => [candidate.pid, candidate]))
          unconfirmed = new UnconfirmedDevProcessTreeError([...candidates.values()], { cause: error.cause })
        }
        else {
          incompleteCapture ??= { cause: error }
        }
        throw error
      }
      if (incompleteCapture && !identities.some(identity => identity.pid === options.pid)) {
        assertCaptureComplete()
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
      incompleteCapture = undefined
      captured = true
    }
    assertCaptureComplete()
    if (!disconnected && (options.requestRootShutdown || (options.isRootHeld() && options.disconnectRoot()))) {
      disconnected = true
      const gracefulTimeoutMs = stopOptions.gracefulTimeoutMs ?? forceKillDelayMs
      let requestFailure: { error: unknown } | undefined
      const gracefulExit = options.requestRootShutdown
        ? Promise.race([
            options.settledExit,
            Promise.resolve().then(options.requestRootShutdown).then(() => options.settledExit),
          ]).catch((error: unknown) => {
            // 协议失败先保存，随后仍按登记身份释放进程，不能跳过资源收尾。
            requestFailure = { error }
          })
        : options.settledExit
      const outcome = await traceCleanupStage('dev-ipc-exit', () => waitForGracefulExit(gracefulExit, { ...stopOptions, gracefulTimeoutMs }), { timeoutMs: gracefulTimeoutMs })
      if (outcome !== 'exited' || requestFailure) {
        forcedShutdown = { gracefulTimeoutMs, ...requestFailure ? { requestError: requestFailure.error } : {}, ...(outcome === 'cancelled' ? { cancelled: { reason: stopOptions.signal?.reason } } : {}) }
      }
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
    // 根可先自然退出、后代继续持有输出；全部登记资源结算后才核验 IPC 退出结果。
    if (disconnected) {
      if (forcedShutdown || rootTerminationRequested) {
        options.onForcedRootExit?.(forcedShutdown ?? { gracefulTimeoutMs: stopOptions.gracefulTimeoutMs ?? forceKillDelayMs })
      }
      else {
        options.onIpcExit?.()
      }
    }
  }
}
