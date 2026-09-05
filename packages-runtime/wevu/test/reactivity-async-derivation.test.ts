import { AbortSignalPolyfill } from '@wevu/web-apis/abort'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effect, effectScope, ref, stop, useAsyncDerivation } from '@/reactivity'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function taskAt<T>(tasks: readonly Deferred<T>[], index: number) {
  const task = tasks[index]
  if (!task) {
    throw new Error(`missing deferred task at index ${index}`)
  }
  return task
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAsyncDerivation', () => {
  it('runs immediately by default and stays idle when immediate is false', async () => {
    let immediateCalls = 0
    const immediate = useAsyncDerivation(async () => {
      immediateCalls += 1
      return 'loaded'
    })

    expect(immediate.status).toBe('initial-pending')
    expect(immediate.value).toBeUndefined()
    expect(immediateCalls).toBe(1)
    await Promise.resolve()
    expect(immediate.status).toBe('ready')
    expect(immediate.value).toBe('loaded')

    let lazyCalls = 0
    const lazy = useAsyncDerivation(async () => {
      lazyCalls += 1
      return 'lazy'
    }, { immediate: false })

    expect(lazy.status).toBe('idle')
    expect(() => Reflect.set(lazy, 'status', 'ready')).toThrow('无法在只读对象上设置属性')
    expect(lazyCalls).toBe(0)
    const settled = lazy.refresh()
    expect(lazy.status).toBe('initial-pending')
    await settled
    expect(lazy.status).toBe('ready')
    expect(lazy.value).toBe('lazy')
  })

  it('keeps the last successful value while refreshing', async () => {
    const initial = createDeferred<string>()
    const refreshed = createDeferred<string>()
    const tasks = [initial, refreshed]
    let callIndex = 0
    const state = useAsyncDerivation(() => taskAt(tasks, callIndex++).promise)

    initial.resolve('initial')
    await Promise.resolve()
    expect(state.status).toBe('ready')
    expect(state.value).toBe('initial')

    const settled = state.refresh()
    expect(state.status).toBe('refreshing')
    expect(state.value).toBe('initial')
    expect(state.error).toBeUndefined()

    refreshed.resolve('refreshed')
    await settled
    expect(state.status).toBe('ready')
    expect(state.value).toBe('refreshed')
  })

  it('publishes terminal state fields in one batch', async () => {
    const pending = createDeferred<string>()
    const state = useAsyncDerivation(() => pending.promise, { immediate: false })
    const observed: Array<[string, string | undefined, unknown]> = []
    const runner = effect(() => {
      observed.push([state.status, state.value, state.error])
    })

    const settled = state.refresh()
    pending.resolve('ready')
    await settled

    expect(observed).toEqual([
      ['idle', undefined, undefined],
      ['initial-pending', undefined, undefined],
      ['ready', 'ready', undefined],
    ])
    stop(runner)
  })

  it('fulfills refresh on initial and refresh errors while retaining only successful values', async () => {
    const initialFailure = createDeferred<string>()
    const success = createDeferred<string>()
    const refreshFailure = createDeferred<string>()
    const tasks = [initialFailure, success, refreshFailure]
    let callIndex = 0
    const state = useAsyncDerivation(() => taskAt(tasks, callIndex++).promise, { immediate: false })
    const initialError = new Error('initial failed')

    const initialSettled = state.refresh()
    initialFailure.reject(initialError)
    await expect(initialSettled).resolves.toBeUndefined()
    expect(state.status).toBe('error')
    expect(state.value).toBeUndefined()
    expect(state.error).toBe(initialError)

    const retrySettled = state.refresh()
    expect(state.status).toBe('initial-pending')
    expect(state.error).toBeUndefined()
    success.resolve('stable')
    await retrySettled
    expect(state.status).toBe('ready')

    const refreshError = new Error('refresh failed')
    const refreshSettled = state.refresh()
    expect(state.status).toBe('refreshing')
    refreshFailure.reject(refreshError)
    await expect(refreshSettled).resolves.toBeUndefined()
    expect(state.status).toBe('error')
    expect(state.value).toBe('stable')
    expect(state.error).toBe(refreshError)
  })

  it('defers synchronous loader errors through the same pending transition', async () => {
    const error = new Error('synchronous failure')
    const state = useAsyncDerivation<string>(() => {
      throw error
    }, { immediate: false })

    const settled = state.refresh()
    expect(state.status).toBe('initial-pending')
    expect(state.error).toBeUndefined()

    await expect(settled).resolves.toBeUndefined()
    expect(state.status).toBe('error')
    expect(state.value).toBeUndefined()
    expect(state.error).toBe(error)
  })

  it('lets only the latest success or rejection commit and aborts superseded tasks', async () => {
    const first = createDeferred<string>()
    const second = createDeferred<string>()
    const third = createDeferred<string>()
    const fourth = createDeferred<string>()
    const tasks = [first, second, third, fourth]
    const signals: AbortSignal[] = []
    let callIndex = 0
    const state = useAsyncDerivation(({ signal }) => {
      signals.push(signal)
      return taskAt(tasks, callIndex++).promise
    }, { immediate: false })

    const firstSettled = state.refresh()
    const secondSettled = state.refresh()
    expect(signals[0]).not.toBeInstanceOf(AbortSignalPolyfill)
    expect(signals[0]?.aborted).toBe(true)

    first.resolve('stale success')
    await Promise.resolve()
    expect(state.status).toBe('initial-pending')
    expect(state.value).toBeUndefined()

    second.resolve('latest success')
    await secondSettled
    await firstSettled
    expect(state.status).toBe('ready')
    expect(state.value).toBe('latest success')

    const thirdSettled = state.refresh()
    const fourthSettled = state.refresh()
    expect(signals[2]?.aborted).toBe(true)
    const staleError = new Error('stale rejection')
    third.reject(staleError)
    await Promise.resolve()
    expect(state.status).toBe('refreshing')
    expect(state.error).toBeUndefined()

    const latestError = new Error('latest rejection')
    fourth.reject(latestError)
    await fourthSettled
    await thirdSettled
    expect(state.status).toBe('error')
    expect(state.value).toBe('latest success')
    expect(state.error).toBe(latestError)
  })

  it('settles older refresh waiters when a never-settling task is superseded', async () => {
    const neverSettles = new Promise<string>(() => {})
    const latest = createDeferred<string>()
    const signals: AbortSignal[] = []
    let callIndex = 0
    const state = useAsyncDerivation(({ signal }) => {
      signals.push(signal)
      callIndex += 1
      return callIndex === 1 ? neverSettles : latest.promise
    }, { immediate: false })

    const olderWaiter = state.refresh()
    const latestWaiter = state.refresh()
    expect(signals[0]?.aborted).toBe(true)

    latest.resolve('latest')
    await latestWaiter
    await expect(olderWaiter).resolves.toBeUndefined()
    expect(state.status).toBe('ready')
    expect(state.value).toBe('latest')
  })

  it('uses the web-apis AbortController fallback when the host lacks one', async () => {
    vi.stubGlobal('AbortController', undefined)
    const neverSettles = new Promise<string>(() => {})
    const latest = createDeferred<string>()
    const signals: AbortSignal[] = []
    let callIndex = 0
    const state = useAsyncDerivation(({ signal }) => {
      signals.push(signal)
      callIndex += 1
      return callIndex === 1 ? neverSettles : latest.promise
    }, { immediate: false })

    const olderSettled = state.refresh()
    const settled = state.refresh()
    expect(signals[0]).toBeInstanceOf(AbortSignalPolyfill)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]).toBeInstanceOf(AbortSignalPolyfill)

    latest.resolve('polyfilled')
    await olderSettled
    await settled
    expect(state.value).toBe('polyfilled')
  })

  it('disposes manually, clears retained state, and makes later refreshes no-ops', async () => {
    const success = createDeferred<string>()
    const failure = createDeferred<string>()
    const tasks = [success, failure]
    let calls = 0
    const state = useAsyncDerivation(() => taskAt(tasks, calls++).promise, { immediate: false })

    const ready = state.refresh()
    success.resolve('retained')
    await ready
    const failed = state.refresh()
    const error = new Error('failed')
    failure.reject(error)
    await failed
    expect(state.value).toBe('retained')
    expect(state.error).toBe(error)

    state.dispose()
    state.dispose()
    expect(state.status).toBe('disposed')
    expect(state.value).toBeUndefined()
    expect(state.error).toBeUndefined()
    await expect(state.refresh()).resolves.toBeUndefined()
    expect(calls).toBe(2)
  })

  it('disposes with its effect scope, aborts pending work, settles waiters, and ignores late results', async () => {
    const lateSuccess = createDeferred<string>()
    const lateFailure = createDeferred<string>()
    const signals: AbortSignal[] = []
    const scope = effectScope()
    const states = scope.run(() => ({
      success: useAsyncDerivation(({ signal }) => {
        signals.push(signal)
        return lateSuccess.promise
      }, { immediate: false }),
      failure: useAsyncDerivation(({ signal }) => {
        signals.push(signal)
        return lateFailure.promise
      }, { immediate: false }),
    }))

    if (!states) {
      throw new Error('effect scope did not create async derivations')
    }
    const successSettled = states.success.refresh()
    const failureSettled = states.failure.refresh()
    expect(states.success.status).toBe('initial-pending')
    expect(states.failure.status).toBe('initial-pending')
    scope.stop()
    await Promise.all([successSettled, failureSettled])
    expect(signals.every(signal => signal.aborted)).toBe(true)
    expect(states.success.status).toBe('disposed')
    expect(states.failure.status).toBe('disposed')

    lateSuccess.resolve('too late')
    lateFailure.reject(new Error('too late'))
    await Promise.resolve()
    expect(states.success.status).toBe('disposed')
    expect(states.success.value).toBeUndefined()
    expect(states.failure.status).toBe('disposed')
    expect(states.failure.error).toBeUndefined()
  })

  it('does not automatically track reactive values read by the loader', async () => {
    const source = ref(1)
    let calls = 0
    const state = useAsyncDerivation(() => {
      calls += 1
      return source.value
    }, { immediate: false })

    await state.refresh()
    expect(state.value).toBe(1)
    source.value = 2
    await Promise.resolve()
    expect(calls).toBe(1)
    expect(state.value).toBe(1)
    await state.refresh()
    expect(calls).toBe(2)
    expect(state.value).toBe(2)
  })

  it('does not leak loader reads into the effect that calls refresh', async () => {
    const source = ref(1)
    const doubled = computed(() => source.value * 2)
    const state = useAsyncDerivation(() => doubled.value, { immediate: false })
    let effectRuns = 0
    let settled!: Promise<void>
    const runner = effect(() => {
      effectRuns += 1
      if (effectRuns === 1) {
        settled = state.refresh()
      }
    })

    await settled
    expect(state.value).toBe(2)
    expect(effectRuns).toBe(1)

    source.value = 2
    expect(effectRuns).toBe(1)
    await state.refresh()
    expect(state.value).toBe(4)
    expect(effectRuns).toBe(1)
    stop(runner)
  })

  it('does not leak thenable adoption reads into the effect that calls refresh', async () => {
    const source = ref(1)
    let thenGetterReads = 0
    const thenable = {
      get then() {
        thenGetterReads++
        void source.value
        return (resolve: (value: string) => void) => {
          resolve('ready')
        }
      },
    } as unknown as PromiseLike<string>
    const state = useAsyncDerivation(() => thenable, { immediate: false })
    let effectRuns = 0
    let settled!: Promise<void>
    const runner = effect(() => {
      effectRuns++
      if (effectRuns === 1) {
        settled = state.refresh()
      }
    })

    await settled
    expect(state.value).toBe('ready')
    expect(thenGetterReads).toBe(1)
    expect(effectRuns).toBe(1)

    source.value = 2
    expect(effectRuns).toBe(1)
    stop(runner)
  })

  it('keeps ordinary computed values synchronous', () => {
    const source = ref(2)
    const doubled = computed(() => source.value * 2)
    expect(doubled.value).toBe(4)
    expect(doubled.value).not.toBeInstanceOf(Promise)
    source.value = 3
    expect(doubled.value).toBe(6)
  })
})
