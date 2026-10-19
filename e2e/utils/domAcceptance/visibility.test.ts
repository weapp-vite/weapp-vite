import type { DomElement, DomPage, DomSession } from './types'
import { describe, expect, it } from 'vitest'
import { captureDomCheckpoint } from './checkpoint'
import { readDomVisibility } from './visibility'

const visibleStyles = { display: 'block', visibility: 'visible', opacity: '1' }
const unavailableStyles = { display: null, visibility: null, opacity: null }

function createPage(element: DomElement) {
  const page: DomPage = { pageId: 1, path: 'pages/index/index', $$: async () => [element] }
  const session: DomSession = { currentPage: async () => page }
  return { page, session }
}

describe('DOM visibility evidence', () => {
  it.each([
    { width: 0, height: 0 },
    { width: 0, height: 10 },
    { width: 20, height: 0 },
  ])('uses measured zero area without inventing computed styles: %j', (size) => {
    const evidence = { size, styles: { ...unavailableStyles } }
    expect(readDomVisibility(evidence, 'unprojected')).toBe(false)
    expect(evidence).toEqual({ size, styles: unavailableStyles })
  })

  it.each(['display', 'visibility', 'opacity'])('rejects unknown %s for nonzero area', (key) => {
    const evidence = { size: { width: 20, height: 10 }, styles: { ...visibleStyles, [key]: null } }
    expect(() => readDomVisibility(evidence, 'projected')).toThrow('missing computed visibility')
  })

  it.each([
    { display: '' },
    { display: ' ' },
    { visibility: '' },
    { visibility: '\t' },
    { opacity: '' },
    { opacity: ' \n' },
    { opacity: '-0.1' },
    { opacity: '1.1' },
    { opacity: 'NaN' },
    { opacity: 'Infinity' },
  ])('rejects invalid known styles even for zero area: %j', (styles) => {
    expect(() => readDomVisibility({ size: { width: 0, height: 0 }, styles: { ...visibleStyles, ...styles } }, 'unprojected'))
      .toThrow('invalid computed visibility')
  })

  it.each(['display', 'visibility', 'opacity'])('requires an explicit observation for %s even for zero area', (key) => {
    const styles: Record<string, string | null> = { ...unavailableStyles }
    delete styles[key]
    expect(() => readDomVisibility({ size: { width: 0, height: 0 }, styles }, 'unprojected'))
      .toThrow('missing computed visibility')
  })

  it.each(['display', 'visibility', 'opacity'])('does not use inherited %s as observed evidence', (key) => {
    const styles: Record<string, string | null> = { ...unavailableStyles }
    delete styles[key]
    Object.setPrototypeOf(styles, { [key]: null })
    expect(() => readDomVisibility({ size: { width: 0, height: 0 }, styles }, 'unprojected'))
      .toThrow('missing computed visibility')
  })

  it.each([
    undefined,
    { width: -1, height: 0 },
    { width: 0, height: -1 },
    { width: Number.NaN, height: 0 },
    { width: 0, height: Number.POSITIVE_INFINITY },
  ])('rejects missing or invalid dimensions: %j', (size) => {
    expect(() => readDomVisibility({ size, styles: unavailableStyles }, 'unprojected')).toThrow('invalid layout')
  })

  it.each(['1', '0.5', '.5', '1e-1', ' 0.5 '])('preserves the existing numeric opacity contract: %s', (opacity) => {
    expect(readDomVisibility({ size: { width: 20, height: 10 }, styles: { ...visibleStyles, opacity } }, 'projected')).toBe(true)
  })

  it.each([
    { display: 'none' },
    { visibility: 'hidden' },
    { visibility: 'collapse' },
    { opacity: '0' },
  ])('retains computed invisibility for nonzero area: %j', (styles) => {
    expect(readDomVisibility({ size: { width: 20, height: 10 }, styles: { ...visibleStyles, ...styles } }, 'hidden')).toBe(false)
  })

  it('captures raw null styles for a measured unprojected node and still rejects visible expectations', async () => {
    const { page, session } = createPage({ text: async () => 'ready', size: async () => ({ width: 0, height: 0 }), style: async () => null })
    const checkpoint = { id: 'closed', route: '/pages/index/index', action: 'close slot', nodes: [{ selector: '#message', text: 'ready', visible: false }] }
    const evidence = await captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)
    expect(evidence.nodes[0]!.nodes[0]).toEqual({ text: 'ready', size: { width: 0, height: 0 }, styles: unavailableStyles })
    checkpoint.nodes[0]!.visible = true
    await expect(captureDomCheckpoint(session, page, checkpoint, 'devtools', 0)).rejects.toThrow('visible: expected true, received false')
  })

  it.each([true, false])('does not capture unknown visibility with positive area when expected=%s', async (visible) => {
    const { page, session } = createPage({ text: async () => 'ready', size: async () => ({ width: 20, height: 10 }), style: async () => null })
    await expect(captureDomCheckpoint(session, page, {
      id: 'projected',
      route: '/pages/index/index',
      action: 'open slot',
      nodes: [{ selector: '#message', text: 'ready', visible }],
    }, 'devtools', 0)).rejects.toThrow('missing computed visibility')
  })

  it.each([{ display: ' ' }, { visibility: '\t' }, { opacity: ' \n' }])('rejects whitespace-only captured styles even for zero area: %j', async (styles) => {
    const computed: Record<string, string> = { ...visibleStyles, ...styles }
    const { page, session } = createPage({ text: async () => 'ready', size: async () => ({ width: 0, height: 0 }), style: async name => computed[name]! })
    await expect(captureDomCheckpoint(session, page, {
      id: 'closed',
      route: '/pages/index/index',
      action: 'close slot',
      nodes: [{ selector: '#message', text: 'ready', visible: false }],
    }, 'devtools', 0)).rejects.toThrow('invalid computed visibility')
  })

  it('preserves valid captured opacity with surrounding whitespace', async () => {
    const computed: Record<string, string> = { ...visibleStyles, opacity: ' 0.5 ' }
    const { page, session } = createPage({ text: async () => 'ready', size: async () => ({ width: 20, height: 10 }), style: async name => computed[name]! })
    const evidence = await captureDomCheckpoint(session, page, {
      id: 'opened',
      route: '/pages/index/index',
      action: 'open slot',
      nodes: [{ selector: '#message', text: 'ready', visible: true }],
    }, 'devtools', 0)
    expect(evidence.nodes[0]!.nodes[0]!.styles!.opacity).toBe(' 0.5 ')
  })

  it.each(['block', { rpx: 24 }, { rpxCalc: { value: 8, multiply: 24 } }])('does not replace explicit style evidence with null: %j', async (display) => {
    const { page, session } = createPage({ text: async () => 'ready', size: async () => ({ width: 0, height: 0 }), style: async () => null })
    session.systemInfo = async () => ({ windowWidth: 390 })
    await expect(captureDomCheckpoint(session, page, {
      id: 'closed',
      route: '/pages/index/index',
      action: 'close slot',
      nodes: [{ selector: '#message', text: 'ready', styles: { display }, visible: false }],
    }, 'devtools', 0)).rejects.toThrow(/style|evidence/)
  })
})
