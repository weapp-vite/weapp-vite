import type { CoreHmrMarkers } from '../../ide/wevuRuntimeDom/coreHmr'
import { describe, expect, it } from 'vitest'
import { coreHmrPlan } from '../../ide/wevuRuntimeDom/coreHmr'
import { validateDomPlan } from './checkpoint'

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
    expect(headless.find(checkpoint => checkpoint.id === 'layout:style')?.nodes).toContainEqual({ selector: '#layout-current', text: 'current: admin' })
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
