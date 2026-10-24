import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDarwinInspectorFixture, fixturePrepared } from './fixture'
import { withDarwinInspector } from './reader'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), verify: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('./compiler', () => ({ verifyPreparedDarwinInspector: mocks.verify }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.verify.mockResolvedValue(fixturePrepared)
})
afterEach(() => vi.useRealTimers())

describe('owned Darwin inspector lifecycle', () => {
  it('holds one helper for all four phases without starting ps or resetting the deadline', async () => {
    const fixture = createDarwinInspectorFixture()
    mocks.execute.mockReturnValue(fixture.child)
    const frames = await withDarwinInspector(Date.now() + 10_000, async (reader) => {
      const collected = []
      for (const phase of ['prepare', 'anchor', 'closure1', 'closure2'] as const) {
        collected.push(await reader.readFrame(phase))
      }
      expect(fixture.owner.exitCode).toBeNull()
      return collected
    }, fixturePrepared)
    expect(frames.map(frame => frame.phase)).toEqual(['prepare', 'anchor', 'closure1', 'closure2'])
    expect(fixture.events).toEqual(['ready', 'request', 'request', 'request', 'request', 'eof', 'exit'])
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.execute.mock.calls[0]![0]).toBe(fixturePrepared.executable)
    expect(mocks.execute.mock.calls[0]![2]).toMatchObject({ buffer: false, killSignal: 'SIGKILL' })
    expect(mocks.execute.mock.calls[0]![2]).not.toHaveProperty('cleanup', false)
    expect(mocks.execute.mock.calls[0]![2]).not.toHaveProperty('detached', true)
    const requests = fixture.requests as { remainingMilliseconds: number }[]
    expect(requests.every((value, index) => value.remainingMilliseconds <= (requests[index - 1]?.remainingMilliseconds ?? 10_000))).toBe(true)
  })
  it('allows omitted closure phases but requires prepare and the one anchor', async () => {
    const fixture = createDarwinInspectorFixture()
    mocks.execute.mockReturnValue(fixture.child)
    await expect(withDarwinInspector(Date.now() + 10_000, async (reader) => {
      await reader.readFrame('prepare')
      await reader.readFrame('anchor')
      return 'complete'
    }, fixturePrepared)).resolves.toBe('complete')
    expect(fixture.requests).toHaveLength(2)
  })
  it('poisons a rejected phase even when the consumer catches it', async () => {
    const fixture = createDarwinInspectorFixture()
    mocks.execute.mockReturnValue(fixture.child)
    await expect(withDarwinInspector(Date.now() + 10_000, async (reader) => {
      await reader.readFrame('anchor').catch(() => undefined)
      return 'not-a-pass'
    }, fixturePrepared)).rejects.toThrow()
    expect(fixture.requests).toHaveLength(0)
    expect(fixture.events).toContain('exit')
  })
  it('rejects a fifth phase before dispatch and cannot rerun the anchor', async () => {
    const fixture = createDarwinInspectorFixture()
    mocks.execute.mockReturnValue(fixture.child)
    await expect(withDarwinInspector(Date.now() + 10_000, async (reader) => {
      for (const phase of ['prepare', 'anchor', 'closure1', 'closure2'] as const) {
        await reader.readFrame(phase)
      }
      await reader.readFrame('anchor')
    }, fixturePrepared)).rejects.toThrow()
    expect(fixture.requests).toHaveLength(4)
  })
  it('preserves the consumer error and waits for the exact held terminal', async () => {
    const fixture = createDarwinInspectorFixture({ deferExit: true })
    mocks.execute.mockReturnValue(fixture.child)
    const error = new Error('consumer evidence')
    let completed = false
    const result = withDarwinInspector(Date.now() + 10_000, async (reader) => {
      await reader.readFrame('prepare')
      await reader.readFrame('anchor')
      throw error
    }, fixturePrepared)
    void result.catch(() => {
      completed = true
    })
    await vi.waitFor(() => expect(fixture.events).toContain('eof'))
    expect(completed).toBe(false)
    expect(fixture.events).toContain('kill:SIGKILL')
    fixture.finish()
    await expect(result).rejects.toBe(error)
    expect(fixture.owner.stdout.listenerCount('data')).toBe(0)
    expect(fixture.owner.stderr.listenerCount('data')).toBe(0)
  })
  it('never dispatches after expired or changed prepared artifacts', async () => {
    await expect(withDarwinInspector(Date.now() - 1, async () => 'unused', fixturePrepared)).rejects.toThrow()
    expect(mocks.verify).not.toHaveBeenCalled()
    mocks.verify.mockRejectedValue(new Error('binary changed'))
    await expect(withDarwinInspector(Date.now() + 10_000, async () => 'unused', fixturePrepared)).rejects.toThrow(/binary changed/)
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('bounds readiness and releases only its owned helper', async () => {
    vi.useFakeTimers()
    const fixture = createDarwinInspectorFixture({ ready: null })
    mocks.execute.mockReturnValue(fixture.child)
    const result = withDarwinInspector(Date.now() + 10_000, async () => 'unused', fixturePrepared)
    const assertion = expect(result).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(5_001)
    await assertion
    expect(fixture.events).toContain('exit')
    expect(fixture.requests).toHaveLength(0)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })
})
