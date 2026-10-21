import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDarwinKernelResponse, readDarwinSnapshot } from './darwinSnapshot'
import { createInspectorFixture } from './inspectorFixture'

const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
const row = (pid: number) => `${pid} 1 10 S Mon Oct 19 10:00:00 2026`
const frame = () => ({ stdout: `${row(11)}\n${row(98)}`, inspectorPid: 98 })

beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('warmed Darwin inspector boundary', () => {
  it('boots before initial RSS and keeps the held child alive until after ps, then waits for its exit', async () => {
    const fixture = createInspectorFixture()
    mocks.execute.mockReturnValue(fixture.child)
    const read = vi.fn(async () => {
      expect(fixture.owner.exitCode).toBeNull()
      fixture.events.push('ps')
      return frame()
    })
    expect(await readDarwinSnapshot(Date.now() + 10_000, read)).toEqual({ initial: frame(), paths: new Map([[11, '/foreign/11']]), after: frame() })
    expect(fixture.events).toEqual(['ready', 'ps', 'request', 'ps', 'eof', 'exit'])
    expect(mocks.execute.mock.calls[0]![2]).toMatchObject({ reject: false, timeout: expect.any(Number) })
    expect(mocks.execute.mock.calls[0]![2]).not.toHaveProperty('cleanup', false)
    expect(mocks.execute.mock.calls[0]![2]).not.toHaveProperty('detached', true)
  })

  it('keeps the same warmed helper through the existing three rounds and closes it only after the consumer', async () => {
    const fixture = createInspectorFixture()
    mocks.execute.mockReturnValue(fixture.child)
    const read = vi.fn(async () => {
      fixture.events.push('ps')
      return frame()
    })
    const result = await readDarwinSnapshot(Date.now() + 10_000, read, async (snapshot, readPaths) => {
      expect(snapshot.paths).toEqual(new Map([[11, '/foreign/11']]))
      expect(await readPaths([22])).toEqual(new Map([[22, '/foreign/22']]))
      expect(await readPaths([33])).toEqual(new Map([[33, '/foreign/33']]))
      expect(fixture.owner.exitCode).toBeNull()
      expect(fixture.events).not.toContain('eof')
      fixture.events.push('consumer-complete')
      return 'closed-inventory'
    })
    expect(result).toBe('closed-inventory')
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledTimes(2)
    expect(fixture.events).toEqual(['ready', 'ps', 'request', 'ps', 'request', 'request', 'consumer-complete', 'eof', 'exit'])
  })

  it('rejects a fourth request before dispatch without extending the inventory rounds', async () => {
    const fixture = createInspectorFixture()
    mocks.execute.mockReturnValue(fixture.child)
    await expect(readDarwinSnapshot(Date.now() + 10_000, async () => frame(), async (_snapshot, readPaths) => {
      await readPaths([22])
      await readPaths([33])
      await readPaths([44])
    })).rejects.toThrow('request is unavailable')
    expect(fixture.events.filter(event => event === 'request')).toHaveLength(3)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(fixture.events).toContain('exit')
  })

  it('keeps the original deadline for followup requests and awaits the held child when the consumer fails', async () => {
    const fixture = createInspectorFixture({ deferExit: true })
    mocks.execute.mockReturnValue(fixture.child)
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    let settled = false
    const outcome = readDarwinSnapshot(10_000, async () => frame(), async (_snapshot, readPaths) => {
      now = 10_000
      await readPaths([22])
    }).catch(error => error).finally(() => { settled = true })
    await vi.waitFor(() => expect(fixture.events).toContain('kill:SIGKILL'))
    expect(settled).toBe(false)
    expect(fixture.events.filter(event => event === 'request')).toHaveLength(1)
    fixture.finish('SIGKILL')
    expect(await outcome).toMatchObject({ message: expect.stringContaining('shared process inspection budget') })
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })

  it.each([1, 2])('closes stdin and awaits the same held child when ps frame %i throws', async (failedFrame) => {
    const fixture = createInspectorFixture({ deferExit: true })
    mocks.execute.mockReturnValue(fixture.child)
    let reads = 0
    let settled = false
    const outcome = readDarwinSnapshot(Date.now() + 10_000, async () => {
      if (++reads === failedFrame) {
        throw new Error('ps fixture failed')
      }
      return frame()
    }).catch(error => error).finally(() => { settled = true })
    await vi.waitFor(() => expect(fixture.events).toContain('kill:SIGKILL'))
    expect(settled).toBe(false)
    expect(fixture.events).toContain('eof')
    fixture.finish('SIGKILL')
    expect(await outcome).toMatchObject({ message: 'ps fixture failed' })
  })

  it('bounds readiness independently and dispatches no initial ps after that timeout', async () => {
    vi.useFakeTimers()
    const fixture = createInspectorFixture({ ready: null })
    mocks.execute.mockReturnValue(fixture.child)
    const read = vi.fn()
    const outcome = readDarwinSnapshot(Date.now() + 10_000, read).catch(error => error)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await outcome).toMatchObject({ message: expect.stringContaining('budget') })
    expect(read).not.toHaveBeenCalled()
    expect(fixture.events).toContain('eof')
    expect(fixture.events).toContain('exit')
  })

  it.each(['{}', '{"phase":"ready","extra":1}', '{"phase":"paths"}', '{', '{"phase":"ready"}\n{}'])('rejects an invalid readiness envelope %s', async (ready) => {
    const fixture = createInspectorFixture({ ready })
    mocks.execute.mockReturnValue(fixture.child)
    const read = vi.fn()
    await expect(readDarwinSnapshot(Date.now() + 10_000, read)).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
    expect(fixture.events).toContain('exit')
  })

  it.each([{ stderr: 'warning' }, { exitCode: 1 }])('rejects helper terminal errors after both frames (%j)', async (failure) => {
    const fixture = createInspectorFixture(failure)
    mocks.execute.mockReturnValue(fixture.child)
    await expect(readDarwinSnapshot(Date.now() + 10_000, async () => frame())).rejects.toThrow('kernel process inventory')
  })

  it.each([
    { phase: 'wrong', paths: [] },
    { phase: 'paths', paths: null },
    { phase: 'paths', paths: [{ pid: 11, executable: false }] },
    { phase: 'paths', paths: [{ pid: 11, executable: null }, { pid: 11, executable: null }] },
    { phase: 'paths', paths: [] },
    { phase: 'paths', paths: [{ pid: 12, executable: '/foreign/tool' }] },
    { phase: 'paths', paths: [{ pid: 11, executable: null }, { pid: 12, executable: null }] },
  ])('rejects invalid or incomplete path boundaries %j', (response) => {
    expect(() => parseDarwinKernelResponse(JSON.stringify(response), [11])).toThrow()
  })

  it('does not launch an inspector after the shared budget is exhausted', async () => {
    await expect(readDarwinSnapshot(Date.now() - 1, async () => frame())).rejects.toThrow('budget')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
