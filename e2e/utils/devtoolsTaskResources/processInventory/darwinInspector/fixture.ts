import type { DarwinInspectorReady, DarwinProcessEntry, DarwinProcessFrame, PreparedDarwinInspector } from './types'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { PassThrough, Writable } from 'node:stream'

export type WireFrame = Omit<DarwinProcessFrame, 'rows' | 'ownedHelper'> & { rows: Omit<DarwinProcessEntry, 'gaps'>[] }
// 传输协议描述 Darwin 映像，不能随执行单测的 Windows 宿主变成盘符路径。
export const fixtureExecutable = path.posix.join('/', 'darwin-inspector-fixture')
export const fixtureReady: DarwinInspectorReady = {
  protocol: 1,
  phase: 'ready',
  pid: 99,
  executable: fixtureExecutable,
  identity: { pid: 99, parentPid: 1, uid: 501, status: 2, startedSeconds: '42', startedMicroseconds: '123456', zombie: false },
  abi: { recordSize: 128, taskSize: 96, pathMax: 4096, zombieStatus: 5 },
}
export const fixturePrepared: PreparedDarwinInspector = {
  executable: fixtureExecutable,
  cacheDirectory: path.posix.dirname(fixtureExecutable),
  identityKey: 'identity',
  binaryHash: 'binary',
  metadataHash: 'metadata',
  identity: { sourceHash: 'source', arch: 'fixture', sdkPath: 'sdk', sdkBuild: 'build', compilerPath: 'compiler', compilerHash: 'hash', compilerVersion: 'version' },
}

export function fixtureFrame(requestId = 1): WireFrame {
  const rows = [99, 11].map((pid) => {
    const own = pid === 99
    const identity = { ...fixtureReady.identity, pid }
    const image = own ? fixtureExecutable : path.posix.join('/', 'foreign-fixture')
    return {
      pid,
      enumeratedIdentity: { ...identity },
      startedAtNanoseconds: String(requestId * 100 + 1),
      endedAtNanoseconds: String(requestId * 100 + 9),
      before: { result: 0, length: 128, errno: 0, identity: { ...identity } },
      after: { result: 0, length: 128, errno: 0, identity: { ...identity } },
      pathBefore: { count: Buffer.byteLength(image), errno: 0, executable: image },
      pathAfter: { count: Buffer.byteLength(image), errno: 0, executable: image },
      task: { count: 96, errno: 0, identity: { ...identity }, rssBytes: own ? '100' : '200' },
    }
  })
  return { protocol: 1, requestId, phase: ['prepare', 'anchor', 'closure1', 'closure2'][requestId - 1] as WireFrame['phase'], startedAtNanoseconds: String(requestId * 100), endedAtNanoseconds: String(requestId * 100 + 10), enumeration: { startedAtNanoseconds: String(requestId * 100), endedAtNanoseconds: String(requestId * 100 + 1), complete: true, bytes: 256, recordSize: 128, pidCount: 2, pids: [99, 11], zeroPidCount: 0 }, rows }
}

export const fixtureAbsoluteReady: DarwinInspectorReady = {
  ...fixtureReady,
  absoluteClock: { clockDomain: 'mach-absolute-ticks', timebaseNumerator: 125, timebaseDenominator: 3 },
}

/** Mach ticks 与纳秒刻意使用不同数值，避免错误的时钟域混用仍能通过。 */
export function fixtureAbsoluteFrame(requestId = 1): WireFrame {
  const frame = fixtureFrame(requestId)
  const start = 9007199254740993n + BigInt(requestId) * 1000n
  const birth = (tick: bigint) => ({ result: 0, errno: 0, startedAtTicks: String(tick), endedAtTicks: String(tick + 1n), birthTicks: '42', exitTicks: '0' })
  frame.absolute = {
    clockDomain: 'mach-absolute-ticks',
    startedAtTicks: String(start),
    endedAtTicks: String(start + 100n),
    startCalibration: { monotonicBeforeNanoseconds: frame.startedAtNanoseconds, absoluteTicks: String(start), monotonicAfterNanoseconds: frame.startedAtNanoseconds },
    endCalibration: { monotonicBeforeNanoseconds: frame.endedAtNanoseconds, absoluteTicks: String(start + 100n), monotonicAfterNanoseconds: frame.endedAtNanoseconds },
  }
  frame.rows.forEach((row, index) => {
    const rowStart = start + 10n + BigInt(index) * 30n
    row.absolute = { clockDomain: 'mach-absolute-ticks', startedAtTicks: String(rowStart), endedAtTicks: String(rowStart + 20n), birthBefore: birth(rowStart + 1n), birthAfter: birth(rowStart + 18n) }
    row.confirmation = null
  })
  return frame
}

export function fixtureConfirmation(row: WireFrame['rows'][number]) {
  const start = BigInt(row.absolute!.endedAtTicks)
  const birth = (tick: bigint) => ({ result: 0, errno: 0, startedAtTicks: String(tick), endedAtTicks: String(tick + 1n), birthTicks: row.absolute!.birthAfter.birthTicks, exitTicks: '0' })
  return {
    clockDomain: 'mach-absolute-ticks' as const,
    startedAtTicks: String(start),
    endedAtTicks: String(start + 20n),
    before: structuredClone(row.after),
    after: structuredClone(row.after),
    pathBefore: structuredClone(row.pathAfter),
    pathAfter: structuredClone(row.pathAfter),
    birthBefore: birth(start + 1n),
    birthAfter: birth(start + 18n),
  }
}

/** 只持有内存管道，不执行编译器、helper 或系统进程。 */
export function createDarwinInspectorFixture(options: {
  ready?: string | null
  response?: (frame: WireFrame) => string | null
  stderr?: string
  deferExit?: boolean
} = {}) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const events: string[] = []
  const requests: unknown[] = []
  let complete!: (result: { exitCode: number | null, signal?: string }) => void
  const terminal = new Promise<{ exitCode: number | null, signal?: string }>((resolve) => {
    complete = resolve
  })
  const owner = { pid: 99, stdout, stderr, stdin: undefined as Writable | undefined, exitCode: null as number | null, signalCode: null as string | null }
  let finished = false
  function finish(signal?: string) {
    if (finished) {
      return
    }
    finished = true
    events.push('exit')
    owner.exitCode = signal ? null : 0
    owner.signalCode = signal ?? null
    if (options.stderr) {
      stderr.write(options.stderr)
    }
    stdout.end()
    stderr.end()
    complete({ exitCode: owner.exitCode, signal })
  }
  owner.stdin = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      const request = JSON.parse(chunk.toString()) as { requestId: number }
      requests.push(request)
      events.push('request')
      const frame = fixtureFrame(request.requestId)
      const response = options.response ? options.response(frame) : JSON.stringify(frame)
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
  const child = Object.assign(terminal, { nodeChildProcess: owner, kill(signal: string) {
    events.push(`kill:${signal}`)
    if (!options.deferExit) {
      finish(signal)
    }
    return true
  } })
  let scheduled = false
  stdout.on('newListener', (event) => {
    if (event !== 'data' || scheduled) {
      return
    }
    scheduled = true
    queueMicrotask(() => {
      events.push('ready')
      if (options.ready !== null) {
        stdout.write(`${options.ready ?? JSON.stringify(fixtureReady)}\n`)
      }
    })
  })
  return { child, owner, events, requests, finish }
}
