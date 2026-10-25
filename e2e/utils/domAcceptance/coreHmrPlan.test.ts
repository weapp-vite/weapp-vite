import type { CoreHmrMarkers } from '../../ide/wevuRuntimeDom/coreHmr'
import type { DomPage } from './types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClassicReloadObserver } from '../../ide/wevuRuntimeDom/classicReload'
import { coreHmrPlan } from '../../ide/wevuRuntimeDom/coreHmr'
import { validateDomPlan } from './checkpoint'

const diagnosticsMocks = vi.hoisted(() => ({
  create: vi.fn(),
  initialize: vi.fn(),
  capture: vi.fn(),
  waitForReload: vi.fn(),
}))

vi.mock('../hmrRuntimeDiagnostics', () => ({
  createHmrRuntimeDiagnostics: diagnosticsMocks.create,
}))
vi.mock('../../ide/wevuRuntimeDom/classicWxs', () => ({
  waitForClassicWxsReload: diagnosticsMocks.waitForReload,
}))

const markers: CoreHmrMarkers = {
  pageTemplateMarker: 'page-template',
  pageScriptMarker: 'page-script',
  pageStyleMarker: 'page-style',
  sfcTemplateMarker: 'sfc-template',
  sfcScriptMarker: 'sfc-script',
  sfcStyleMarker: 'sfc-style',
  layoutPageTemplateMarker: 'layout-template',
  layoutPageScriptMarker: 'layout-script',
  layoutPageStyleMarker: 'layout-style',
  sharedStoreMarker: 'shared-store',
}

describe('core HMR DOM provider plans', () => {
  it('keeps all checkpoints and rendered behavior in the headless plan', () => {
    const headless = coreHmrPlan(markers, 'headless')
    const devtools = coreHmrPlan(markers, 'devtools')
    expect(headless.map(checkpoint => checkpoint.id)).toEqual(devtools.map(checkpoint => checkpoint.id))
    expect(() => validateDomPlan({ fixture: 'e2e-apps/wevu-runtime-e2e', provider: 'headless', checkpoints: headless, evidence: [] })).not.toThrow()
    for (const checkpoint of headless) {
      expect(checkpoint.nodes.some(node => node.text !== undefined || node.count !== undefined)).toBe(true)
      expect(checkpoint.nodes.every(node => node.styles === undefined && node.visible === undefined)).toBe(true)
    }
    expect(headless.find(checkpoint => checkpoint.id === 'layout:style')?.nodes).toContainEqual({ selector: '#layout-current', text: 'current: default' })
  })

  it('freezes classic reset state while retaining all eighteen functional checkpoints', () => {
    for (const provider of ['headless', 'devtools'] as const) {
      const checkpoints = coreHmrPlan(markers, provider)
      expect(checkpoints).toHaveLength(18)
      expect(checkpoints.find(checkpoint => checkpoint.id === 'page:interacted')?.nodes).toContainEqual({ selector: '#hmr-count', text: 'count: 1' })
      for (const id of ['page:template', 'page:script', 'page:style']) {
        expect(checkpoints.find(checkpoint => checkpoint.id === id)?.nodes).toContainEqual({ selector: '#hmr-count', text: 'count: 0' })
      }
      for (const id of ['layout:template', 'layout:script', 'layout:style']) {
        expect(checkpoints.find(checkpoint => checkpoint.id === id)?.nodes).toContainEqual({ selector: '#layout-current', text: 'current: default' })
      }
    }
  })

  it('retains the real IDE computed colors and visibility checks', () => {
    const checkpoints = coreHmrPlan(markers, 'devtools')
    const expected = [
      ['page:style', '.page', { 'background-color': 'rgb(220, 252, 231)' }],
      ['sfc:style', '.marker', { color: 'rgb(190, 18, 60)' }],
      ['layout:style', '.page', { 'background-color': 'rgb(224, 242, 254)' }],
    ] as const
    for (const [id, selector, styles] of expected) {
      expect(checkpoints.find(checkpoint => checkpoint.id === id)?.nodes).toContainEqual({ selector, styles, visible: true })
    }
    expect(() => validateDomPlan({ fixture: 'e2e-apps/wevu-runtime-e2e', provider: 'devtools', checkpoints, evidence: [] })).not.toThrow()
  })
})

