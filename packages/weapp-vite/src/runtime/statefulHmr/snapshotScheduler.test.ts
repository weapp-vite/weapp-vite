import { afterEach, describe, expect, it, vi } from 'vitest'
import { StatefulHmrSnapshotScheduler } from './snapshotScheduler'

function createDeferred() {
  return Promise.withResolvers<void>()
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('stateful hmr snapshot scheduler', () => {
  it('propagates an in-flight cleanup rejection awaited by close without retrying', async () => {
    vi.useFakeTimers()
    const pending = createDeferred()
    const execute = vi.fn(() => pending.promise)
    const scheduler = new StatefulHmrSnapshotScheduler({ execute })
    scheduler.request('refresh', ['app.wxss'])
    await vi.advanceTimersByTimeAsync(40)
    const failure = new Error('closing preparation disposal failed')
    const rejected = expect(scheduler.close()).rejects.toBe(failure)
    pending.reject(failure)
    await rejected
    await expect(scheduler.close()).rejects.toBe(failure)
    expect(execute).toHaveBeenCalledOnce()
  })

  it('does not turn a historical publication failure into a close cleanup rejection', async () => {
    vi.useFakeTimers()
    const failure = new Error('old build failed')
    const scheduler = new StatefulHmrSnapshotScheduler({ execute: async () => {
      throw failure
    } })
    scheduler.request('refresh', ['app.wxss'])
    const failed = expect(scheduler.whenSettled()).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(40)
    await failed
    await expect(scheduler.close()).resolves.toBeUndefined()
  })

  it('does not count the exact rejection that initiated close as a second cleanup failure', async () => {
    vi.useFakeTimers()
    const pending = createDeferred()
    const cause = new Error('classic handoff requested')
    const onError = vi.fn()
    const execute = vi.fn(() => pending.promise)
    const scheduler = new StatefulHmrSnapshotScheduler({ execute, onError })
    scheduler.request('refresh', ['page.wxml'])
    await vi.advanceTimersByTimeAsync(40)
    const closing = scheduler.close({ cause })
    pending.reject(cause)
    await expect(closing).resolves.toBeUndefined()
    await expect(scheduler.close()).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledExactlyOnceWith(cause)
    expect(execute).toHaveBeenCalledOnce()
  })

  it.each(['different', 'combined'] as const)('preserves a %s failure after an explicit close cause', async (kind) => {
    vi.useFakeTimers()
    const pending = createDeferred()
    const cause = new Error('classic handoff requested')
    const cleanup = new Error('preparation cleanup failed')
    const failure = kind === 'different' ? cleanup : new AggregateError([cause, cleanup], 'handoff and cleanup failed', { cause })
    const scheduler = new StatefulHmrSnapshotScheduler({ execute: () => pending.promise })
    scheduler.request('refresh', ['page.wxml'])
    await vi.advanceTimersByTimeAsync(40)
    const closing = expect(scheduler.close({ cause })).rejects.toBe(failure)
    pending.reject(failure)
    await closing
    await expect(scheduler.close({ cause: failure })).rejects.toBe(failure)
  })

  it('settles only after debounce, execution, and a newer queued refresh finish', async () => {
    vi.useFakeTimers()
    const first = createDeferred()
    const second = createDeferred()
    const execute = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    const scheduler = new StatefulHmrSnapshotScheduler({ execute })
    scheduler.request('refresh', ['pages/first.vue'])
    let settled = false
    const waiting = scheduler.whenSettled().then(() => {
      settled = true
    })
    await flushPromises()
    expect(settled).toBe(false)
    expect(execute).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(40)
    scheduler.request('refresh', ['pages/second.vue'])
    first.resolve()
    await vi.advanceTimersByTimeAsync(40)
    expect(execute).toHaveBeenCalledTimes(2)
    expect(settled).toBe(false)
    second.resolve()
    await waiting
    expect(settled).toBe(true)
    await scheduler.close()
  })

  it('rejects failed settlement and recovers after a later successful request', async () => {
    vi.useFakeTimers()
    const error = new Error('snapshot publication failed')
    const execute = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined)
    const scheduler = new StatefulHmrSnapshotScheduler({ execute })
    scheduler.request('refresh', ['pages/first.vue'])
    const rejected = expect(scheduler.whenSettled()).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(40)
    await rejected
    await expect(scheduler.whenSettled()).rejects.toBe(error)
    scheduler.request('refresh', ['pages/first.vue'])
    const recovered = scheduler.whenSettled()
    await vi.advanceTimersByTimeAsync(40)
    await expect(recovered).resolves.toBeUndefined()
    await scheduler.close()
  })

  it('releases a pending debounce waiter when the scheduler closes', async () => {
    vi.useFakeTimers()
    const execute = vi.fn()
    const scheduler = new StatefulHmrSnapshotScheduler({ execute })
    scheduler.request('refresh', ['pages/first.vue'])
    const rejected = expect(scheduler.whenSettled()).rejects.toThrow('closed before settlement')
    await scheduler.close()
    await rejected
    expect(execute).not.toHaveBeenCalled()
  })

  it('debounces files into one refresh batch', async () => {
    vi.useFakeTimers()
    const batches: Array<{ files: string[], mode: string }> = []
    const scheduler = new StatefulHmrSnapshotScheduler({
      execute: async (batch) => {
        batches.push({ files: batch.files, mode: batch.mode })
      },
    })

    scheduler.request('refresh', ['/project/src/pages/index.vue'])
    scheduler.request('refresh', ['/project/src/app.css'])
    await vi.advanceTimersByTimeAsync(40)

    expect(batches).toEqual([{
      files: ['/project/src/pages/index.vue', '/project/src/app.css'],
      mode: 'refresh',
    }])
    await scheduler.close()
  })

  it('serializes rebuilds and requeues superseded files', async () => {
    vi.useFakeTimers()
    const deferreds = [createDeferred(), createDeferred()]
    const batches: Array<{ files: string[], isSuperseded: () => boolean }> = []
    let active = 0
    let maxActive = 0
    const scheduler = new StatefulHmrSnapshotScheduler({
      execute: async (batch) => {
        const index = batches.length
        batches.push({ files: batch.files, isSuperseded: batch.isSuperseded })
        active += 1
        maxActive = Math.max(maxActive, active)
        await deferreds[index]!.promise
        active -= 1
      },
    })

    scheduler.request('refresh', ['/project/src/pages/index.vue'])
    await vi.advanceTimersByTimeAsync(40)
    scheduler.request('refresh', ['/project/src/app.css'])

    expect(batches).toHaveLength(1)
    expect(batches[0]!.isSuperseded()).toBe(true)
    deferreds[0]!.resolve()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(40)

    expect(batches).toHaveLength(2)
    expect(batches[1]!.files).toEqual([
      '/project/src/app.css',
      '/project/src/pages/index.vue',
    ])
    expect(maxActive).toBe(1)
    deferreds[1]!.resolve()
    await scheduler.close()
  })

  it('keeps full rebuild priority after a newer refresh request', async () => {
    vi.useFakeTimers()
    const first = createDeferred()
    const batches: Array<{ isSuperseded: () => boolean, mode: string }> = []
    const scheduler = new StatefulHmrSnapshotScheduler({
      execute: async (batch) => {
        batches.push({ isSuperseded: batch.isSuperseded, mode: batch.mode })
        if (batches.length === 1) {
          await first.promise
        }
      },
    })

    scheduler.request('full', ['/project/src/pages/index.ts'])
    await vi.advanceTimersByTimeAsync(40)
    scheduler.request('refresh', ['/project/src/app.css'])
    expect(batches[0]!.isSuperseded()).toBe(true)
    first.resolve()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(40)

    expect(batches.map(batch => batch.mode)).toEqual(['full', 'full'])
    await scheduler.close()
  })

  it('retains failed files and full priority until a new request without retrying forever', async () => {
    vi.useFakeTimers()
    const error = new Error('native write failed')
    const execute = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined)
    const onError = vi.fn(() => {
      throw new Error('diagnostic callback failed')
    })
    const scheduler = new StatefulHmrSnapshotScheduler({ execute, onError })

    scheduler.request('full', ['pages/first.vue'])
    await vi.advanceTimersByTimeAsync(40)
    expect(onError).toHaveBeenCalledWith(error)
    expect(scheduler.isPending()).toBe(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(execute).toHaveBeenCalledTimes(1)

    scheduler.request('refresh', ['pages/second.wxss'])
    await vi.advanceTimersByTimeAsync(40)
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[1]![0]).toMatchObject({
      files: ['pages/first.vue', 'pages/second.wxss'],
      mode: 'full',
    })
    await scheduler.close()
  })

  it('retries a failed in-flight batch once when a newer request is already queued', async () => {
    vi.useFakeTimers()
    const first = createDeferred()
    const execute = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined)
    const scheduler = new StatefulHmrSnapshotScheduler({ execute })

    scheduler.request('full', ['pages/first.vue'])
    await vi.advanceTimersByTimeAsync(40)
    scheduler.request('refresh', ['pages/second.wxss'])
    first.reject(new Error('write failed after a newer request'))
    await vi.advanceTimersByTimeAsync(40)

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[1]![0]).toMatchObject({
      files: ['pages/second.wxss', 'pages/first.vue'],
      mode: 'full',
    })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(execute).toHaveBeenCalledTimes(2)
    await scheduler.close()
  })
})
