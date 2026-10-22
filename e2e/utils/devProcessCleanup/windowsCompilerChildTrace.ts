import type { ChildProcess } from 'node:child_process'

type CompilerChildEvent = 'handle' | 'spawn' | 'error' | 'exit' | 'close' | 'first-stdout' | 'first-stderr'

interface CompilerChildMarker {
  event: CompilerChildEvent
  elapsedMs: number
  exitCode?: number | null
  signalled?: boolean
}

interface CompilerChildSnapshot {
  phase: 'unavailable' | 'not-spawned' | 'spawn-failed' | 'running' | 'exited-awaiting-close' | 'closed'
  events: CompilerChildMarker[]
}

/** 只在内存旁路记录编译器句柄；调用方仅在失败时附带摘要，成功不产生输出。 */
export function observeWindowsCompilerChild(subprocess: { nodeChildProcess?: ChildProcess }, startedMs: number) {
  const child = subprocess.nodeChildProcess
  const events: CompilerChildMarker[] = []
  const listeners: (() => void)[] = []
  let available = Boolean(child)
  let spawned = child?.pid !== undefined
  let failed = false
  let exited = child != null && (child.exitCode !== null || child.signalCode !== null)
  let closed = false
  const record = (event: CompilerChildEvent, exitCode?: number | null, signal?: NodeJS.Signals | null) => {
    try {
      events.push({ event, elapsedMs: Math.round((performance.now() - startedMs) * 100) / 100, exitCode, signalled: signal === undefined ? undefined : signal !== null })
    }
    catch {
      // 诊断自身失败不能覆盖编译器结果，也不能改变其进程生命周期。
    }
  }
  const dispose = () => {
    for (const remove of listeners.splice(0)) {
      try {
        remove()
      }
      catch {
        // 每个观察监听独立释放，不因其中一个异常遗留其他监听。
      }
    }
  }
  if (child) {
    const onSpawn = () => {
      spawned = true
      record('spawn')
    }
    const onError = () => {
      failed = true
      record('error')
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      exited = true
      record('exit', code, signal)
    }
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      closed = true
      record('close', code, signal)
    }
    const onStdout = () => record('first-stdout')
    const onStderr = () => record('first-stderr')
    try {
      child.once('spawn', onSpawn)
      listeners.push(() => child.removeListener('spawn', onSpawn))
      child.once('error', onError)
      listeners.push(() => child.removeListener('error', onError))
      child.once('exit', onExit)
      listeners.push(() => child.removeListener('exit', onExit))
      child.once('close', onClose)
      listeners.push(() => child.removeListener('close', onClose))
      child.stdout?.once('data', onStdout)
      listeners.push(() => child.stdout?.removeListener('data', onStdout))
      child.stderr?.once('data', onStderr)
      listeners.push(() => child.stderr?.removeListener('data', onStderr))
      record('handle')
    }
    catch {
      available = false
      dispose()
    }
  }
  return {
    snapshot(): CompilerChildSnapshot {
      return {
        phase: !available ? 'unavailable' : closed ? 'closed' : exited ? 'exited-awaiting-close' : failed && !spawned ? 'spawn-failed' : spawned ? 'running' : 'not-spawned',
        events: events.map(event => ({ ...event })),
      }
    },
    dispose,
  }
}
