import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSidecarWatcherReadiness } from './sidecarReadiness'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function fixture() {
  const watcher = new EventEmitter()
  const readiness = createSidecarWatcherReadiness(watcher)
  return { watcher, readiness }
}

function expectReleased(watcher: EventEmitter) {
  expect(watcher.listenerCount('ready')).toBe(0)
  expect(watcher.listenerCount('error')).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
}

describe('owned sidecar initial readiness', () => {
  it('settles a pending initial scan as closed without fabricating a ready event', async () => {
    const { watcher, readiness } = fixture()
    const readyEvent = vi.fn()
    watcher.on('ready', readyEvent)
    expect(vi.getTimerCount()).toBe(1)
    readiness.close()
    readiness.close()
    await expect(readiness.ready).resolves.toBe('closed')
    expect(readyEvent).not.toHaveBeenCalled()
    expect(watcher.listeners('ready')).toEqual([readyEvent])
    expect(watcher.listenerCount('error')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains a real scan completion after repeated closure', async () => {
    const { watcher, readiness } = fixture()
    watcher.emit('ready')
    readiness.close()
    readiness.close()
    await expect(readiness.ready).resolves.toBe('ready')
    expectReleased(watcher)
  })

  it('preserves the first watcher error when owner cleanup follows it', async () => {
    const { watcher, readiness } = fixture()
    const failure = new Error('watch registration failed')
    const rejected = expect(readiness.ready).rejects.toBe(failure)
    watcher.emit('error', failure)
    readiness.close()
    await rejected
    expectReleased(watcher)
  })

  it('retains the existing thirty second deadline and releases its observation on timeout', async () => {
    const { watcher, readiness } = fixture()
    let settled = false
    const observed = readiness.ready.finally(() => settled = true)
    const rejected = expect(observed).rejects.toThrow('Sidecar watcher ready timed out')
    await vi.advanceTimersByTimeAsync(29_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    readiness.close()
    expectReleased(watcher)
  })

  it('does not release another project initial scan or its observation', async () => {
    const first = fixture()
    const second = fixture()
    first.readiness.close()
    await expect(first.readiness.ready).resolves.toBe('closed')
    expect(second.watcher.listenerCount('ready')).toBe(1)
    expect(second.watcher.listenerCount('error')).toBe(1)
    expect(vi.getTimerCount()).toBe(1)
    second.watcher.emit('ready')
    await expect(second.readiness.ready).resolves.toBe('ready')
    expectReleased(second.watcher)
  })
})
