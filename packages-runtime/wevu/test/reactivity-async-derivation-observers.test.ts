import { afterEach, describe, expect, it, vi } from 'vitest'
import { effect, effectScope, stop, useAsyncDerivation } from '@/reactivity'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useAsyncDerivation observer failures', () => {
  it.each(['ready', 'error'] as const)('settles refresh and reports observer failures after publishing %s', async (terminal) => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const task = createDeferred<string>()
    const loaderError = new Error('loader failed')
    const observerError = new Error('observer failed')
    const state = useAsyncDerivation(() => task.promise, { immediate: false })
    const runner = effect(() => {
      if (state.status === terminal) {
        throw observerError
      }
    })

    try {
      const waiter = state.refresh()
      if (terminal === 'ready') {
        task.resolve('loaded')
      }
      else {
        task.reject(loaderError)
      }

      await expect(waiter).resolves.toBeUndefined()
      expect(state.status).toBe(terminal)
      expect(state.value).toBe(terminal === 'ready' ? 'loaded' : undefined)
      expect(state.error).toBe(terminal === 'error' ? loaderError : undefined)
      expect(() => vi.runAllTimers()).toThrow(observerError)
    }
    finally {
      stop(runner)
      state.dispose()
    }
  })

  it.each(['ready', 'error'] as const)('keeps waiters attached to a refresh started by a throwing %s observer', async (terminal) => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const first = createDeferred<string>()
    const latest = createDeferred<string>()
    const observerError = new Error('reentrant observer failed')
    let calls = 0
    const state = useAsyncDerivation(() => ++calls === 1 ? first.promise : latest.promise, { immediate: false })
    let latestWaiter!: Promise<void>
    let didRefresh = false
    let observe!: () => void
    const observed = new Promise<void>((resolve) => {
      observe = resolve
    })
    const runner = effect(() => {
      if (state.status === terminal && !didRefresh) {
        didRefresh = true
        latestWaiter = state.refresh()
        observe()
        throw observerError
      }
    })

    try {
      const olderWaiter = state.refresh()
      let settled = false
      void olderWaiter.then(() => {
        settled = true
      })
      if (terminal === 'ready') {
        first.resolve('older')
      }
      else {
        first.reject(new Error('older failure'))
      }

      await observed
      await Promise.resolve()
      expect(state.status).toBe(terminal === 'ready' ? 'refreshing' : 'initial-pending')
      expect(state.error).toBeUndefined()
      expect(settled).toBe(false)
      expect(() => vi.runAllTimers()).toThrow(observerError)

      latest.resolve('latest')
      await Promise.all([olderWaiter, latestWaiter])
      expect(state.status).toBe('ready')
      expect(state.value).toBe('latest')
      expect(state.error).toBeUndefined()
    }
    finally {
      stop(runner)
      state.dispose()
    }
  })

  it('clears retained state and settles all waiters before a dispose observer error escapes', async () => {
    const first = createDeferred<string>()
    const pending = createDeferred<string>()
    const signals: AbortSignal[] = []
    const observerError = new Error('dispose observer failed')
    let calls = 0
    const state = useAsyncDerivation(({ signal }) => {
      signals.push(signal)
      return ++calls === 1 ? first.promise : pending.promise
    }, { immediate: false })
    const initial = state.refresh()
    first.resolve('retained')
    await initial
    const runner = effect(() => {
      if (state.status === 'disposed') {
        throw observerError
      }
    })

    try {
      const olderWaiter = state.refresh()
      const latestWaiter = state.refresh()
      expect(state.value).toBe('retained')
      expect(() => state.dispose()).toThrow(observerError)
      await Promise.all([olderWaiter, latestWaiter])
      expect(state.status).toBe('disposed')
      expect(state.value).toBeUndefined()
      expect(state.error).toBeUndefined()
      expect(signals[1]?.aborted).toBe(true)
      expect(signals[2]?.aborted).toBe(true)

      state.dispose()
      await expect(state.refresh()).resolves.toBeUndefined()
      expect(calls).toBe(3)
      pending.reject(new Error('late failure'))
      await Promise.resolve()
      await Promise.resolve()
      expect(state.status).toBe('disposed')
      expect(state.error).toBeUndefined()
    }
    finally {
      stop(runner)
    }
  })

  it('settles a never-ending refresh when an observer outside its owning scope throws during scope stop', async () => {
    const scope = effectScope()
    const neverSettles = new Promise<string>(() => {})
    const observerError = new Error('outside observer failed')
    let signal!: AbortSignal
    const state = scope.run(() => useAsyncDerivation((context) => {
      signal = context.signal
      return neverSettles
    }, { immediate: false }))
    if (!state) {
      throw new Error('scope did not create the derivation')
    }
    const runner = effect(() => {
      if (state.status === 'disposed') {
        throw observerError
      }
    })

    try {
      const waiter = state.refresh()
      expect(() => scope.stop()).toThrow(observerError)
      await expect(waiter).resolves.toBeUndefined()
      expect(scope.active).toBe(false)
      expect(signal.aborted).toBe(true)
      expect(state.status).toBe('disposed')
      expect(state.value).toBeUndefined()
      expect(state.error).toBeUndefined()
    }
    finally {
      stop(runner)
      scope.stop()
    }
  })
})
