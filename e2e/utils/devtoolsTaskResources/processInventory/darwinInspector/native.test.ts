import type { DarwinProcessFrame, PreparedDarwinInspector } from './types'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 实际生命周期验收只启动本测试持有的原生 helper 和 Node fixture。
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prepareDarwinInspector, verifyPreparedDarwinInspector } from './compiler'
import { darwinInspectorLines } from './lines'
import { withNativeInspectorFixture } from './nativeFixture/session'
import { sameDarwinIdentity } from './protocol'
import { withDarwinInspector } from './reader'
import { DARWIN_INSPECTOR_PHASES } from './types'

let directory: string | undefined
let prepared: PreparedDarwinInspector

function validateFrame(frame: DarwinProcessFrame, pid: number) {
  expect(frame.ownedHelper.pid).toBe(pid)
  expect(frame.ownedHelper.executable).toBe(prepared.executable)
  expect(frame.enumeration.pids).toHaveLength(frame.rows.length)
  expect(new Set(frame.enumeration.pids).size).toBe(frame.rows.length)
  expect(frame.enumeration.bytes).toBe((frame.rows.length + frame.enumeration.zeroPidCount) * frame.enumeration.recordSize)
  expect(frame.rows.map(row => row.pid).sort((a, b) => a - b)).toEqual([...frame.enumeration.pids].sort((a, b) => a - b))
  for (const row of frame.rows) {
    for (const observation of [row.before, row.task, row.after]) {
      if (observation.identity) {
        expect(typeof observation.identity.zombie).toBe('boolean')
      }
    }
    expect(BigInt(row.startedAtNanoseconds)).toBeGreaterThanOrEqual(BigInt(frame.startedAtNanoseconds))
    expect(BigInt(row.endedAtNanoseconds)).toBeGreaterThanOrEqual(BigInt(row.startedAtNanoseconds))
    expect(BigInt(row.endedAtNanoseconds)).toBeLessThanOrEqual(BigInt(frame.endedAtNanoseconds))
  }
}

