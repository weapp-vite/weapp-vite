import type { DomAcceptance, DomCheckpoint, DomPage, DomSession } from './types'
import { describe, expect, it, vi } from 'vitest'
import { assertDomAcceptanceComplete, captureDomCheckpoint, validateDomPlan } from './checkpoint'

const checkpoint: DomCheckpoint = {
  id: 'initial',
  route: '/pages/index/index',
  action: 'launch',
  nodes: [{ selector: '#message', text: 'ready' }],
}

function createPage(text = 'ready') {
  const page: DomPage = {
    path: 'pages/index/index',
    $$: vi.fn(async () => [{
      text: async () => text,
      attribute: async () => undefined,
      style: async (name: string) => name === 'opacity' ? '1' : name === 'visibility' ? 'visible' : 'block',
      size: async () => ({ width: 20, height: 10 }),
    }]),
  }
  const session: DomSession = { currentPage: vi.fn(async () => ({ path: page.path })) }
  return { page, session }
}

function createPlan(): DomAcceptance {
  return { fixture: 'e2e-apps/base', provider: 'devtools', checkpoints: [structuredClone(checkpoint)], evidence: [] }
}

describe('DOM acceptance evidence', () => {
  it('queries the actual frame and captures visible text', async () => {
    const { page, session } = createPage()
    const plan = createPlan()
    plan.evidence.push(await captureDomCheckpoint(session, page, checkpoint, 'devtools', 100))
    expect(page.$$).toHaveBeenCalledWith('#message', expect.objectContaining({ fallback: false }))
    expect(plan.evidence[0]).toMatchObject({
      id: 'initial',
      route: 'pages/index/index',
      source: 'devtools-page-frame',
      nodes: [{ selector: '#message', count: 1, nodes: [{ text: 'ready' }] }],
    })
    expect(() => assertDomAcceptanceComplete(plan)).not.toThrow()
  })

  it('rejects stale rendered text even when the data source has updated', async () => {
    const { page, session } = createPage('old')
    Object.assign(page, { data: async () => ({ message: 'ready' }) })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('received "old"')
  })

  it('never treats a failed query as a successful absence assertion', async () => {
    const { page, session } = createPage()
    page.$$ = async () => {
      throw new Error('protocol unavailable')
    }
    await expect(captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector: '#removed', count: 0 }],
    }, 'devtools', 0)).rejects.toThrow('protocol unavailable')
  })

  it('accepts absence only after a successful empty query', async () => {
    const { page, session } = createPage()
    page.$$ = async () => []
    const evidence = await captureDomCheckpoint(session, page, {
      ...checkpoint,
      nodes: [{ selector: '#removed', count: 0 }],
    }, 'devtools', 0)
    expect(evidence.nodes[0]?.count).toBe(0)
  })

  it('rejects evidence when navigation changes during capture', async () => {
    const { page, session } = createPage()
    session.currentPage = vi.fn()
      .mockResolvedValueOnce({ path: page.path })
      .mockResolvedValue({ path: 'pages/other/index' })
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('DOM active route')
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

  it('does not accept headless synthetic sizes as layout evidence', () => {
    const plan = createPlan()
    plan.provider = 'headless'
    plan.checkpoints[0]!.nodes[0]!.visible = true
    expect(() => validateDomPlan(plan)).toThrow('cannot provide layout')
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
