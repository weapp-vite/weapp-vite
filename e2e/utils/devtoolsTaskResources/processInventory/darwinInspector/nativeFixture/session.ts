import type { DarwinInspectorPhase, PreparedDarwinInspector } from '../types'
// eslint-disable-next-line e18e/ban-dependencies -- 仅启动并持有当前测试缓存中的原生 helper，不启动 IDE。
import { execa } from 'execa'
import { darwinInspectorLines } from '../lines'
import { parseDarwinInspectorReady, parseDarwinProcessFrame } from '../protocol'

/** 测试持有精确 child handle；任何断言失败都只终结本次启动的子进程。 */
export async function withNativeInspectorFixture<T>(prepared: PreparedDarwinInspector, consume: (session: {
  request: (requestId: number, phase: DarwinInspectorPhase) => Promise<ReturnType<typeof parseDarwinProcessFrame>>
  end: (input?: string) => void
  terminal: Promise<{ exitCode?: number, timedOut?: boolean, signal?: string }>
  stderr: () => string
  assertComplete: () => void
}) => Promise<T>) {
  const child = execa(prepared.executable, [], { reject: false, buffer: false, timeout: 10_000, killSignal: 'SIGKILL' })
  const owner = child.nodeChildProcess
  const terminal = Promise.resolve(child)
  const lines = darwinInspectorLines(owner.stdout, terminal)
  let stderr = ''
  const capture = (chunk: Uint8Array | string) => {
    stderr += chunk.toString()
  }
  owner.stderr?.on('data', capture)
  try {
    if (!owner.pid) {
      throw new Error('Native fixture did not receive its owned child PID.')
    }
    const ready = parseDarwinInspectorReady(await lines.next(5_000), owner.pid, prepared.executable)
    return await consume({
      async request(requestId, phase) {
        const response = lines.next(5_000)
        owner.stdin!.write(`${JSON.stringify({ protocol: 1, requestId, phase, remainingMilliseconds: 10_000 })}\n`)
        return parseDarwinProcessFrame(await response, requestId, phase, ready)
      },
      end(input) {
        owner.stdin!.end(input)
      },
      terminal,
      stderr: () => stderr,
      assertComplete: () => lines.assertComplete(),
    })
  }
  finally {
    if (owner.exitCode === null && owner.signalCode === null) {
      child.kill('SIGKILL')
    }
    await terminal
    owner.stderr?.removeListener('data', capture)
    lines.dispose()
  }
}
