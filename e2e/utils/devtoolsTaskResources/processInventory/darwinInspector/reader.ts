import type { DarwinInspectorReader, PreparedDarwinInspector } from './types'
// eslint-disable-next-line e18e/ban-dependencies -- 一个受持有的 Darwin helper，默认保留父进程退出清理。
import { execa } from 'execa'
import { verifyPreparedDarwinInspector } from './compiler'
import { darwinInspectorLines } from './lines'
import { parseDarwinInspectorReady, parseDarwinProcessFrame } from './protocol'
import { DARWIN_INSPECTOR_PHASES } from './types'

function remaining(deadline: number) {
  const value = Math.floor(deadline - Date.now())
  if (!Number.isSafeInteger(value) || value <= 0 || value > 10_000) {
    throw new Error('Darwin inspector exhausted or received an invalid shared inspection budget.')
  }
  return value
}

/** 只消费预算开始前准备好的产物；整个消费过程持有同一个 helper。 */
export async function withDarwinInspector<T>(deadline: number, consume: (reader: DarwinInspectorReader) => Promise<T>, prepared: PreparedDarwinInspector): Promise<T> {
  remaining(deadline)
  const artifact = await verifyPreparedDarwinInspector(prepared)
  const child = execa(artifact.executable, [], { timeout: remaining(deadline), reject: false, buffer: false, killSignal: 'SIGKILL' })
  const owner = child.nodeChildProcess
  const terminal = Promise.resolve(child)
  const lines = darwinInspectorLines(owner.stdout, terminal)
  let stderr = ''
  const captureStderr = (chunk: Uint8Array | string) => {
    stderr += chunk.toString()
    if (stderr.length > 65_536) {
      stderr = stderr.slice(0, 65_536)
    }
  }
  owner.stderr?.on('data', captureStderr)
  let failure: unknown
  let outcome: T | undefined
  let closed = false
  let requesting = false
  let phaseIndex = 0
  let lastEnd = 0n
  try {
    if (!owner.pid) {
      throw new Error('Darwin inspector did not return an owned child PID.')
    }
    const ready = parseDarwinInspectorReady(await lines.next(Math.min(5_000, remaining(deadline))), owner.pid, artifact.executable)
    lines.assertComplete()
    const reader: DarwinInspectorReader = {
      async readFrame(phase) {
        try {
          if (failure || closed || requesting || phaseIndex >= DARWIN_INSPECTOR_PHASES.length || phase !== DARWIN_INSPECTOR_PHASES[phaseIndex]
            || !owner.stdin || owner.stdin.destroyed || owner.stdin.writableEnded) {
            throw failure ?? new Error('Darwin inspector request is out of phase or unavailable.')
          }
          lines.assertComplete()
          const timeout = remaining(deadline)
          const requestId = phaseIndex + 1
          requesting = true
          const response = lines.next(timeout)
          const written = new Promise<void>((resolve, reject) => {
            owner.stdin!.write(`${JSON.stringify({ protocol: 1, requestId, phase, remainingMilliseconds: timeout })}\n`, error => error ? reject(error) : resolve())
          })
          const [line] = await Promise.all([response, written])
          const frame = parseDarwinProcessFrame(line, requestId, phase, ready)
          if (BigInt(frame.startedAtNanoseconds) < lastEnd) {
            throw new Error('Darwin inspector returned an old frame interval.')
          }
          lastEnd = BigInt(frame.endedAtNanoseconds)
          lines.assertComplete()
          phaseIndex++
          return frame
        }
        catch (error) {
          failure ??= error
          throw error
        }
        finally {
          requesting = false
        }
      },
    }
    outcome = await consume(reader)
    if (phaseIndex < 2) {
      throw new Error('Darwin inspector requires both prepare and the single anchor phase.')
    }
    lines.assertComplete()
  }
  catch (error) {
    failure ??= error
  }
  closed = true
  try {
    if (owner.stdin && !owner.stdin.destroyed && !owner.stdin.writableEnded) {
      owner.stdin.end()
    }
  }
  catch (error) {
    failure = failure ? new AggregateError([failure, error], 'Darwin inspector stdin cleanup failed.') : error
  }
  if (failure && owner.pid && owner.exitCode === null && owner.signalCode === null) {
    try {
      child.kill('SIGKILL')
    }
    catch (error) {
      failure = new AggregateError([failure, error], 'Darwin inspector owned-child cleanup failed.')
    }
  }
  try {
    const result = await terminal
    if (result.exitCode !== 0 || result.signal || result.timedOut || stderr.trim()) {
      const error = new Error(`Darwin inspector terminal failed: ${stderr.trim()}`)
      failure = failure ? new AggregateError([failure, error], 'Darwin inspector failed and retained terminal evidence.') : error
    }
    lines.assertComplete()
  }
  catch (error) {
    failure = failure ? new AggregateError([failure, error], 'Darwin inspector terminal cleanup failed.') : error
  }
  finally {
    owner.stderr?.removeListener('data', captureStderr)
    lines.dispose()
  }
  if (failure) {
    throw failure
  }
  return outcome as T
}
