import { WEAPP_VITE_CLASSIC_SETTLEMENT_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { bindClassicSettlement, linkClassicSettlement } from './settlement'

function fixture() {
  const owner = {}
  let active = true
  let state: { build: Promise<unknown>, completion: Promise<unknown>, profile?: Promise<unknown>, pending: boolean }
    = { build: Promise.resolve(), completion: Promise.resolve(), pending: false }
  const flush = vi.fn()
  const binding = bindClassicSettlement(owner, { flush, read: () => state, isActive: () => active })
  return {
    owner,
    binding,
    flush,
    setState: (value: typeof state) => { state = value },
    deactivate: () => { active = false },
  }
}

describe('classic generation settlement', () => {
  it('binds the internal observer without adding enumerable context fields', async () => {
    const { owner, binding, flush } = fixture()
    expect(Object.getOwnPropertyDescriptor(owner, Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)))
      .toMatchObject({ value: binding, enumerable: false, configurable: true })
    expect(Object.keys(owner)).toEqual([])
    await binding.whenSettled()
    expect(flush).toHaveBeenCalled()
  })

  it('flushes a queued batch before capturing its raw publication', async () => {
    const batch = Promise.withResolvers<unknown>()
    const state = fixture()
    state.setState({ build: Promise.resolve(), completion: Promise.resolve(), pending: true })
    state.flush.mockImplementationOnce(() => {
      state.setState({ build: batch.promise, completion: Promise.resolve(), pending: false })
    })
    let settled = false
    const waiting = state.binding.whenSettled().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    batch.resolve(undefined)
    await waiting
    expect(settled).toBe(true)
  })

  it('includes a new publication registered while the previous one is pending', async () => {
    const first = Promise.withResolvers<unknown>()
    const next = Promise.withResolvers<unknown>()
    const state = fixture()
    state.setState({ build: first.promise, completion: Promise.resolve(), pending: false })
    let settled = false
    const waiting = state.binding.whenSettled().then(() => {
      settled = true
    })
    state.setState({ build: next.promise, completion: Promise.resolve(), pending: false })
    first.resolve(undefined)
    await first.promise
    expect(settled).toBe(false)
    next.resolve(undefined)
    await waiting
  })

  it('waits for both raw build and event completion before propagating a failure', async () => {
    const build = Promise.withResolvers<unknown>()
    const completion = Promise.withResolvers<unknown>()
    const error = new Error('raw publication failed')
    const state = fixture()
    state.setState({ build: build.promise, completion: completion.promise, pending: false })
    let finished = false
    const waiting = state.binding.whenSettled().finally(() => {
      finished = true
    })
    const rejected = expect(waiting).rejects.toBe(error)
    build.reject(error)
    await Promise.resolve()
    expect(finished).toBe(false)
    completion.resolve(undefined)
    await rejected
  })

  it('reports the original raw failure even when its recovery chain has resolved', async () => {
    const error = new Error('raw build failed')
    const raw = Promise.reject(error)
    await raw.catch(() => undefined)
    const state = fixture()
    state.setState({ build: raw, completion: Promise.resolve(), pending: false })
    await expect(state.binding.whenSettled()).rejects.toBe(error)
  })

  it('waits for separately scheduled profile writes without changing publication ordering', async () => {
    const profile = Promise.withResolvers<unknown>()
    const nextProfile = Promise.withResolvers<unknown>()
    const publication = Promise.resolve()
    const state = fixture()
    state.setState({ build: publication, completion: publication, profile: profile.promise, pending: false })
    let settled = false
    const waiting = state.binding.whenSettled().then(() => {
      settled = true
    })
    await publication
    expect(settled).toBe(false)
    state.setState({ build: publication, completion: publication, profile: nextProfile.promise, pending: false })
    profile.resolve(undefined)
    await profile.promise
    expect(settled).toBe(false)
    nextProfile.resolve(undefined)
    await waiting
  })

  it('does not retain a previous failure after a new raw publication succeeds', async () => {
    const error = new Error('old build failed')
    const raw = Promise.reject(error)
    await raw.catch(() => undefined)
    const state = fixture()
    state.setState({ build: raw, completion: Promise.resolve(), pending: false })
    await expect(state.binding.whenSettled()).rejects.toBe(error)
    state.setState({ build: Promise.resolve(), completion: Promise.resolve(), pending: false })
    await expect(state.binding.whenSettled()).resolves.toBeUndefined()
  })

  it('retains failures already observed by a waiter through a later successful publication', async () => {
    const raw = Promise.withResolvers<unknown>()
    const completion = Promise.withResolvers<unknown>()
    const error = new Error('observed old publication failed')
    const state = fixture()
    state.setState({ build: raw.promise, completion: completion.promise, pending: false })
    const waiting = state.binding.whenSettled()
    const rejected = expect(waiting).rejects.toBe(error)
    state.setState({ build: Promise.resolve(), completion: Promise.resolve(), pending: false })
    raw.reject(error)
    completion.resolve(undefined)
    await rejected
    await expect(state.binding.whenSettled()).resolves.toBeUndefined()
  })

  it('deduplicates one shared error and preserves distinct original failures in order', async () => {
    const first = new Error('build failed')
    const second = new Error('event completion failed')
    const state = fixture()
    const same = Promise.reject(first)
    await same.catch(() => undefined)
    state.setState({ build: same, completion: same, pending: false })
    await expect(state.binding.whenSettled()).rejects.toBe(first)
    const other = Promise.reject(second)
    await other.catch(() => undefined)
    state.setState({ build: same, completion: other, pending: false })
    await expect(state.binding.whenSettled()).rejects.toMatchObject({ cause: first, errors: [first, second] })
  })

  it('preserves synchronous flush and read errors', async () => {
    const error = new Error('flush failed')
    const state = fixture()
    state.flush.mockImplementation(() => {
      throw error
    })
    await expect(state.binding.whenSettled()).rejects.toBe(error)
    const readError = new Error('read failed')
    const binding = bindClassicSettlement({}, {
      flush() {},
      read() { throw readError },
      isActive: () => true,
    })
    await expect(binding.whenSettled()).rejects.toBe(readError)
  })

  it('drains captured tasks after a failed flush without retrying its pending batch', async () => {
    const build = Promise.withResolvers<unknown>()
    const failure = new Error('snapshot batch flush failed')
    const repeated = new Error('failed flush was repeated')
    const flush = vi.fn(() => {
      throw failure
    })
    const binding = bindClassicSettlement({}, {
      flush,
      read() {
        // 错误实现第二次读取时立即退出，避免回归本身进入无限微任务循环。
        if (flush.mock.calls.length > 1) {
          throw repeated
        }
        return { build: build.promise, completion: Promise.resolve(), pending: true }
      },
      isActive: () => true,
    })
    let finished = false
    const outcome = binding.whenSettled().then(
      () => ({ error: undefined }),
      error => ({ error: error as unknown }),
    ).finally(() => {
      finished = true
    })
    await Promise.resolve()
    expect(flush).toHaveBeenCalledOnce()
    expect(finished).toBe(false)
    build.resolve(undefined)
    expect(await outcome).toEqual({ error: failure })
    expect(flush).toHaveBeenCalledOnce()
  })

  it('retires pending waiters immediately and closes only its own binding', async () => {
    const state = fixture()
    const never = new Promise(() => {})
    state.setState({ build: never, completion: never, pending: false })
    const waiting = state.binding.whenSettled()
    const rejected = expect(waiting).rejects.toThrow(/retired/)
    state.binding.retire()
    state.binding.retire()
    await rejected
    expect(Reflect.has(state.owner, Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY))).toBe(false)
    await expect(state.binding.whenSettled()).rejects.toThrow(/retired/)
  })

  it('rejects an inactive generation instead of reporting an empty success', async () => {
    const state = fixture()
    state.deactivate()
    await expect(state.binding.whenSettled()).rejects.toThrow(/retired/)
    expect(state.flush).not.toHaveBeenCalled()
  })

  it('keeps an observed raw error when retirement cancels the remaining wait', async () => {
    const raw = Promise.withResolvers<unknown>()
    const error = new Error('publication failed before shutdown')
    const state = fixture()
    state.setState({ build: raw.promise, completion: new Promise(() => {}), pending: false })
    const waiting = state.binding.whenSettled()
    const rejected = expect(waiting).rejects.toMatchObject({
      cause: error,
      errors: [error, expect.objectContaining({ message: expect.stringContaining('retired') })],
    })
    raw.reject(error)
    await raw.promise.catch(() => undefined)
    state.binding.retire()
    await rejected
  })

  it('invalidates old pending waiters on replacement and ignores late retirement of the old owner', async () => {
    const state = fixture()
    const never = new Promise(() => {})
    state.setState({ build: never, completion: never, pending: false })
    const waiting = state.binding.whenSettled()
    const rejected = expect(waiting).rejects.toThrow(/retired/)
    const completed = Promise.resolve()
    const fresh = bindClassicSettlement(state.owner, {
      flush() {},
      read: () => ({ build: completed, completion: completed, pending: false }),
      isActive: () => true,
    })
    await rejected
    state.binding.retire()
    expect(Reflect.get(state.owner, Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY))).toBe(fresh)
    await expect(fresh.whenSettled()).resolves.toBeUndefined()
  })
})

