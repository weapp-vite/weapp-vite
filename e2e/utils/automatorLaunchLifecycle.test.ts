import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('automator launch lifecycle', () => {
  it('disposes a result past the monotonic deadline before the timer callback runs', async () => {
    vi.useFakeTimers()
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const dispose = vi.fn()
    const refresh = vi.fn()
    const lifecycle = new AutomatorLaunchLifecycle(50, 'launch')
    const result = lifecycle.run(async (scope) => {
      await scope.step(async () => {
        now = 51
        return { session: 'late' }
      }, { waitForExit: true, disposeLate: dispose })
      refresh()
    })
    await expect(result).rejects.toThrow('Timeout in launch after 50ms')
    expect(dispose).toHaveBeenCalledExactlyOnceWith({ session: 'late' })
    expect(refresh).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('takes cleanup ownership when a delivered resource crosses the deadline before registration', async () => {
    vi.useFakeTimers()
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const cleanup = vi.fn()
    const disposeLate = vi.fn()
    const lifecycle = new AutomatorLaunchLifecycle(50, 'launch')
    const result = lifecycle.run(async (scope) => {
      await scope.step(async () => {
        now = 49
        return { session: 'ready' }
      }, { disposeLate })
      now = 51
      scope.own(cleanup)
    })
    await expect(result).rejects.toThrow('Timeout in launch after 50ms')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(disposeLate).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels a shorter HTTP phase and waits for request settlement before recovery', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const lifecycle = new AutomatorLaunchLifecycle(90_000, 'launch')
    const result = lifecycle.run(scope => scope.phase(20, 'refresh', phase => new Promise<void>((_resolve, reject) => {
      phase.signal.addEventListener('abort', () => {
        events.push('abort-request')
        setTimeout(() => {
          events.push('request-settled')
          reject(phase.signal.reason)
        }, 5)
      }, { once: true })
    }))).catch((error) => {
      events.push('recovery')
      return error
    })
    await vi.advanceTimersByTimeAsync(20)
    expect(events).toEqual(['abort-request'])
    await vi.advanceTimersByTimeAsync(5)
    await expect(result).resolves.toMatchObject({ message: 'Timeout in refresh after 20ms' })
    expect(events).toEqual(['abort-request', 'request-settled', 'recovery'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits for canceled child exit before allowing recovery', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const lifecycle = new AutomatorLaunchLifecycle(50, 'launch')
    const result = lifecycle.run(async scope => scope.step(() => new Promise<void>((resolve) => {
      scope.signal.addEventListener('abort', () => {
        events.push('cancel')
        setTimeout(() => {
          events.push('exit')
          resolve()
        }, 25)
      }, { once: true })
    }), { waitForExit: true })).catch(() => events.push('recovery'))
    await vi.advanceTimersByTimeAsync(50)
    expect(events).toEqual(['cancel'])
    await vi.advanceTimersByTimeAsync(25)
    await result
    expect(events).toEqual(['cancel', 'exit', 'recovery'])
  })

  it('closes a late SDK session without advancing to refresh', async () => {
    vi.useFakeTimers()
    const close = vi.fn()
    const refresh = vi.fn()
    let connect!: (session: { close: typeof close }) => void
    const lifecycle = new AutomatorLaunchLifecycle(50, 'launch')
    const result = lifecycle.run(async (scope) => {
      await scope.step(() => new Promise<{ close: typeof close }>((resolve) => {
        connect = resolve
      }), { disposeLate: session => session.close() })
      refresh()
    })
    const assertion = expect(result).rejects.toThrow('Timeout in launch after 50ms')
    await vi.advanceTimersByTimeAsync(50)
    await assertion
    connect({ close })
    await vi.advanceTimersByTimeAsync(0)
    expect(close).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps one deadline across phases and releases the timer on success', async () => {
    vi.useFakeTimers()
    const lifecycle = new AutomatorLaunchLifecycle(50, 'launch')
    const result = lifecycle.run(async (scope) => {
      await scope.pause(20)
      expect(scope.remainingMs()).toBe(30)
      return 'ready'
    })
    await vi.advanceTimersByTimeAsync(20)
    await expect(result).resolves.toBe('ready')
    expect(vi.getTimerCount()).toBe(0)
  })
})
