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
