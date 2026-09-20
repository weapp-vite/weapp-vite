import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appendIdeReportEvent } from './ideWarningReport'
import { resolveRuntimeProviderName } from './runtimeProvider'
import { createWevuTailwindHmrFileDiagnostics } from './wevuTailwindHmrDiagnostics'

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockRejectedValue(Object.assign(new Error('Missing diagnostic file'), { code: 'ENOENT' })),
    lstat: vi.fn().mockRejectedValue(Object.assign(new Error('Missing diagnostic file'), { code: 'ENOENT' })),
  },
}))
vi.mock('./ideWarningReport', () => ({
  appendIdeReportEvent: vi.fn(),
  resolveReportProjectPath: (file: string) => path.relative(process.cwd(), file).replaceAll('\\', '/'),
}))
vi.mock('./runtimeProvider', () => ({ resolveRuntimeProviderName: vi.fn(() => 'devtools') }))

const route = 'pages/index/index'

function harness() {
  const element = {
    outerWxml: vi.fn().mockResolvedValue('<view id="wevu-tailwind-hmr-probe" class="bg-_b_hfef3c7_B"/>'),
    attribute: vi.fn().mockResolvedValue('bg-_b_hfef3c7_B'),
    style: vi.fn().mockResolvedValue('rgba(0, 0, 0, 0)'),
  }
  const page = { pageId: 7, path: route, $$: vi.fn().mockResolvedValue([element]) }
  const session = {
    currentPage: vi.fn().mockResolvedValue(page),
    reLaunch: vi.fn(),
    evaluate: vi.fn(),
    close: vi.fn(),
  }
  async function capture() {
    await createWevuTailwindHmrFileDiagnostics(session, path.resolve('e2e-apps/diagnostic-fixture'), `/${route}`).capture('background:4')
    const event = vi.mocked(appendIdeReportEvent).mock.calls.at(-1)![0]
    return JSON.parse((event as { text: string }).text) as { pageFrame: Record<string, any> }
  }
  return { element, page, session, capture }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveRuntimeProviderName).mockReturnValue('devtools')
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(() => vi.restoreAllMocks())

describe('Wevu Tailwind real page frame diagnostics', () => {
  it('records the real class and transparent computed style without navigation or fallback', async () => {
    const h = harness()
    const { pageFrame } = await h.capture()
    expect(h.session.currentPage).toHaveBeenCalledWith({ retries: 1, timeout: 5_000, pageStackFallback: false, appFunctionFallback: false })
    expect(h.page.$$).toHaveBeenCalledWith('#wevu-tailwind-hmr-probe', { fallback: false, timeout: 5_000 })
    expect(h.element.attribute).toHaveBeenCalledWith('class')
    expect(h.element.style).toHaveBeenCalledWith('background-color')
    expect(pageFrame).toMatchObject({
      source: 'devtools-page-frame',
      status: 'captured',
      pageId: 7,
      route,
      routeMatches: true,
      count: 1,
      nodes: [{ outerWxml: '<view id="wevu-tailwind-hmr-probe" class="bg-_b_hfef3c7_B"/>', class: 'bg-_b_hfef3c7_B', backgroundColor: 'rgba(0, 0, 0, 0)', errors: [] }],
    })
    expect(h.session.reLaunch).not.toHaveBeenCalled()
    expect(h.session.evaluate).not.toHaveBeenCalled()
    expect(h.session.close).not.toHaveBeenCalled()
  })

  it('records absence only after a successful empty page query', async () => {
    const h = harness()
    h.page.$$.mockResolvedValue([])
    expect((await h.capture()).pageFrame).toMatchObject({ status: 'absent', count: 0, nodes: [] })
  })

  it.each(['current-page', 'query'] as const)('keeps %s protocol errors distinct from absent nodes and redacts paths', async (phase) => {
    const h = harness()
    const error = Object.assign(new Error(`Cannot query ${path.resolve('e2e-apps/diagnostic-fixture')}`), { code: 'DEVTOOLS_PROTOCOL_TIMEOUT', method: 'Page.getElements' })
    if (phase === 'current-page') {
      h.session.currentPage.mockRejectedValue(error)
    }
    else {
      h.page.$$.mockRejectedValue(error)
    }
    const { pageFrame } = await h.capture()
    expect(pageFrame).toMatchObject({ status: 'error', phase, error: { code: 'DEVTOOLS_PROTOCOL_TIMEOUT', method: 'Page.getElements' } })
    expect(pageFrame).not.toHaveProperty('count')
    expect(pageFrame).not.toHaveProperty('nodes')
    expect(JSON.stringify(pageFrame)).not.toContain(process.cwd())
  })

  it('preserves successful class/WXML reads when a computed-style protocol call throws synchronously', async () => {
    const h = harness()
    h.element.style.mockImplementation(() => {
      throw new TypeError('Style query unavailable')
    })
    const { pageFrame } = await h.capture()
    expect(pageFrame).toMatchObject({ status: 'error', count: 1, nodes: [{ class: 'bg-_b_hfef3c7_B', errors: [{ field: 'backgroundColor', error: { name: 'TypeError', message: 'Style query unavailable' } }] }] })
    expect(pageFrame.nodes[0]).toHaveProperty('outerWxml')
    expect(pageFrame.nodes[0]).not.toHaveProperty('backgroundColor')
  })

  it('preserves an opaque query rejection as an error without inventing empty results', async () => {
    const h = harness()
    h.page.$$.mockRejectedValue({})
    const { pageFrame } = await h.capture()
    expect(pageFrame).toMatchObject({ status: 'error', phase: 'query', error: { name: 'object' } })
    expect(pageFrame).not.toHaveProperty('count')
    expect(pageFrame).not.toHaveProperty('nodes')
  })

  it('reports an unavailable current page and a mismatched route without relaunching', async () => {
    const h = harness()
    h.session.currentPage.mockResolvedValueOnce(null)
    expect((await h.capture()).pageFrame).toMatchObject({ status: 'unavailable', reason: 'current page is unavailable' })
    expect(h.page.$$).not.toHaveBeenCalled()
    h.page.path = 'pages/other/index'
    expect((await h.capture()).pageFrame).toMatchObject({ route: 'pages/other/index', routeMatches: false })
    expect(h.session.reLaunch).not.toHaveBeenCalled()
  })

  it('does not label headless simulated styles as real page-frame observations', async () => {
    const h = harness()
    vi.mocked(resolveRuntimeProviderName).mockReturnValue('headless')
    expect((await h.capture()).pageFrame).toMatchObject({ status: 'unavailable', reason: 'provider is not devtools' })
    expect(h.session.currentPage).not.toHaveBeenCalled()
  })
})
