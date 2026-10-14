import type { ChildProcess } from 'node:child_process'
import process from 'node:process'

type QueryChildEvent = 'handle' | 'spawn' | 'error' | 'exit' | 'close' | 'first-stdout' | 'first-stderr'

/** 旁路观察同一个 Node 子进程；不等待 close，不消费正文，不改变查询结果或超时。 */
export function traceWindowsQueryChild<T>(query: 'snapshot' | 'identities', subprocess: Promise<T> & { nodeChildProcess?: ChildProcess }, startedMs: number): Promise<T> {
  const child = subprocess.nodeChildProcess
  if (!child) {
    return subprocess
  }
  const emit = (event: QueryChildEvent, exitCode?: number | null, signal?: NodeJS.Signals | null) => {
    try {
      process.stdout.write(`[e2e-cleanup-query-child] ${JSON.stringify({
        query,
        event,
        pid: child.pid ?? null,
        elapsedMs: Math.round((performance.now() - startedMs) * 100) / 100,
        exitCode,
        signalled: signal === undefined ? undefined : signal !== null,
      })}\n`)
    }
    catch {
      // 只忽略诊断输出自身的错误，不触碰子进程和原始 Promise。
    }
  }
  const onSpawn = () => emit('spawn')
  const onError = () => emit('error')
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => emit('exit', code, signal)
  const onStdout = () => emit('first-stdout')
  const onStderr = () => emit('first-stderr')
  const dispose = () => {
    try {
      child.removeListener('spawn', onSpawn)
      child.removeListener('error', onError)
      child.removeListener('exit', onExit)
      child.stdout?.removeListener('data', onStdout)
      child.stderr?.removeListener('data', onStderr)
    }
    catch {
      // 诊断监听器移除失败不能覆盖正式查询的首错。
    }
  }
  const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
    emit('close', code, signal)
    dispose()
  }
  try {
    child.once('spawn', onSpawn)
    child.once('error', onError)
    child.once('exit', onExit)
    child.stdout?.once('data', onStdout)
    child.stderr?.once('data', onStderr)
    child.once('close', onClose)
    emit('handle')
  }
  catch {
    dispose()
    return subprocess
  }
  // close 可以晚于 Execa 结算；保留这一条一次性监听，但不延后正式结果。
  return subprocess.finally(dispose)
}
