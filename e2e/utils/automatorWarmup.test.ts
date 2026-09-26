import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateExpectedErrors } from '../scripts/domAcceptanceReport/expectedErrors'
import { warmupMiniProgramRoute } from './automator'
import { appendIdeReportEvent } from './ideWarningReport'
import { createStartupProtocolDiagnostics } from './startupProtocolDiagnostics'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

describe('automator warmup readiness', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('lets a cold page finish before attempting a recovery navigation', async () => {
    vi.useFakeTimers()
    const startedAt = Date.now()
    const page = { path: 'pages/example/index', $$: vi.fn(async () => [{ id: 'real-page' }]) }
    const miniProgram = {
      currentPage: vi.fn(async () => Date.now() - startedAt >= 5_000 ? page : undefined),
      reLaunch: vi.fn(),
    }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture')

    await vi.advanceTimersByTimeAsync(6_000)
    await expect(warmup).resolves.toBeUndefined()
    expect(miniProgram.reLaunch).not.toHaveBeenCalled()
    expect(page.$$).toHaveBeenCalledWith('page')
  })

  it('recovers missing cold-start metadata through navigation in the same session after waiting', async () => {
    vi.useFakeTimers()
    const failure = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')
    const page = { path: 'pages/example/index', $$: vi.fn(async () => [{ id: 'real-page' }]) }
    const miniProgram = {
      close: vi.fn(),
      currentPage: vi.fn().mockRejectedValue(failure),
      reLaunch: vi.fn(async () => page),
    }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture')

    await vi.advanceTimersByTimeAsync(29_000)
    expect(miniProgram.reLaunch).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    await expect(warmup).resolves.toBeUndefined()
    expect(miniProgram.reLaunch).toHaveBeenCalledExactlyOnceWith('/pages/example/index')
    expect(page.$$).toHaveBeenCalledWith('page')
    expect(miniProgram.close).not.toHaveBeenCalled()
    expect(appendIdeReportEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      startupProtocol: expect.objectContaining({ state: 'recovered' }),
    }))
  })

  it.each([{ rootSelectors: [] }, { rootSelectors: ['.title'] }])('rejects a matching route without a rendered root (selectors=$rootSelectors)', async ({ rootSelectors }) => {
    vi.useFakeTimers()
    const page = {
      path: 'pages/example/index',
      $$: vi.fn(async () => []),
      $: vi.fn(async () => null),
      data: vi.fn(async () => ({ title: 'only data, no rendered root' })),
    }
    const miniProgram = { reLaunch: vi.fn(async () => page) }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture', { rootSelectors })
    const assertion = expect(warmup).rejects.toThrow('Timed out waiting page root after warmup reLaunch: /pages/example/index')

    await vi.runAllTimersAsync()
    await assertion
    expect(page.$$).toHaveBeenCalled()
    expect(page.data).not.toHaveBeenCalled()
    expect(miniProgram.reLaunch).toHaveBeenCalledOnce()
  })

  it('polls transient cold-start metadata without delegating retries beyond the probe deadline', async () => {
    vi.useFakeTimers()
    const page = { path: 'pages/example/index', $$: vi.fn(async () => [{ id: 'real-page' }]) }
    const failure = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')
    let probes = 0
    const miniProgram = {
      close: vi.fn(async () => {}),
      reLaunch: vi.fn(),
      currentPage: vi.fn(async (options: { retries?: number }) => {
        if (options.retries !== 1) {
          await new Promise(resolve => setTimeout(resolve, 5_000))
        }
        probes += 1
        if (probes <= 2) {
          throw failure
        }
        return page
      }),
    }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture', {
      allowRelaunch: false,
      rootSelectors: ['.title'],
    })
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(warmup).resolves.toBeUndefined()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([event]) => event.startupProtocol?.state)).toEqual(['retrying', 'retrying', 'recovered'])
    expect(miniProgram.currentPage).toHaveBeenCalledTimes(3)
    expect(miniProgram.currentPage).toHaveBeenCalledWith({
      appFunctionFallback: false,
      pageStackFallback: false,
      retries: 1,
      timeout: 2_000,
    })
    expect(page.$$).toHaveBeenCalledWith('.title')
    expect(miniProgram.close).not.toHaveBeenCalled()
    expect(miniProgram.reLaunch).not.toHaveBeenCalled()
  })

  it('still rejects and closes a session whose protocol never responds', async () => {
    vi.useFakeTimers()
    const miniProgram = {
      close: vi.fn(async () => {}),
      currentPage: vi.fn(async () => await new Promise(() => {})),
    }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture', { allowRelaunch: false })
    const assertion = expect(warmup).rejects.toThrow('Timeout in read current page for route /pages/example/index after 2000ms')
    await vi.advanceTimersByTimeAsync(2_000)
    await assertion
    expect(miniProgram.close).toHaveBeenCalledOnce()
    expect(appendIdeReportEvent).toHaveBeenLastCalledWith(expect.objectContaining({ level: 'error', startupProtocol: expect.objectContaining({ state: 'unresolved' }) }))
  })

  it.each([true, false])('retains startup evidence until launch retries finish (recovered=%s)', async (recovered) => {
    vi.useFakeTimers()
    const route = '/pages/example/index'
    const diagnostics = createStartupProtocolDiagnostics('fixture', route)
    const failedSession = {
      close: vi.fn(async () => {}),
      currentPage: vi.fn(async () => await new Promise(() => {})),
    }
    const options = { allowRelaunch: false, startupDiagnostics: diagnostics }
    const firstAttempt = warmupMiniProgramRoute(failedSession, route, 'fixture', options)
    const firstAssertion = expect(firstAttempt).rejects.toThrow('Timeout in read current page')
    await vi.advanceTimersByTimeAsync(2_000)
    await firstAssertion
    expect(failedSession.close).toHaveBeenCalledOnce()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([event]) => event.startupProtocol?.state)).toEqual(['retrying'])

    const page = { path: 'pages/example/index', $$: vi.fn(async () => [{ id: 'real-page' }]) }
    const nextSession = recovered ? { currentPage: vi.fn(async () => page) } : failedSession
    const nextAttempt = warmupMiniProgramRoute(nextSession, route, 'fixture', options)
    const nextAssertion = recovered
      ? expect(nextAttempt).resolves.toBeUndefined()
      : expect(nextAttempt).rejects.toThrow('Timeout in read current page')
    await vi.advanceTimersByTimeAsync(2_000)
    await nextAssertion
    diagnostics.finish(false)

    const events = vi.mocked(appendIdeReportEvent).mock.calls.map(([event]) => event)
    expect(events.map(event => event.startupProtocol?.state)).toEqual(recovered
      ? ['retrying', 'recovered']
      : ['retrying', 'retrying', 'unresolved'])
    expect(new Set(events.map(event => event.startupProtocol?.id)).size).toBe(1)
    const failures = evaluateExpectedErrors([], events.map(event => ({
      observedAt: new Date().toISOString(),
      caseId: null,
      phase: 'outside-case' as const,
      event: { ...event },
    })))
    expect(failures).toHaveLength(recovered ? 0 : 1)
    if (recovered) {
      expect(page.$$).toHaveBeenCalledWith('page')
    }
    else {
      expect(failures[0]).toContain('did not recover (2 failed attempts)')
    }
  })

  it('completes after the relaunched page exposes its rendered root', async () => {
    vi.useFakeTimers()
    const page = { path: 'pages/example/index', $$: vi.fn(async () => [{ id: 'real-page' }]) }
    const miniProgram = { reLaunch: vi.fn(async () => page) }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture')

    await vi.runAllTimersAsync()
    await expect(warmup).resolves.toBeUndefined()
    expect(page.$$).toHaveBeenCalledWith('page')
  })

  it('retries an opaque DevTools rejection but still requires a rendered warmup page', async () => {
    vi.useFakeTimers()
    const page = { path: 'pages/example/index', $$: vi.fn(async () => [{ id: 'real-page' }]) }
    const miniProgram = {
      reLaunch: vi.fn().mockRejectedValueOnce(new Error('Uncaught [object Object]')).mockResolvedValue(page),
    }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture', { rootSelectors: ['.title'] })
    await vi.runAllTimersAsync()
    await expect(warmup).resolves.toBeUndefined()
    expect(miniProgram.reLaunch).toHaveBeenCalledTimes(2)
    expect(page.$$).toHaveBeenCalledWith('.title')
  })

  it.each([true, false])('requires actual current-page rendering after a same-route stale handle (rendered=%s)', async (rendered) => {
    vi.useFakeTimers()
    const stalePage = { pageId: 1, path: 'pages/example/index', $$: vi.fn(async () => []) }
    const currentPage = {
      pageId: 2,
      path: 'pages/example/index',
      $$: vi.fn(async () => rendered ? [{ id: 'real-page' }] : []),
    }
    let relaunched = false
    const miniProgram = {
      reLaunch: vi.fn(async () => {
        relaunched = true
        return stalePage
      }),
      currentPage: vi.fn(async () => relaunched ? currentPage : { path: 'pages/other/index' }),
    }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture', { rootSelectors: ['.title'] })
    const assertion = rendered
      ? expect(warmup).resolves.toBeUndefined()
      : expect(warmup).rejects.toThrow('Timed out waiting page root after warmup reLaunch')

    await vi.runAllTimersAsync()
    await assertion
    expect(stalePage.$$).toHaveBeenCalledWith('.title')
    expect(currentPage.$$).toHaveBeenCalledWith('.title')
    expect(miniProgram.reLaunch).toHaveBeenCalledOnce()
  })

  it('does not accept bootstrap markup when an explicit real page selector is missing', async () => {
    vi.useFakeTimers()
    const page = {
      path: 'pages/example/index',
      $$: vi.fn(async () => []),
      waitForRendered: vi.fn(async ({ selector }: { selector?: string }) => {
        if (selector) {
          throw new Error('selector not found')
        }
        return '<view id="bootstrap">ready</view>'
      }),
    }
    const miniProgram = { reLaunch: vi.fn(async () => page) }
    const warmup = warmupMiniProgramRoute(miniProgram, '/pages/example/index', 'fixture', { rootSelectors: ['.title'] })
    const assertion = expect(warmup).rejects.toThrow('Timed out waiting page root after warmup reLaunch')

    await vi.runAllTimersAsync()
    await assertion
    expect(page.waitForRendered.mock.calls.every(([options]) => options.selector === '.title')).toBe(true)
  })
})
