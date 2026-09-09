import type { DomAcceptance, DomCheckpoint, DomPage, DomSession } from './types'
import { describe, expect, it, vi } from 'vitest'
import { assertDomAcceptanceComplete, captureDomCheckpoint, validateDomPlan } from './checkpoint'
import { createDomAcceptance } from './index'

const checkpoint: DomCheckpoint = {
  id: 'initial',
  route: '/pages/index/index',
  action: 'launch',
  nodes: [{ selector: '#message', text: 'ready' }],
}

let nextPageId = 0

function createPage(text = 'ready') {
  const page: DomPage = {
    pageId: ++nextPageId,
    path: 'pages/index/index',
    $$: vi.fn(async () => [{
      text: async () => text,
      attribute: async () => undefined,
      style: async (name: string) => name === 'opacity' ? '1' : name === 'visibility' ? 'visible' : 'block',
      size: async () => ({ width: 20, height: 10 }),
    }]),
  }
  const session: DomSession = { currentPage: vi.fn(async () => page) }
  return { page, session }
}

function createPlan(): DomAcceptance {
  return { fixture: 'e2e-apps/base', provider: 'devtools', checkpoints: [structuredClone(checkpoint)], evidence: [] }
}

describe('DOM acceptance evidence', () => {
  it.for([
    { name: 'weapp-vite-multi-platform-template-dom-acceptance-a' },
    { name: 'weapp-vite-multi-platform-template-dom-acceptance-b' },
  ])('registers $name with its Vitest parameter context', async ({ name }, context) => {
    const { page, session } = createPage()
    expect(context.task.name).toBe(`registers ${name} with its Vitest parameter context`)
    expect(context.task.meta.domAcceptance).toBeUndefined()
    const dom = createDomAcceptance(context, `templates/${name}`, [checkpoint])
    await dom.check('initial', session, page, 100)
    const plan = context.task.meta.domAcceptance!
    expect(plan.fixture).toBe(`templates/${name}`)
    expect(plan.evidence).toHaveLength(1)
    expect(plan.evidence[0]).toMatchObject({ id: 'initial', route: 'pages/index/index' })
    expect(() => assertDomAcceptanceComplete(plan)).not.toThrow()
    expect(() => createDomAcceptance(context, `templates/${name}`, [checkpoint])).toThrow('exactly once')
  })

  it('queries the actual frame and captures visible text', async () => {
    const { page, session } = createPage()
    const plan = createPlan()
    plan.evidence.push(await captureDomCheckpoint(session, page, checkpoint, 'devtools', 100))
    expect(page.$$).toHaveBeenCalledWith('#message', expect.objectContaining({ fallback: false }))
    expect(session.currentPage).toHaveBeenCalledWith({ appFunctionFallback: false })
    expect(plan.evidence[0]).toMatchObject({
      id: 'initial',
      route: 'pages/index/index',
      source: 'devtools-page-frame',
      nodes: [{ selector: '#message', query: 'css', count: 1, nodes: [{ text: 'ready' }] }],
    })
    expect(() => assertDomAcceptanceComplete(plan)).not.toThrow()
  })

  it('captures XPath text through the rendered-root query without using page CSS queries', async () => {
    const { page, session } = createPage()
    page.getElementsByXpath = vi.fn(async () => [{ text: async () => 'ready' }])
    const selector = '//*[@id="message"]'
    const evidence = await captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector, query: 'xpath', text: 'ready' }],
    }, 'devtools', 0)
    expect(page.getElementsByXpath).toHaveBeenCalledWith(selector, expect.objectContaining({ fallback: false }))
    expect(page.$$).not.toHaveBeenCalled()
    expect(evidence.nodes).toEqual([{ selector, query: 'xpath', count: 1, nodes: [{ text: 'ready' }] }])
  })

  it('rejects XPath absence when the provider does not expose XPath queries', async () => {
    const { page, session } = createPage()
    await expect(captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector: '//*[@id="removed"]', query: 'xpath', count: 0 }],
    }, 'devtools', 0)).rejects.toThrow('cannot query XPath')
    expect(page.$$).not.toHaveBeenCalled()
  })

  it('rejects stale rendered text even when the data source has updated', async () => {
    const { page, session } = createPage('old')
    Object.assign(page, { data: async () => ({ message: 'ready' }) })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('received "old"')
  })

  it.each(['css', 'xpath'] as const)('never treats a failed %s query as a successful absence assertion', async (query) => {
    const { page, session } = createPage()
    const failedQuery = async () => {
      throw new Error('protocol unavailable')
    }
    page.$$ = failedQuery
    page.getElementsByXpath = failedQuery
    await expect(captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector: query === 'css' ? '#removed' : '//*[@id="removed"]', query, count: 0 }],
    }, 'devtools', 0)).rejects.toThrow('protocol unavailable')
  })

  it.each(['css', 'xpath'] as const)('accepts absence only after a successful empty %s query', async (query) => {
    const { page, session } = createPage()
    page.$$ = async () => []
    page.getElementsByXpath = async () => []
    const evidence = await captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector: query === 'css' ? '#removed' : '//*[@id="removed"]', query, count: 0 }],
    }, 'devtools', 0)
    expect(evidence.nodes[0]).toMatchObject({ query, count: 0 })
  })

  it('rejects evidence when navigation changes during capture', async () => {
    const { page, session } = createPage()
    session.currentPage = vi.fn()
      .mockResolvedValueOnce(page)
      .mockResolvedValue({ ...page, path: 'pages/other/index' })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('DOM active route')
  })

  it('queries the replacement page after HMR invalidates the original handle', async () => {
    const { page, session } = createPage()
    const replacement = createPage().page
    page.$$ = vi.fn(async () => {
      throw new Error('page is not on top of page stack')
    })
    session.currentPage = vi.fn().mockResolvedValueOnce(page).mockResolvedValue(replacement)
    const evidence = await captureDomCheckpoint(session, page, checkpoint, 'devtools', 500)
    expect(page.$$).toHaveBeenCalledTimes(1)
    expect(replacement.$$).toHaveBeenCalledTimes(1)
    expect(evidence.nodes[0]?.nodes[0]?.text).toBe('ready')
  })

  it('never uses a stale handle when the current route has no query capability', async () => {
    const { page, session } = createPage()
    session.currentPage = vi.fn().mockResolvedValue({ path: page.path, pageId: page.pageId })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('cannot query the current rendered page')
    expect(page.$$).not.toHaveBeenCalled()
  })

  it('rejects old evidence when a replacement page has the same route', async () => {
    const { page, session } = createPage()
    const replacement = createPage('wrong replacement text').page
    session.currentPage = vi.fn().mockResolvedValueOnce(page).mockResolvedValue(replacement)
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('identity changed during capture')
  })

  it('retries on the replacement page instead of accepting matching text from the removed page', async () => {
    const { page, session } = createPage()
    const replacement = createPage('wrong replacement text').page
    session.currentPage = vi.fn().mockResolvedValueOnce(page).mockResolvedValue(replacement)
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 150)).rejects.toThrow('wrong replacement text')
    expect(replacement.$$).toHaveBeenCalled()
  })

  it('accepts matching replacement DOM only after querying that new page', async () => {
    const { page, session } = createPage()
    const replacement = createPage().page
    session.currentPage = vi.fn().mockResolvedValueOnce(page).mockResolvedValue(replacement)
    const evidence = await captureDomCheckpoint(session, page, checkpoint, 'devtools', 500)
    expect(page.$$).toHaveBeenCalledTimes(1)
    expect(replacement.$$).toHaveBeenCalledTimes(1)
    expect(evidence.nodes[0]?.nodes[0]?.text).toBe('ready')
  })

  it('accepts distinct handles for the same underlying page identity', async () => {
    const { page, session } = createPage()
    session.currentPage = vi.fn(async () => ({ ...page }))
    await expect(captureDomCheckpoint(session, page, checkpoint, 'headless', 0)).resolves.toMatchObject({ id: 'initial' })
  })

  it.each([undefined, null, Number.NaN, -1, '1'])('rejects missing or invalid provider identity %j', async (pageId) => {
    const { page, session } = createPage()
    session.currentPage = vi.fn(async () => ({ ...page, pageId }) as unknown as DomPage)
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('cannot identify')
    expect(page.$$).not.toHaveBeenCalled()
  })

  it('rejects the wrong page before querying any nodes', async () => {
    const { page, session } = createPage()
    page.path = 'pages/other/index'
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('DOM page route')
    expect(page.$$).not.toHaveBeenCalled()
  })

  it('rejects missing, duplicated, reordered and cross-provider evidence', async () => {
    expect(() => assertDomAcceptanceComplete(undefined)).toThrow('Missing DOM')
    const plan = createPlan()
    expect(() => assertDomAcceptanceComplete(plan)).toThrow('execution order')
    const { page, session } = createPage()
    plan.evidence = [await captureDomCheckpoint(session, page, checkpoint, 'headless', 0)]
    expect(() => assertDomAcceptanceComplete(plan)).toThrow('provider')
    plan.evidence[0]!.source = 'devtools-page-frame'
    plan.evidence.push(plan.evidence[0]!)
    expect(() => assertDomAcceptanceComplete(plan)).toThrow('execution order')
    plan.evidence[0]!.id = 'after-click'
    expect(() => assertDomAcceptanceComplete(plan)).toThrow('execution order')
  })

  it('requires behavioral evidence beyond a root or dataset marker', () => {
    const plan = createPlan()
    plan.checkpoints[0]!.nodes = [{ selector: '#root', visible: true, attributes: { 'data-ready': 'true' } }]
    expect(() => validateDomPlan(plan)).toThrow('only checks readiness')
  })

  it('checks responsive computed styles against the actual IDE window and rejects stale or synthetic sizes', async () => {
    const { page, session } = createPage()
    let fontSize = '12px'
    page.$$ = async () => [{ text: async () => 'ready', style: async () => fontSize }]
    session.systemInfo = async () => ({ windowWidth: 390 })
    const responsive: DomCheckpoint = { ...checkpoint, nodes: [{ selector: '#message', styles: { 'font-size': { rpx: 24 } } }] }
    const evidence = await captureDomCheckpoint(session, page, responsive, 'devtools', 0)
    expect(evidence.windowWidth).toBe(390)
    expect(evidence.nodes[0]?.nodes[0]?.styles).toEqual({ 'font-size': '12px' })
    fontSize = '14px'
    await expect(captureDomCheckpoint(session, page, responsive, 'devtools', 0)).rejects.toThrow('expected 24rpx')
    await expect(captureDomCheckpoint(session, page, responsive, 'headless', 0)).rejects.toThrow('real IDE window dimensions')
    session.systemInfo = async () => ({})
    await expect(captureDomCheckpoint(session, page, responsive, 'devtools', 0)).rejects.toThrow('Invalid responsive style evidence')
  })

  it('does not accept headless synthetic sizes as layout evidence', () => {
    const plan = createPlan()
    plan.provider = 'headless'
    plan.checkpoints[0]!.nodes[0]!.visible = true
    expect(() => validateDomPlan(plan)).toThrow('cannot provide layout')
  })

  it('captures rpx calculation evidence only from actual IDE window dimensions', async () => {
    const { page, session } = createPage()
    page.$$ = async () => [{ text: async () => 'ready', style: async () => '96px' }]
    session.systemInfo = async () => ({ windowWidth: 390 })
    const calculated: DomCheckpoint = { ...checkpoint, nodes: [{ selector: '#message', styles: { width: { rpxCalc: { value: 8, multiply: 24 } } } }] }
    const evidence = await captureDomCheckpoint(session, page, calculated, 'devtools', 0)
    expect(evidence.windowWidth).toBe(390)
    expect(evidence.nodes[0]?.nodes[0]?.styles).toEqual({ width: '96px' })
    await expect(captureDomCheckpoint(session, page, calculated, 'headless', 0)).rejects.toThrow('real IDE window dimensions')
    session.systemInfo = async () => ({})
    await expect(captureDomCheckpoint(session, page, calculated, 'devtools', 0)).rejects.toThrow('Invalid responsive calculation evidence')
  })

  it.each([{ scope: ['component'] }, { has: '.child' }])('rejects ambiguous CSS filters on XPath queries: %j', async (filter) => {
    const plan = createPlan()
    plan.checkpoints[0]!.nodes = [{ selector: '//*[@id="message"]', query: 'xpath', text: 'ready', ...filter }]
    expect(() => validateDomPlan(plan)).toThrow('must express scope and descendants')
    const { page, session } = createPage()
    await expect(captureDomCheckpoint(session, page, plan.checkpoints[0]!, 'devtools', 0)).rejects.toThrow('must express scope and descendants')
    expect(page.$$).not.toHaveBeenCalled()
  })

  it('selects a generic DevTools component by an actual descendant', async () => {
    const { page, session } = createPage()
    const children = await page.$$('#message', { fallback: false, timeout: 100 })
    const queryChildren = vi.fn(async () => children)
    page.$$ = vi.fn(async () => [{
      ...children[0]!,
      $$: queryChildren,
    }, {
      ...children[0]!,
      $$: async () => [],
    }])
    const evidence = await captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ ...checkpoint.nodes[0]!, scope: [{ has: '#message' }] }],
    }, 'devtools', 100)
    expect(evidence.nodes[0]?.nodes[0]?.text).toBe('ready')
    expect(queryChildren).toHaveBeenCalledTimes(2)
  })

  it('detects a hidden node even when it has nonzero dimensions', async () => {
    const { page, session } = createPage()
    const elements = await page.$$('#message', { fallback: false, timeout: 100 })
    elements[0]!.style = async name => name === 'opacity' ? '0' : 'block'
    page.$$ = async () => elements
    await expect(captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ ...checkpoint.nodes[0]!, visible: true }],
    }, 'devtools', 0)).rejects.toThrow('visible')
  })

  it('checks component absence by descendants and propagates child query failures', async () => {
    const { page, session } = createPage()
    page.$$ = async () => [{ text: async () => '', $$: async () => [] }]
    const removed = { ...checkpoint, nodes: [{ selector: 'component', has: '#layout', count: 0 }] }
    expect((await captureDomCheckpoint(session, page, removed, 'devtools', 0)).nodes[0]).toMatchObject({ has: '#layout', count: 0 })
    page.$$ = async () => [{
      text: async () => '',
      $$: async () => {
        throw new Error('component protocol failed')
      },
    }]
    await expect(captureDomCheckpoint(session, page, removed, 'devtools', 0)).rejects.toThrow('component protocol failed')
  })
})