describe('classic host settlement link', () => {
  it('forwards the current owner generation through a non-enumerable getter', async () => {
    const first = fixture()
    const target = {}
    const key = Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)
    const release = linkClassicSettlement(first.owner, target)
    expect(Object.getOwnPropertyDescriptor(target, key))
      .toMatchObject({ get: expect.any(Function), enumerable: false, configurable: true })
    expect(Object.keys(target)).toEqual([])
    expect(Reflect.get(target, key)).toBe(first.binding)
    const completed = Promise.resolve()
    const next = bindClassicSettlement(first.owner, {
      flush() {},
      read: () => ({ build: completed, completion: completed, pending: false }),
      isActive: () => true,
    })
    expect(Reflect.get(target, key)).toBe(next)
    await expect(first.binding.whenSettled()).rejects.toThrow('retired')
    next.retire()
    expect(Reflect.get(target, key)).toBeUndefined()
    release()
    expect(Object.getOwnPropertyDescriptor(target, key)).toBeUndefined()
  })

  it('keeps a replacement host link and both owners intact when an old link is released', () => {
    const first = fixture()
    const next = fixture()
    const target = {}
    const key = Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)
    const releaseFirst = linkClassicSettlement(first.owner, target)
    const releaseNext = linkClassicSettlement(next.owner, target)
    releaseFirst()
    releaseFirst()
    expect(Reflect.get(target, key)).toBe(next.binding)
    expect(Reflect.get(first.owner, key)).toBe(first.binding)
    expect(Reflect.get(next.owner, key)).toBe(next.binding)
    releaseNext()
    releaseNext()
    expect(Object.getOwnPropertyDescriptor(target, key)).toBeUndefined()
    expect(Reflect.get(first.owner, key)).toBe(first.binding)
    expect(Reflect.get(next.owner, key)).toBe(next.binding)
  })
})
