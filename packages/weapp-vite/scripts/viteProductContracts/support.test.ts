import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { setImmediate as nextTask } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeServers, event, fixture, getPendingProductFixtures, observeOutcome, waitFor } from './support'

const files = vi.hoisted(() => ({
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  realpath: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('node:fs/promises', () => files)

let fixtureSequence = 0

function fakeServer(close: () => Promise<void> = async () => {}) {
  const watcher = new EventEmitter()
  return { watcher, server: { watcher, close } as unknown as ViteDevServer }
}

function failureOf<T>(outcome: PromiseSettledResult<T>): unknown {
  expect(outcome.status).toBe('rejected')
  if (outcome.status !== 'rejected') {
    throw new Error('Expected the public operation to reject')
  }
  return outcome.reason
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  files.mkdtemp.mockImplementation(async (prefix: string) => `${prefix}isolated-${++fixtureSequence}`)
  files.realpath.mockImplementation(async (file: string) => file)
  files.mkdir.mockResolvedValue(undefined)
  files.writeFile.mockResolvedValue(undefined)
  files.rm.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('product server and fixture cleanup', () => {
  it.each([undefined, null, false, 0, ''])('preserves a prior rejection value of %j after successful closes', async (error) => {
    const close = vi.fn(async () => {})
    const { server } = fakeServer(close)
    expect(failureOf(await observeOutcome(closeServers([undefined, server], { error })))).toBe(error)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('retains the original error and every cleanup error while closing all owners', async () => {
    const original = new Error('product operation failed')
    const synchronous = new Error('first owner close threw')
    const asynchronous = new Error('last owner close rejected')
    const first = vi.fn(() => {
      throw synchronous
    })
    const middle = vi.fn(async () => {})
    const last = vi.fn(async () => {
      throw asynchronous
    })
    const servers = [first, middle, last].map(close => fakeServer(close).server)
    const error = failureOf(await observeOutcome(closeServers(servers, { error: original })))
    expect(error).toBeInstanceOf(AggregateError)
    expect(error).toMatchObject({ name: 'ProductResourceCleanupError', errors: [original, synchronous, asynchronous], cause: original })
    for (const close of [first, middle, last]) {
      expect(close).toHaveBeenCalledTimes(1)
    }
  })

  it('retains a falsy prior failure when cleanup also rejects', async () => {
    const cleanup = new Error('owner close failed')
    const { server } = fakeServer(async () => {
      throw cleanup
    })
    const error = failureOf(await observeOutcome(closeServers([server], { error: undefined })))
    expect(error).toMatchObject({ errors: [undefined, cleanup] })
    expect(error).toHaveProperty('cause', undefined)
  })

  it('isolates the project and removes its canonical container after an ordinary operation failure', async () => {
    files.realpath.mockImplementationOnce(async (file: string) => `${file}-canonical`)
    const original = new Error('fixture operation failed')
    let root: string | undefined
    const result = await observeOutcome(fixture({ 'nested/source.js': 'export const value = 42' }, async (directory) => {
      root = directory
      expect(getPendingProductFixtures()).toContain(path.dirname(directory))
      expect(getPendingProductFixtures()).not.toContain(await files.mkdtemp.mock.results[0]!.value)
      throw original
    }))
    expect(failureOf(result)).toBe(original)
    const container = `${await files.mkdtemp.mock.results[0]!.value}-canonical`
    expect(root).toBe(path.join(container, 'project'))
    expect(files.mkdir).toHaveBeenCalledWith(root)
    expect(files.writeFile).toHaveBeenCalledExactlyOnceWith(path.join(root!, 'nested/source.js'), 'export const value = 42')
    expect(files.rm).toHaveBeenCalledExactlyOnceWith(container, { recursive: true, force: true })
    expect(getPendingProductFixtures()).not.toContain(container)
  })

  it('retains both the operation failure and fixture removal failure', async () => {
    files.realpath.mockImplementationOnce(async (file: string) => `${file}-canonical`)
    const original = new Error('fixture operation failed')
    const cleanup = new Error('fixture removal failed')
    files.rm.mockRejectedValueOnce(cleanup)
    const error = failureOf(await observeOutcome(fixture({}, async () => {
      throw original
    })))
    expect(error).toBeInstanceOf(AggregateError)
    expect(error).toMatchObject({ name: 'ProductResourceCleanupError', errors: [original, cleanup], cause: original })
    expect(getPendingProductFixtures()).toContain(files.rm.mock.calls[0]![0])
  })

  it('reports fixture removal failure after a successful operation', async () => {
    const cleanup = new Error('fixture removal failed')
    files.rm.mockRejectedValueOnce(cleanup)
    const error = failureOf(await observeOutcome(fixture({}, async () => {})))
    expect(error).toMatchObject({ name: 'ProductResourceCleanupError', errors: [cleanup], cause: cleanup })
  })

  it.each(['marked', 'aggregate'])('preserves fixture evidence for unconfirmed %s cleanup', async (kind) => {
    const original = new Error('startup failed')
    const cleanup = new Error('startup owner close failed')
    const error = kind === 'aggregate'
      ? new AggregateError([original, cleanup], 'startup acquisition and cleanup failed')
      : Object.assign(new Error('owner termination unconfirmed'), { name: 'ProductResourceCleanupError' })
    expect(failureOf(await observeOutcome(fixture({}, async () => {
      throw error
    })))).toBe(error)
    expect(files.rm).not.toHaveBeenCalled()
    expect(getPendingProductFixtures()).toContain(await files.mkdtemp.mock.results[0]!.value)
  })

  it('removes a fixture after actual owner closure even when the original assertion is aggregate', async () => {
    const original = new AggregateError([new Error('first assertion'), new Error('second assertion')], 'Both product assertions failed')
    const close = vi.fn(async () => {})
    const result = await observeOutcome(fixture({}, async () => {
      await closeServers([fakeServer(close).server], { error: original })
    }))
    expect(failureOf(result)).toBe(original)
    expect(close).toHaveBeenCalledTimes(1)
    expect(files.rm).toHaveBeenCalledTimes(1)
    expect(getPendingProductFixtures()).not.toContain(files.rm.mock.calls[0]![0])
  })

  it('does not treat an absent startup owner as proof that aggregate cleanup completed', async () => {
    const original = new AggregateError([new Error('startup failed'), new Error('startup cleanup failed')], 'Startup cleanup remains incomplete')
    const result = await observeOutcome(fixture({}, async () => {
      await closeServers([undefined], { error: original })
    }))
    expect(failureOf(result)).toBe(original)
    expect(files.rm).not.toHaveBeenCalled()
    expect(getPendingProductFixtures()).toContain(await files.mkdtemp.mock.results[0]!.value)
  })

  it('keeps a nested explicit cleanup failure pending even if another owner closes', async () => {
    const incomplete = Object.assign(new Error('one native owner did not close'), { name: 'ProductResourceCleanupError' })
    const original = new AggregateError([new Error('assertion failed'), incomplete], 'Assertion and native cleanup failed')
    const result = await observeOutcome(fixture({}, async () => {
      await closeServers([fakeServer().server], { error: original })
    }))
    expect(failureOf(result)).toBe(original)
    expect(files.rm).not.toHaveBeenCalled()
  })

  it('registers the created directory before realpath and releases it after a failed lookup', async () => {
    const original = new Error('realpath failed')
    let pendingBeforeLookup: string[] = []
    files.realpath.mockImplementationOnce(async () => {
      pendingBeforeLookup = getPendingProductFixtures()
      throw original
    })
    expect(failureOf(await observeOutcome(fixture({}, async () => {})))).toBe(original)
    const created = await files.mkdtemp.mock.results[0]!.value
    expect(pendingBeforeLookup).toContain(created)
    expect(files.rm).toHaveBeenCalledExactlyOnceWith(created, { recursive: true, force: true })
    expect(getPendingProductFixtures()).not.toContain(created)
  })
})

describe('product watcher observation', () => {
  it('cleans its timer and listeners after mutation failure without waiting for an event', async () => {
    const original = new Error('source write failed')
    const { server, watcher } = fakeServer()
    const result = await observeOutcome(event(server, 'source.js', async () => {
      throw original
    }))
    expect(failureOf(result)).toBe(original)
    expect(watcher.listenerCount('change')).toBe(0)
    expect(watcher.listenerCount('error')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('observes an early watcher rejection while mutation is held and retains both failures', async () => {
    const { server, watcher } = fakeServer()
    const mutation = Promise.withResolvers<void>()
    const watcherFailure = new Error('watcher failed during source write')
    const mutationFailure = new Error('source write subsequently failed')
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const observed = observeOutcome(event(server, 'source.js', () => mutation.promise))
    try {
      watcher.emit('error', watcherFailure)
      await nextTask()
      expect(unhandled).not.toHaveBeenCalled()
      mutation.reject(mutationFailure)
      const error = failureOf(await observed)
      expect(error).toBeInstanceOf(AggregateError)
      expect(error).toMatchObject({ errors: [mutationFailure, watcherFailure], cause: mutationFailure })
      expect(watcher.listenerCount('change')).toBe(0)
      expect(watcher.listenerCount('error')).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      mutation.resolve()
      await observed
      process.off('unhandledRejection', unhandled)
    }
  })

  it('only accepts the requested file and releases observation resources after delivery', async () => {
    const { server, watcher } = fakeServer()
    let completed = false
    const observed = observeOutcome(event(server, 'source.js', async () => {})).then((outcome) => {
      completed = true
      return outcome
    })
    watcher.emit('change', 'another.js')
    await Promise.resolve()
    expect(completed).toBe(false)
    watcher.emit('change', path.resolve('source.js'))
    expect(await observed).toEqual({ status: 'fulfilled', value: undefined })
    expect(watcher.eventNames()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds missing notifications and removes its listeners on timeout', async () => {
    const { server, watcher } = fakeServer()
    const result = observeOutcome(event(server, 'source.js', async () => {}))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(failureOf(await result)).toMatchObject({ message: expect.stringContaining('source.js') })
    expect(watcher.eventNames()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('product asynchronous conditions', () => {
  it('can defer consumption of a rejection outcome without creating an unhandled rejection', async () => {
    const original = new Error('operation rejected immediately')
    const rejected = observeOutcome(Promise.reject(original))
    const fulfilled = observeOutcome(Promise.resolve(42))
    await nextTask()
    expect(failureOf(await rejected)).toBe(original)
    expect(await fulfilled).toEqual({ status: 'fulfilled', value: 42 })
  })

  it('returns a subsequently observed value and clears its deadline timer', async () => {
    let value = 0
    const result = observeOutcome(waitFor(() => value, current => current === 42, 'condition did not become ready', 100))
    await Promise.resolve()
    value = 42
    await vi.advanceTimersByTimeAsync(20)
    expect(await result).toEqual({ status: 'fulfilled', value: 42 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves an observation rejection and clears its deadline timer', async () => {
    const original = new Error('condition observation failed')
    const result = await observeOutcome(waitFor(async () => {
      throw original
    }, () => false, 'condition did not become ready', 100))
    expect(failureOf(result)).toBe(original)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('enforces the total deadline even while an asynchronous observation remains pending', async () => {
    const pending = Promise.withResolvers<number>()
    const description = 'condition observation exceeded its total deadline'
    let result: PromiseSettledResult<number> | undefined
    const observing = observeOutcome(waitFor(() => pending.promise, value => value === 42, description, 100)).then((outcome) => {
      result = outcome
      return outcome
    })
    try {
      await vi.advanceTimersByTimeAsync(101)
      expect(result?.status).toBe('rejected')
      expect(failureOf(result!)).toMatchObject({ message: expect.stringContaining(description) })
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      pending.resolve(42)
      await observing
    }
  })
})
