import { describe, expect, it } from 'vitest'
import { normalizeAutomatorWxml } from '../wevu-runtime.utils'

describe('normalizeAutomatorWxml', () => {
  it('normalizes native map placeholder text across DevTools versions', () => {
    const legacy = '<map id="map">©2024 Tencent - GS粤(2024)1234号地图<view>slot</view></map>'
    const localized = '<map id="map">地图<view>slot</view></map>'
    const expected = '<map id="map">©TENCENT-MAP-LICENSE<view>slot</view></map>'

    expect(normalizeAutomatorWxml(legacy)).toBe(expected)
    expect(normalizeAutomatorWxml(localized)).toBe(expected)
  })

  it('normalizes class and style attribute order across DevTools versions', () => {
    const current = '<view class="base active" id="target" style="color:red;">target</view>'
    const shifted = '<view id="target" style="color:red;" class="base active">target</view>'
    const expected = '<view class="base active" id="target" style="color:red;">target</view>'

    expect(normalizeAutomatorWxml(current)).toBe(expected)
    expect(normalizeAutomatorWxml(shifted)).toBe(expected)
    expect(normalizeAutomatorWxml(expected)).toBe(expected)
  })
})