describe.skipIf(process.platform !== 'darwin')('real public SDK Darwin inspector without IDE', () => {
  beforeAll(async () => {
    directory = await fs.mkdtemp(path.join(tmpdir(), 'native-inspector-contract-'))
    prepared = await prepareDarwinInspector({ cacheRoot: directory })
  }, 60_000)

  afterAll(async () => {
    if (directory) {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('compiles against the public SDK and reuses the same verified cache without changing permissions', async () => {
    const initial = await fs.stat(prepared.executable)
    const reused = await prepareDarwinInspector({ cacheRoot: directory })
    expect(reused).toEqual(prepared)
    expect(await verifyPreparedDarwinInspector(reused)).toEqual(prepared)
    expect(await fs.realpath(prepared.executable)).toBe(prepared.executable)
    expect(await fs.stat(prepared.executable)).toMatchObject({ mtimeMs: initial.mtimeMs, ino: initial.ino })
    expect((await fs.lstat(prepared.executable)).isSymbolicLink()).toBe(false)
    expect(initial.mode & 0o6022).toBe(0)
    expect(initial.mode & 0o100).toBe(0o100)
    expect(initial.uid).toBe(process.getuid!())
    expect(await fs.readdir(directory!)).toEqual([prepared.identityKey])
    expect(prepared.identity).toMatchObject({ sdkBuild: expect.any(String), compilerVersion: expect.stringContaining('clang') })
  })

  it('holds the same verified helper through all four phases and releases it after consumption', async () => {
    let pid = 0
    const frames = await withDarwinInspector(Date.now() + 10_000, async (reader) => {
      const frames = []
      for (const phase of DARWIN_INSPECTOR_PHASES) {
        const frame = await reader.readFrame(phase)
        pid ||= frame.ownedHelper.pid
        validateFrame(frame, pid)
        expect(() => process.kill(pid, 0)).not.toThrow()
        frames.push(frame)
      }
      return frames
    }, prepared)
    expect(frames.map(frame => frame.phase)).toEqual(DARWIN_INSPECTOR_PHASES)
    expect(frames.every(frame => sameDarwinIdentity(frame.ownedHelper.identity, frames[0]!.ownedHelper.identity))).toBe(true)
    expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }))
  })

  it('rejects a fifth reader request and waits for its held helper to terminate', async () => {
    let pid = 0
    await expect(withDarwinInspector(Date.now() + 10_000, async (reader) => {
      for (const phase of DARWIN_INSPECTOR_PHASES) {
        pid = (await reader.readFrame(phase)).ownedHelper.pid
      }
      await reader.readFrame('anchor')
    }, prepared)).rejects.toThrow()
    expect(pid).toBeGreaterThan(0)
    expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }))
  })

  it('rejects a fifth request in the actual native protocol without waiting for a timeout', async () => {
    await withNativeInspectorFixture(prepared, async (session) => {
      for (const [index, phase] of DARWIN_INSPECTOR_PHASES.entries()) {
        await session.request(index + 1, phase)
      }
      session.end(`${JSON.stringify({ protocol: 1, requestId: 5, phase: 'closure2', remainingMilliseconds: 10_000 })}\n`)
      const result = await session.terminal
      expect(result.exitCode).not.toBe(0)
      expect(result.timedOut).toBe(false)
      expect(result.signal).toBeUndefined()
      expect(session.stderr()).toContain('Invalid inspector request boundary')
      session.assertComplete()
    })
  })

  it.each([0, 1, 2, 4])('checks mandatory prepare/anchor phases when stdin ends after %i requests', async (requests) => {
    await withNativeInspectorFixture(prepared, async (session) => {
      for (let index = 0; index < requests; index++) {
        await session.request(index + 1, DARWIN_INSPECTOR_PHASES[index]!)
      }
      session.end()
      const result = await session.terminal
      expect(result.exitCode === 0).toBe(requests >= 2)
      expect(result.timedOut).toBe(false)
      session.assertComplete()
    })
  })

  it.each([
    '{}\n',
    '{"protocol":1,"requestId":1,"phase":"anchor","remainingMilliseconds":10000}\n',
    '{"protocol":1,"requestId":1.5,"phase":"prepare","remainingMilliseconds":10000}\n',
    '{"protocol":1,"requestId":1,"phase":"prepare","remainingMilliseconds":10000,"extra":true}\n',
  ])('rejects malformed native requests and terminates (%s)', async (input) => {
    await withNativeInspectorFixture(prepared, async (session) => {
      session.end(input)
      const result = await session.terminal
      expect(result.exitCode).not.toBe(0)
      expect(result.timedOut).toBe(false)
      expect(session.stderr()).toContain('Darwin inspector:')
      session.assertComplete()
    })
  })

  it('preserves a controlled child exact identity before exit and its absence at the fixed anchor', async () => {
    const child = execa(process.execPath, ['-e', 'process.stdin.resume(); process.stdout.write("ready\\n")'], { reject: false, buffer: false, timeout: 15_000 })
    const owner = child.nodeChildProcess
    const terminal = Promise.resolve(child)
    const lines = darwinInspectorLines(owner.stdout, terminal)
    try {
      expect(await lines.next(5_000)).toBe('ready')
      await withDarwinInspector(Date.now() + 10_000, async (reader) => {
        const prepare = await reader.readFrame('prepare')
        const row = prepare.rows.find(row => row.pid === owner.pid)
        expect(row?.gaps).toEqual([])
        expect(row?.before.identity?.parentPid).toBe(process.pid)
        expect(row?.pathBefore.executable).toBe(await fs.realpath(process.execPath))
        const identity = row!.before.identity!
        owner.stdin!.end()
        expect((await terminal).exitCode).toBe(0)
        for (const phase of ['anchor', 'closure1', 'closure2'] as const) {
          const next = (await reader.readFrame(phase)).rows.find(row => row.pid === owner.pid)
          // PID 若已被内核复用，新的精确令牌仍不能成为已退出 child 的连续身份。
          expect(next?.before.identity && sameDarwinIdentity(next.before.identity, identity)).toBeFalsy()
        }
      }, prepared)
    }
    finally {
      if (owner.exitCode === null && owner.signalCode === null) {
        child.kill('SIGKILL')
      }
      await terminal
      lines.dispose()
    }
  })

  it('releases the actual owned helper when its independent runner receives SIGTERM', async () => {
    const fixture = fileURLToPath(new URL('./nativeFixture/owner.ts', import.meta.url))
    const runner = execa(process.execPath, ['--import', 'tsx', fixture, JSON.stringify(prepared)], { reject: false, buffer: false, timeout: 15_000 })
    const owner = runner.nodeChildProcess
    const terminal = Promise.resolve(runner)
    const lines = darwinInspectorLines(owner.stdout, terminal)
    try {
      const report: unknown = JSON.parse(await lines.next(10_000))
      if (!report || typeof report !== 'object' || !('pid' in report) || typeof report.pid !== 'number' || !Number.isSafeInteger(report.pid) || report.pid <= 0) {
        throw new Error('Native fixture runner did not expose its held helper PID.')
      }
      const pid = report.pid
      runner.kill('SIGTERM')
      expect((await terminal).signal).toBe('SIGTERM')
      // 只读取已登记 child 是否消失，绝不按报告 PID 派发清理信号。
      await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' })), { timeout: 5_000 })
    }
    finally {
      if (owner.exitCode === null && owner.signalCode === null) {
        runner.kill('SIGTERM')
      }
      await terminal
      lines.dispose()
    }
  })
})
