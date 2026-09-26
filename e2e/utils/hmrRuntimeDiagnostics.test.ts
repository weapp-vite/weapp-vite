import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHmrRuntimeDiagnostics } from './hmrRuntimeDiagnostics'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('HMR runtime diagnostics', () => {
  it('distinguishes native instance replacement from wrapper replacement without reporting control secrets', async () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    let nativePage: Record<string, unknown> = { route: 'pages/index/index' }
    let app: Record<string, unknown> = { __e2eHmrLaunch: 11 }
    vi.stubGlobal('getCurrentPages', () => [nativePage])
    vi.stubGlobal('getApp', () => app)
    vi.stubGlobal('__WEAPP_VITE_STATEFUL_HMR_CONTROL__', { token: 'private-token', url: 'private-url' })
    vi.stubGlobal('__WEAPP_VITE_STATEFUL_HMR_CLIENT__', {
      getVersion: () => 3,
      getTransportState: () => ({ phase: 'polling', lastResponse: { type: 'idle' } }),
    })
    const currentPage = vi.fn(async () => ({ pageId: 1 }))
    const diagnostics = createHmrRuntimeDiagnostics({
      currentPage,
      evaluate: async (callback, ...args) => callback(...args),
    }, 'fixture')
    await diagnostics.initialize()
    const retained = await diagnostics.capture('same-instance')
    expect(retained.runtime).toMatchObject({ appMarkerRetained: true, pageMarkerRetained: true, clientVersion: 3 })
    nativePage = { route: 'pages/index/index' }
    const replacedPage = await diagnostics.capture('page-replaced')
    expect(replacedPage.runtime).toMatchObject({ appMarkerRetained: true, pageMarkerRetained: false, appLaunchProbe: 11 })
    app = { __e2eHmrLaunch: 12 }
    const replacedApp = await diagnostics.capture('app-replaced')
    expect(replacedApp.runtime).toMatchObject({ appMarkerRetained: false, pageMarkerRetained: false, appLaunchProbe: 12 })
    expect(currentPage).toHaveBeenCalledWith({ appFunctionFallback: false })
    const report = JSON.stringify(vi.mocked(appendIdeReportEvent).mock.calls)
    expect(report).not.toContain('private-token')
    expect(report).not.toContain('private-url')
  })

  it('retains explicit query failure diagnostics without masking the original DOM failure', async () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const diagnostics = createHmrRuntimeDiagnostics({
      currentPage: async () => { throw new Error('private protocol request') },
      evaluate: async () => { throw new TypeError('private runtime request') },
    }, 'fixture')
    const snapshot = await diagnostics.capture('finally')
    expect(snapshot).toEqual({
      label: 'finally',
      pageId: null,
      runtime: null,
      errors: ['page identity: Error', 'runtime snapshot: TypeError'],
    })
  })
})
