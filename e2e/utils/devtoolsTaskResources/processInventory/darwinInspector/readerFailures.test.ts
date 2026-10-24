import type { DarwinInspectorReader } from './types'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDarwinInspectorFixture, fixturePrepared, fixtureReady } from './fixture'
import { withDarwinInspector } from './reader'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), verify: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('./compiler', () => ({ verifyPreparedDarwinInspector: mocks.verify }))

type InspectorFixture = ReturnType<typeof createDarwinInspectorFixture>

/** 仅投影内存 terminal 结果，所有身份、管道和 kill 委托仍属于同一个持有句柄。 */
function adaptedChild(fixture: InspectorFixture, result: { exitCode?: number, timedOut?: boolean } = {}) {
  return Object.assign(fixture.child.then(value => ({ ...value, ...result })), {
    nodeChildProcess: fixture.owner,
    kill: vi.fn((signal: string) => fixture.child.kill(signal)),
  })
}

function terminalErrors(error: unknown): unknown[] {
  return error instanceof AggregateError ? (error.errors as unknown[]).flatMap(terminalErrors) : [error]
}

async function readAnchor(reader: DarwinInspectorReader) {
  await reader.readFrame('prepare')
  await reader.readFrame('anchor')
}

function expectDisposed(fixture: InspectorFixture) {
  expect(fixture.events).toContain('eof')
  expect(fixture.events).toContain('exit')
  expect(fixture.owner.stdin?.writableEnded).toBe(true)
  expect(fixture.owner.stdout.listenerCount('data')).toBe(0)
  expect(fixture.owner.stderr.listenerCount('data')).toBe(0)
  expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(fixturePrepared.executable, [], expect.objectContaining({ killSignal: 'SIGKILL' }))
  expect(process.kill).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.verify.mockResolvedValue(fixturePrepared)
  vi.spyOn(process, 'kill').mockReturnValue(true)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Darwin inspector failed held-child teardown', () => {
  it('rejects stderr from an otherwise successful terminal and removes its listeners', async () => {
    const fixture = createDarwinInspectorFixture({ stderr: 'fixture terminal warning' })
    const child = adaptedChild(fixture)
    mocks.execute.mockReturnValue(child)
    await expect(withDarwinInspector(Date.now() + 10_000, readAnchor, fixturePrepared)).rejects.toThrow(/fixture terminal warning/)
    expect(child.kill).not.toHaveBeenCalled()
    expectDisposed(fixture)
  })

  it.each(['stderr', 'nonzero', 'signal'] as const)('retains the first consumer error alongside a %s terminal failure', async (failure) => {
    const fixture = createDarwinInspectorFixture({ deferExit: true, stderr: failure === 'stderr' ? 'fixture terminal evidence' : undefined })
    const child = adaptedChild(fixture, failure === 'nonzero' ? { exitCode: 7 } : {})
    mocks.execute.mockReturnValue(child)
    const firstError = new Error('first consumer evidence')
    let completed = false
    const result = withDarwinInspector(Date.now() + 10_000, async (reader) => {
      await readAnchor(reader)
      throw firstError
    }, fixturePrepared).then(() => undefined, error => error as unknown)
    void result.then(() => {
      completed = true
    })
    await vi.waitFor(() => expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL'))
    expect(completed).toBe(false)
    expect(fixture.owner).toBe(child.nodeChildProcess)
    fixture.finish(failure === 'signal' ? 'SIGTERM' : undefined)
    const error = await result
    expect(error).toBeInstanceOf(AggregateError)
    const errors = terminalErrors(error)
    expect(errors[0]).toBe(firstError)
    expect(errors.some(item => item instanceof Error && /terminal failed/.test(item.message))).toBe(true)
    if (failure === 'stderr') {
      expect(errors.some(item => item instanceof Error && item.message.includes('fixture terminal evidence'))).toBe(true)
    }
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expectDisposed(fixture)
  })

  it('retains invalid readiness while waiting for only its held terminal to close', async () => {
    const fixture = createDarwinInspectorFixture({ ready: JSON.stringify({ ...fixtureReady, pid: fixtureReady.pid + 1 }), deferExit: true })
    const child = adaptedChild(fixture)
    mocks.execute.mockReturnValue(child)
    const consume = vi.fn()
    let completed = false
    const result = withDarwinInspector(Date.now() + 10_000, consume, fixturePrepared).then(() => undefined, error => error as unknown)
    void result.then(() => {
      completed = true
    })
    await vi.waitFor(() => expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL'))
    expect(completed).toBe(false)
    expect(consume).not.toHaveBeenCalled()
    expect(fixture.requests).toHaveLength(0)
    fixture.finish('SIGKILL')
    const error = await result
    expect(error).toBeInstanceOf(AggregateError)
    const errors = terminalErrors(error)
    expect(errors[0]).toBeInstanceOf(Error)
    expect((errors[0] as Error).message).toMatch(/unverified helper readiness/)
    expect(errors.some(item => item instanceof Error && /terminal failed/.test(item.message))).toBe(true)
    expectDisposed(fixture)
  })

  it('keeps the response error until the held timeout terminal arrives after ignored EOF', async () => {
    vi.useFakeTimers()
    const fixture = createDarwinInspectorFixture({ ready: null, deferExit: true })
    const child = adaptedChild(fixture, { timedOut: true })
    mocks.execute.mockImplementation((_executable, _args, options: { timeout: number }) => {
      setTimeout(() => fixture.finish('SIGKILL'), options.timeout)
      return child
    })
    const consume = vi.fn()
    let completed = false
    const result = withDarwinInspector(Date.now() + 10_000, consume, fixturePrepared).then(() => undefined, error => error as unknown)
    void result.then(() => {
      completed = true
    })
    await vi.advanceTimersByTimeAsync(5_001)
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(fixture.events).toContain('eof')
    expect(fixture.events).not.toContain('exit')
    expect(completed).toBe(false)
    expect(consume).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5_000)
    const error = await result
    expect(error).toBeInstanceOf(AggregateError)
    const errors = terminalErrors(error)
    expect(errors[0]).toBeInstanceOf(Error)
    expect((errors[0] as Error).message).toMatch(/response budget/)
    expect(errors.some(item => item instanceof Error && /terminal failed/.test(item.message))).toBe(true)
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(vi.getTimerCount()).toBe(0)
    expectDisposed(fixture)
  })
})
