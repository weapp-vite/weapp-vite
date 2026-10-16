import type { MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportFeature1087NavigationFailure, reportFeature1087NavigationPoll } from '../e2e/ide/feature1087.shared'

const fixture = vi.hoisted(() => {
  const native = vi.fn()
  return {
    native,
    router: {
      nativeRouter: { navigateTo: native },
      beforeEach: vi.fn(),
      afterEach: vi.fn(),
      push: vi.fn(),
      currentRoute: { fullPath: '/pages/feature-1087/index?feed=redirected' },
    },
  }
})
vi.mock('wevu/router', () => ({
  useRouter: () => fixture.router,
  createScrollRestoration: () => ({ automatic: false, dispose: vi.fn() }),
}))
vi.mock('../e2e/ide/github-issues.runtime.shared', () => ({ waitForCurrentPagePath: vi.fn() }))

async function installFixture() {
  const module = await import('../e2e-apps/github-issues/src/shared/feature1087')
  module.initializeFeature1087()
  module.installFeature1087Guards()
  return module
}

function createProtocolMocks() {
  const source = { path: 'pages/feature-1087/index', query: { feed: 'guard-source' }, callMethodWithOptions: vi.fn(async () => ({ source: true })) }
  const target = { path: source.path, query: { feed: 'redirected' }, callMethodWithOptions: vi.fn(async () => ({ target: true })) }
  const miniProgram = {
    currentPage: vi.fn(async () => target),
    evaluateWithOptions: vi.fn(async () => []),
  }
  return {
    source,
    target,
    miniProgram,
    capture: () => reportFeature1087NavigationFailure(miniProgram as unknown as MiniProgram, source as unknown as Page, { navigationPoll: { state: 'failed' } }),
  }
}

function failureReport() {
  const output = vi.mocked(process.stdout.write).mock.calls.find(([value]) => String(value).startsWith('[feature1087 navigation failure] '))
  return JSON.parse(String(output?.[0]).slice('[feature1087 navigation failure] '.length)) as {
    budgetMs: number
    cached: { navigationPoll: { state: string } }
    source: { snapshot: { status: string } }
    target?: { snapshot: { status: string } }
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  fixture.native.mockReset()
  fixture.router.nativeRouter.navigateTo = fixture.native
  fixture.router.beforeEach.mockReset()
  fixture.router.afterEach.mockReset()
  vi.stubGlobal('getCurrentPages', () => [])
  vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: 'fixture' }), getDeviceInfo: () => ({ platform: 'fixture' }) })
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('feature1087 native observation without a host', () => {
  it('preserves native result, this, fields and callback this/arguments/results', async () => {
    await installFixture()
    const result = { native: true }
    fixture.native.mockReturnValue(result)
    const success = vi.fn(function (this: unknown, ...args: unknown[]) {
      return { receiver: this, args }
    })
    const fail = vi.fn(function (this: unknown, ...args: unknown[]) {
      return { receiver: this, args }
    })
    const complete = vi.fn()
    const receiver = { nativeRouter: true }
    const callbackReceiver = { callback: true }
    const options = { url: '/pages/feature-1087/index?feed=target', success, fail, complete, custom: 17 }

    expect(fixture.router.nativeRouter.navigateTo.call(receiver, options)).toBe(result)
    expect(fixture.native).toHaveBeenCalledTimes(1)
    expect(fixture.native.mock.contexts[0]).toBe(receiver)
    const observed = fixture.native.mock.calls[0]![0] as typeof options
    expect(observed).toMatchObject({ url: options.url, complete, custom: 17 })
    expect(observed.success.call(callbackReceiver, 'ok', 1)).toEqual({ receiver: callbackReceiver, args: ['ok', 1] })
    expect(observed.fail.call(callbackReceiver, 'failed', 2)).toEqual({ receiver: callbackReceiver, args: ['failed', 2] })
    expect(success).toHaveBeenCalledTimes(1)
    expect(fail).toHaveBeenCalledTimes(1)
  })

  it('passes non-feature native options through without wrapping', async () => {
    await installFixture()
    const options = { url: '/pages/other/index' }
    fixture.router.nativeRouter.navigateTo(options)
    expect(fixture.native).toHaveBeenCalledExactlyOnceWith(options)
  })

  it('rethrows the original native error even when diagnostic fields throw', async () => {
    await installFixture()
    const error = Object.defineProperty({}, 'message', { get: () => {
      throw new Error('unreadable')
    } })
    fixture.native.mockImplementation(() => {
      throw error
    })
    let received: unknown
    try {
      fixture.router.nativeRouter.navigateTo({ url: '/pages/feature-1087/index' })
    }
    catch (failure) {
      received = failure
    }
    expect(received).toBe(error)
  })

  it.each(['getter', 'subscription'])('keeps %s observation errors from changing the native return value', async (phase) => {
    const module = await installFixture()
    const result = phase === 'getter'
      ? Object.defineProperty({}, 'then', { get: () => {
          throw new Error('getter failed')
        } })
      : { then: () => {
          throw new Error('subscription failed')
        } }
    fixture.native.mockReturnValue(result)

    expect(fixture.router.nativeRouter.navigateTo({ url: '/pages/feature-1087/index' })).toBe(result)
    expect(module.readFeature1087Probe().navigationDiagnostics.some(item => item.phase === 'native:observation-failed')).toBe(true)
  })
})

describe('feature1087 failure observations share one budget', () => {
  it('uses remaining time for the target read while preserving the failed poll', async () => {
    const { source, target, miniProgram, capture } = createProtocolMocks()
    source.callMethodWithOptions.mockReturnValue(new Promise<never>(() => {}))
    target.callMethodWithOptions.mockReturnValue(new Promise<never>(() => {}))
    miniProgram.currentPage.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1_500, target)))
    const failure = capture()

    await vi.advanceTimersByTimeAsync(2_000)
    await failure

    expect(miniProgram.currentPage).toHaveBeenCalledExactlyOnceWith({ timeout: 2_000, retries: 1, pageStackFallback: false, appFunctionFallback: false })
    expect(target.callMethodWithOptions).toHaveBeenCalledExactlyOnceWith('_snapshot', { fallback: false, timeout: 500 })
    expect(failureReport()).toMatchObject({
      budgetMs: 2_000,
      cached: { navigationPoll: { state: 'failed' } },
      source: { snapshot: { status: 'timed-out' } },
      target: { snapshot: { status: 'timed-out' } },
    })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not dispatch a target probe when currentPage arrives after the deadline', async () => {
    const { target, miniProgram, capture } = createProtocolMocks()
    let resolveCurrent: ((page: typeof target) => void) | undefined
    miniProgram.currentPage.mockReturnValue(new Promise((resolve) => {
      resolveCurrent = resolve
    }))
    const failure = capture()

    await vi.advanceTimersByTimeAsync(2_000)
    await failure
    resolveCurrent?.(target)
    await Promise.resolve()
    await Promise.resolve()

    expect(target.callMethodWithOptions).not.toHaveBeenCalled()
    expect(failureReport().target).toBeUndefined()
  })

  it('keeps output errors isolated from both success and failure reports', async () => {
    const { capture } = createProtocolMocks()
    vi.mocked(process.stdout.write).mockImplementation(() => {
      throw new Error('stdout closed')
    })

    expect(() => reportFeature1087NavigationPoll({ navigationPoll: { state: 'passed' } })).not.toThrow()
    await expect(capture()).resolves.toBeUndefined()
  })
})
