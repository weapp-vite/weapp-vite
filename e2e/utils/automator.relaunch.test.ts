import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceMiniProgramRelaunch } from './automator'
import { DevtoolsSimulatorBootLogError } from './automatorBootLogMonitor'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

function createPage(route: string, renderedSelectors: string[]) {
  return {
    path: route,
    waitForRendered: vi.fn(async ({ selector }: { selector?: string }) => {
      if (selector && renderedSelectors.includes(selector)) {
        return { selector }
      }
      throw new Error('No rendered node matches the selector')
    }),
    $$: vi.fn(async (selector: string) => renderedSelectors.includes(selector) ? [{ selector }] : []),
  }
}

const homeRoute = 'pages/home/index'
const boundaryRoute = 'pages/boundary/index'
const recoveryOptions = {
  project: 'fixture',
  rootSelectors: ['#tag-page'],
  rootSelectorsRoute: homeRoute,
  retryDelayMs: 0,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY', '0')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('route-scoped relaunch roots', () => {
  it('reuses one session across pages without carrying the home root into the boundary page', async () => {
    const home = createPage(homeRoute, ['#tag-page', 'view'])
    const boundary = createPage(boundaryRoute, ['#boundary-page', 'view'])
    let currentPage = home
    const rawReLaunch = vi.fn(async (route: string) => {
      currentPage = route.includes(boundaryRoute) ? boundary : home
      return currentPage
    })
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => currentPage), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, { ...recoveryOptions, rootSelectorsRoute: `/${homeRoute}?initial=1` })

    for (const [route, page] of [
      [`/${homeRoute}?step=1`, home],
      [`/${boundaryRoute}?step=2`, boundary],
      [`${homeRoute}?step=3`, home],
    ] as const) {
      const assertion = expect(miniProgram.reLaunch(route)).resolves.toBe(page)
      await vi.runAllTimersAsync()
      await assertion
    }

    expect(rawReLaunch).toHaveBeenCalledTimes(3)
    expect(home.waitForRendered.mock.calls.map(([options]) => options.selector)).toEqual(['#tag-page', '#tag-page'])
    expect(boundary.waitForRendered.mock.calls.map(([options]) => options.selector)).toEqual(['view'])
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('uses generic roots when the current page already matches another route', async () => {
    const boundary = createPage(boundaryRoute, ['view'])
    const rawReLaunch = vi.fn(async () => boundary)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => boundary), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, recoveryOptions)

    const assertion = expect(miniProgram.reLaunch(`/${boundaryRoute}`)).resolves.toBe(boundary)
    await vi.runAllTimersAsync()
    await assertion

    expect(rawReLaunch).not.toHaveBeenCalled()
    expect(boundary.waitForRendered).toHaveBeenCalledWith(expect.objectContaining({ selector: 'view' }))
  })

  it('checks the current page with generic roots when reLaunch returns a stale page handle', async () => {
    const stale = createPage(boundaryRoute, [])
    const boundary = createPage(boundaryRoute, ['view'])
    const rawReLaunch = vi.fn(async () => stale)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => boundary), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, recoveryOptions)

    const assertion = expect(miniProgram.reLaunch(`/${boundaryRoute}?force=1`)).resolves.toBe(boundary)
    await vi.runAllTimersAsync()
    await assertion

    expect(stale.waitForRendered).toHaveBeenCalled()
    expect(boundary.waitForRendered).toHaveBeenCalledWith(expect.objectContaining({ selector: 'view' }))
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('uses generic roots when recovering another route after a transient protocol rejection', async () => {
    const boundary = createPage(boundaryRoute, ['view'])
    const rawReLaunch = vi.fn().mockRejectedValue(new Error('Uncaught [object Object]'))
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => boundary), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, recoveryOptions)

    const assertion = expect(miniProgram.reLaunch(`/${boundaryRoute}?force=1`)).resolves.toBe(boundary)
    await vi.runAllTimersAsync()
    await assertion

    expect(rawReLaunch).toHaveBeenCalledTimes(1)
    expect(boundary.waitForRendered).toHaveBeenCalledWith(expect.objectContaining({ selector: 'view' }))
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('does not recover a fatal boot diagnostic as a transient metadata failure', async () => {
    const boundary = createPage(boundaryRoute, ['view'])
    const rawReLaunch = vi.fn(async () => boundary)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => boundary), close: vi.fn() }
    const error = new DevtoolsSimulatorBootLogError('reLaunch', {
      file: 'startup.log',
      line: '[ERROR][win:s0] simulator launch catch error TypeError: getPageMetaByWebviewId is unavailable',
      state: 'fatal',
      windowId: 's0',
    })
    enhanceMiniProgramRelaunch(miniProgram, {
      ...recoveryOptions,
      checkDevtoolsLog: () => {
        throw error
      },
    })

    await expect(miniProgram.reLaunch(`/${boundaryRoute}?force=1`)).rejects.toBe(error)
    expect(rawReLaunch).not.toHaveBeenCalled()
    expect(miniProgram.currentPage).not.toHaveBeenCalled()
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it.each([
    { route: homeRoute, renderedSelectors: ['view'], requiredSelector: '#tag-page' },
    { route: boundaryRoute, renderedSelectors: [], requiredSelector: 'view' },
  ])('still rejects $route when its required rendered root is absent', async ({ route, renderedSelectors, requiredSelector }) => {
    const page = createPage(route, renderedSelectors)
    const rawReLaunch = vi.fn(async () => page)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, recoveryOptions)

    const assertion = expect(miniProgram.reLaunch(`/${route}?force=1`)).rejects.toThrow('Timed out waiting page root after reLaunch')
    await vi.runAllTimersAsync()
    await assertion

    expect(page.waitForRendered).toHaveBeenCalledWith(expect.objectContaining({ selector: requiredSelector }))
    expect(miniProgram.close).toHaveBeenCalledTimes(1)
  })
})
