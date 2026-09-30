import { describe, expect, it, vi } from 'vitest'
import { createRebuildScheduler } from './scheduler'

describe('rebuild scheduler', () => {
  it('coalesces changes during a build and never overlaps builds', async () => {
    let release!: () => void
    let calls = 0
    const scheduler = createRebuildScheduler(async () => {
      calls++
      if (calls === 1) {
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
    }, (error) => {
      throw error
    })
    const first = scheduler.schedule()
    void scheduler.schedule()
    void scheduler.schedule()
    expect(calls).toBe(1)
    release()
    await first
    expect(calls).toBe(2)
    await scheduler.close()
    await scheduler.schedule()
    expect(calls).toBe(2)
  })
  it('reports failures and accepts a later successful build', async () => {
    const rebuild = vi.fn().mockRejectedValueOnce(new Error('invalid template')).mockResolvedValue(undefined)
    const onError = vi.fn()
    const scheduler = createRebuildScheduler(rebuild, onError)
    await scheduler.schedule()
    await scheduler.schedule()
    expect(onError).toHaveBeenCalledOnce()
    expect(rebuild).toHaveBeenCalledTimes(2)
    await scheduler.close()
  })
})
