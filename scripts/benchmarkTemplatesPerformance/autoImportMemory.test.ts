import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPeakRssSampler } from '../../packages/weapp-vite/scripts/utils/process-memory'

const { inspect } = vi.hoisted(() => ({ inspect: vi.fn() }))
vi.mock('execa', () => ({ execa: inspect }))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  inspect.mockReset()
})

describe('auto-import benchmark RSS lifecycle', () => {
  it('bounds slow Windows probes to one process and drains it when stopped', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    let finish!: (result: { stdout: string, failed: boolean }) => void
    inspect.mockImplementation(() => new Promise((resolve) => {
      finish = resolve
    }))
    const sampler = createPeakRssSampler(42)
    await vi.advanceTimersByTimeAsync(1_000)
    const callsWhilePending = inspect.mock.calls.length
    const stopping = sampler.stop()
    finish({ stdout: JSON.stringify({ ProcessId: 42, ParentProcessId: 1, WorkingSetSize: 256 }), failed: false })
    const memory = await stopping
    await vi.advanceTimersByTimeAsync(10_000)
    expect(callsWhilePending).toBe(1)
    expect(inspect).toHaveBeenCalledTimes(1)
    expect(memory.rssPeakBytes).toBe(256)
    expect(inspect).toHaveBeenCalledWith('powershell', expect.any(Array), expect.objectContaining({ timeout: 5_000, forceKillAfterDelay: 1_000 }))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not launch inspection without a child PID', async () => {
    vi.useFakeTimers()
    const sampler = createPeakRssSampler(undefined)
    expect((await sampler.stop()).rssPeakBytes).toBeNull()
    expect(inspect).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
