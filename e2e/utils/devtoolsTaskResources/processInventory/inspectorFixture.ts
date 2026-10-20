import type { Buffer } from 'node:buffer'
import { PassThrough, Writable } from 'node:stream'

interface FixtureOptions {
  ready?: string | null
  onReady?: () => void
  response?: (pids: number[]) => string | null
  stderr?: string
  exitCode?: number
  deferExit?: boolean
}

/** 只模拟本次持有的 child 与管道，不读取真实进程或 RSS。 */
export function createInspectorFixture(options: FixtureOptions = {}) {
  const stdout = new PassThrough()
  const events: string[] = []
  let output = ''
  let complete!: (value: { stdout: string, stderr: string, exitCode: number | null, signal?: string }) => void
  const terminal = new Promise<{ stdout: string, stderr: string, exitCode: number | null, signal?: string }>((resolve) => {
    complete = resolve
  })
  stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  const owner = { pid: 99, exitCode: null as number | null, signalCode: null as string | null, stdout, stdin: undefined as Writable | undefined }
  function finish(signal?: string) {
    events.push('exit')
    owner.exitCode = signal ? null : options.exitCode ?? 0
    owner.signalCode = signal ?? null
    stdout.end()
    complete({ stdout: output, stderr: options.stderr ?? '', exitCode: owner.exitCode, signal })
  }
  owner.stdin = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      events.push('request')
      const { pids } = JSON.parse(chunk.toString()) as { pids: number[] }
      const response = options.response
        ? options.response(pids)
        : JSON.stringify({ phase: 'paths', paths: pids.map(pid => ({ pid, executable: `/foreign/${pid}` })) })
      if (response !== null) {
        stdout.write(`${response}\n`)
      }
      callback()
    },
    final(callback) {
      events.push('eof')
      if (!options.deferExit) {
        finish()
      }
      callback()
    },
  })
  const child = Object.assign(terminal, {
    nodeChildProcess: owner,
    kill(signal: string) {
      events.push(`kill:${signal}`)
      if (!options.deferExit) {
        finish(signal)
      }
      return true
    },
  })
  queueMicrotask(() => {
    options.onReady?.()
    events.push('ready')
    if (options.ready !== null) {
      stdout.write(`${options.ready ?? JSON.stringify({ phase: 'ready' })}\n`)
    }
  })
  return { child, owner, events, finish }
}
