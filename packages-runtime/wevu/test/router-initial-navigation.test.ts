import { WEVU_INITIAL_NAVIGATION_TIMEOUT_MARKER } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelInitialNavigation,
  ensureInitialNavigation,
  getInitialNavigationStatus,
  registerInitialNavigationRunner,
} from '@/router/initialNavigation'

const state = vi.hoisted(() => ({
  activeRouter: undefined as object | undefined,
}))

vi.mock('@/router/instance', () => ({
  getActiveRouter: () => state.activeRouter,
}))

describe('router: initial navigation state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.activeRouter = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('mounts after the default timeout and warns once', async () => {
    const router = state.activeRouter!
    const runner = vi.fn(() => new Promise<void>(() => {}))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerInitialNavigationRunner(router, runner)
    const page = { route: 'pages/home/index', options: { from: 'query' } }
    const complete = vi.fn()
    const pending = ensureInitialNavigation(page, { from: 'query' }, { onComplete: complete })

    expect(runner).toHaveBeenCalledWith(
      { route: 'pages/home/index', __route__: undefined, options: { from: 'query' } },
      { from: 'query' },
    )
    expect(getInitialNavigationStatus(page)).toBe('running')
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(pending).resolves.toBe(true)
    expect(getInitialNavigationStatus(page)).toBe('timed-out')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain(WEVU_INITIAL_NAVIGATION_TIMEOUT_MARKER)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledWith(true)
  })

  it('keeps explicit abort and rejected guards from mounting', async () => {
    const router = state.activeRouter!
    const runner = vi.fn(() => Promise.resolve({ __wevuNavigationFailure: true } as any))
    registerInitialNavigationRunner(router, runner, 100)
    const page = {}
    const complete = vi.fn()
    const pending = ensureInitialNavigation(page, {}, { onComplete: complete })
    await expect(pending).resolves.toBe(false)
    expect(getInitialNavigationStatus(page)).toBe('aborted')
    expect(complete).not.toHaveBeenCalled()

    const rejectedPage = {}
    const rejectedRunner = vi.fn(() => Promise.reject(new Error('guard failed')))
    registerInitialNavigationRunner(router, rejectedRunner, 100)
    const rejected = ensureInitialNavigation(rejectedPage, {}, { onComplete: complete })
    await expect(rejected).resolves.toBe(false)
    expect(getInitialNavigationStatus(rejectedPage)).toBe('aborted')
  })

  it('cancels callbacks and ignores a late guard result after unload', async () => {
    const router = state.activeRouter!
    let resolveRunner!: () => void
    const runner = vi.fn(() => new Promise<void>((resolve) => {
      resolveRunner = resolve
    }))
    registerInitialNavigationRunner(router, runner, 100)
    const page = {}
    const complete = vi.fn()
    const pending = ensureInitialNavigation(page, {}, { onComplete: complete })
    cancelInitialNavigation(page)
    await expect(pending).resolves.toBe(false)
    expect(getInitialNavigationStatus(page)).toBe('cancelled')
    resolveRunner()
    await Promise.resolve()
    expect(complete).not.toHaveBeenCalled()
    expect(getInitialNavigationStatus(page)).toBe('cancelled')
  })

  it('releases an unstarted runner when the page is cancelled', async () => {
    const router = state.activeRouter!
    const runner = vi.fn(() => Promise.resolve())
    registerInitialNavigationRunner(router, runner, 100)
    const page = {}
    const pending = ensureInitialNavigation(page, {}, { start: false })

    cancelInitialNavigation(page)
    await expect(pending).resolves.toBe(false)
    expect(runner).not.toHaveBeenCalled()
    expect(ensureInitialNavigation(page)).toBe(pending)
    expect(getInitialNavigationStatus(page)).toBe('cancelled')
  })

  it('supports start:false and executes only one runner for repeated ensure calls', async () => {
    const router = state.activeRouter!
    let resolveRunner!: () => void
    const runner = vi.fn(() => new Promise<void>((resolve) => {
      resolveRunner = resolve
    }))
    registerInitialNavigationRunner(router, runner, 100)
    const page = {}
    const firstComplete = vi.fn()
    const secondComplete = vi.fn()
    const pending = ensureInitialNavigation(page, { first: 1 }, { start: false, onComplete: firstComplete })
    expect(runner).not.toHaveBeenCalled()
    expect(ensureInitialNavigation(page, { second: 2 }, { onComplete: secondComplete })).toBe(pending)
    expect(runner).toHaveBeenCalledTimes(1)
    resolveRunner()
    await expect(pending).resolves.toBe(true)
    await Promise.resolve()
    expect(firstComplete).toHaveBeenCalledWith(true)
    expect(secondComplete).toHaveBeenCalledWith(true)
  })
})
