import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { enterCoreHmrRoute } from '../../ide/wevuRuntimeDom/coreHmrSession'
import { observeHeadlessCurrentTemplate } from '../../ide/wevuRuntimeDom/headlessTemplateObservation'

const route = '/pages/hmr/index'
const page = { path: 'pages/hmr/index' }
const closed = new Error('WebSocket is not open')

function fixture(current = page) {
  const session = {
    currentPage: vi.fn(async () => current),
    reLaunch: vi.fn(async () => page),
  }
  return {
    session,
    route,
    beforeNavigate: vi.fn(async () => {}),
    readiness: vi.fn(async (_session: typeof session, _page: { path?: string }, _timeoutMs: number) => {}),
    reconnect: vi.fn(async () => session),
    replaceSession: vi.fn(),
  }
}

describe('core HMR owned session navigation', () => {
  it('keeps current-route readiness and never navigates to satisfy a failed marker', async () => {
    const options = fixture()
    const failure = new Error('Timed out waiting storage field: expected=NEXT')
    options.readiness.mockRejectedValue(failure)
    await expect(enterCoreHmrRoute(options)).rejects.toBe(failure)
    expect(options.readiness.mock.calls[0]?.[2]).toBeGreaterThan(19_000)
    expect(options.session.reLaunch).not.toHaveBeenCalled()
    expect(options.reconnect).not.toHaveBeenCalled()
  })

  it('navigates once to another route and preserves the first navigation error', async () => {
    const options = fixture({ path: 'pages/other/index' })
    const failure = new Error('raw reLaunch timed out')
    options.session.reLaunch.mockRejectedValue(failure)
    await expect(enterCoreHmrRoute(options)).rejects.toBe(failure)
    expect(options.beforeNavigate).toHaveBeenCalledOnce()
    expect(options.session.reLaunch).toHaveBeenCalledExactlyOnceWith(route)
    expect(options.reconnect).not.toHaveBeenCalled()
  })

  it('reconnects an existing owner after a confirmed disconnect and never launches or navigates again', async () => {
    const options = fixture({ path: 'pages/other/index' })
    const next = fixture().session
    options.session.reLaunch.mockRejectedValue(closed)
    options.reconnect.mockResolvedValue(next)
    await expect(enterCoreHmrRoute(options)).resolves.toBe(page)
    expect(options.reconnect).toHaveBeenCalledExactlyOnceWith(options.session)
    expect(options.replaceSession).toHaveBeenCalledExactlyOnceWith(next)
    expect(options.session.reLaunch).toHaveBeenCalledOnce()
    expect(next.reLaunch).not.toHaveBeenCalled()
  })

  it('retains the original deadline when readiness reconnects and stops after a second disconnect', async () => {
    const options = fixture()
    const next = fixture().session
    options.reconnect.mockResolvedValue(next)
    options.readiness.mockRejectedValue(closed)
    await expect(enterCoreHmrRoute(options)).rejects.toBe(closed)
    expect(options.reconnect).toHaveBeenCalledOnce()
    expect(options.readiness).toHaveBeenCalledTimes(2)
    expect(options.readiness.mock.calls[1]?.[2]).toBeLessThanOrEqual(options.readiness.mock.calls[0]![2])
    expect(next.reLaunch).not.toHaveBeenCalled()
  })

  it('preserves the original owner and both errors when reconnect fails', async () => {
    const options = fixture()
    const reconnectFailure = new Error('listener identity changed')
    options.session.currentPage.mockRejectedValue(closed)
    options.reconnect.mockRejectedValue(reconnectFailure)
    const error = await enterCoreHmrRoute(options).catch(error => error)
    expect(error).toBeInstanceOf(AggregateError)
    expect(error.errors).toEqual([closed, reconnectFailure])
    expect(options.replaceSession).not.toHaveBeenCalled()
  })

  it('retains the concrete page type returned by the session', async () => {
    const options = fixture()
    const concretePage = { ...page, pageId: 1, $$: async () => [] as string[] }
    const session = {
      currentPage: async () => concretePage,
      reLaunch: async () => concretePage,
    }
    const result = enterCoreHmrRoute({ ...options, session, readiness: async () => {}, reconnect: undefined })
    expectTypeOf(result).toEqualTypeOf<Promise<typeof concretePage>>()
    expect(await result).toBe(concretePage)
  })
})

describe('headless template observation', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads the existing headless page template once without navigating or injecting state', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const wxml = vi.fn(async () => '<view>updated</view>')
    const currentPage = vi.fn(async () => ({ wxml }))
    await observeHeadlessCurrentTemplate({ currentPage })
    expect(currentPage).toHaveBeenCalledExactlyOnceWith({ appFunctionFallback: false })
    expect(wxml).toHaveBeenCalledOnce()
  })

  it('leaves real IDE template refresh observation to the existing runtime assertions', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'devtools')
    const currentPage = vi.fn(async () => null)
    await observeHeadlessCurrentTemplate({ currentPage })
    expect(currentPage).not.toHaveBeenCalled()
  })
})