function createClassicReloadFixture() {
  const trace: string[] = []
  const startupPage: DomPage = {
    pageId: 1,
    path: 'pages/reactivity/index',
    $$: async () => [],
  }
  const oldSession = {
    tag: 'old',
    currentPage: vi.fn(async () => startupPage),
    evaluate: vi.fn(async () => undefined),
  }
  const newSession = { ...oldSession, tag: 'new' }
  let activeSession = oldSession
  const assertClassic = vi.fn(async (session: typeof oldSession) => {
    trace.push(`classic:${session.tag}`)
  })
  const reopenHeadless = vi.fn(async () => {
    trace.push('reopen')
    activeSession = newSession
  })
  diagnosticsMocks.create.mockReturnValue({
    initialize: diagnosticsMocks.initialize,
    capture: diagnosticsMocks.capture,
  })
  diagnosticsMocks.initialize.mockImplementation(async () => {
    trace.push('initialize')
    return {
      errors: [],
      runtime: {
        pageMarkerRetained: true,
        appMarkerRetained: true,
        clientPresent: false,
        bridgeReady: false,
        controlPresent: false,
      },
    }
  })
  diagnosticsMocks.capture.mockImplementation(async (label: string) => {
    trace.push(`capture:${label}`)
    return {
      errors: [],
      runtime: {
        route: 'pages/reactivity/index',
        pageMarkerRetained: false,
        appMarkerRetained: false,
        clientPresent: false,
        bridgeReady: false,
        controlPresent: false,
      },
    }
  })
  diagnosticsMocks.waitForReload.mockImplementation(async (session: typeof oldSession) => {
    trace.push(`wait:${session.tag}`)
    return startupPage
  })
  const observer = createClassicReloadObserver({
    getSession: () => activeSession,
    reopenHeadless,
    assertClassic,
    project: 'e2e-apps/fixture',
  })
  return { observer, trace, oldSession, newSession, startupPage, reopenHeadless, assertClassic }
}

describe('classic reload observer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'devtools')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defers IDE reload observation until confirmation and keeps the existing session', async () => {
    const fixture = createClassicReloadFixture()
    const confirm = await fixture.observer.prepare('template-change')
    expect(fixture.trace).toEqual(['initialize', 'classic:old'])
    expect(diagnosticsMocks.capture).not.toHaveBeenCalled()
    expect(fixture.reopenHeadless).not.toHaveBeenCalled()

    await expect(confirm()).resolves.toBe(fixture.startupPage)
    expect(diagnosticsMocks.create).toHaveBeenCalledWith(fixture.oldSession, 'e2e-apps/fixture')
    expect(fixture.trace).toEqual([
      'initialize',
      'classic:old',
      'capture:template-change',
      'wait:old',
      'classic:old',
    ])
    expect(fixture.reopenHeadless).not.toHaveBeenCalled()
  })

  it('uses the new headless handle after exactly one companion cold launch', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const fixture = createClassicReloadFixture()
    const confirm = await fixture.observer.prepare('template-change')
    expect(fixture.reopenHeadless).not.toHaveBeenCalled()

    await expect(confirm()).resolves.toBe(fixture.startupPage)
    expect(fixture.reopenHeadless).toHaveBeenCalledOnce()
    expect(diagnosticsMocks.capture).not.toHaveBeenCalled()
    expect(diagnosticsMocks.waitForReload).toHaveBeenCalledWith(fixture.newSession)
    expect(fixture.assertClassic).toHaveBeenLastCalledWith(fixture.newSession)
    expect(fixture.trace).toEqual([
      'initialize',
      'classic:old',
      'reopen',
      'wait:new',
      'classic:new',
    ])
  })

  it('rejects incomplete initial diagnostics before attempting a reload', async () => {
    const fixture = createClassicReloadFixture()
    diagnosticsMocks.initialize.mockResolvedValue({ errors: ['runtime snapshot: Error'], runtime: null })
    await expect(fixture.observer.prepare('template-change')).rejects.toThrow()
    expect(fixture.assertClassic).not.toHaveBeenCalled()
    expect(fixture.reopenHeadless).not.toHaveBeenCalled()
    expect(diagnosticsMocks.capture).not.toHaveBeenCalled()
    expect(diagnosticsMocks.waitForReload).not.toHaveBeenCalled()
  })

  it('preserves publication assertion errors without reopening the headless session', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const fixture = createClassicReloadFixture()
    const failure = new Error('classic publication is incomplete')
    fixture.assertClassic.mockRejectedValue(failure)
    await expect(fixture.observer.prepare('template-change')).rejects.toBe(failure)
    expect(fixture.reopenHeadless).not.toHaveBeenCalled()
    expect(diagnosticsMocks.capture).not.toHaveBeenCalled()
    expect(diagnosticsMocks.waitForReload).not.toHaveBeenCalled()
  })
})
