import { describe, expect, it } from 'vitest'
import { formatTreemapNodeLabel, formatTreemapTooltip } from './treemap'
import { createTreemapNodeStyle } from './treemapRisk'

describe('treemap presentation', () => {
  it('uses compact labels while preserving package context', () => {
    expect(formatTreemapNodeLabel(
      '../../node_modules/.pnpm/moment@2.30.1/node_modules/moment/moment.js',
    )).toBe('moment')
    expect(formatTreemapNodeLabel('components/ui/VSelect.vue')).toBe('ui/VSelect.vue')
    expect(formatTreemapNodeLabel('centerPages/smartConfig/index.js')).toBe('smartConfig/index.js')
  })

  it('keeps full escaped paths in tooltips', () => {
    const tooltip = formatTreemapTooltip({
      kind: 'module',
      nodeId: 'module',
      packageId: '__main__',
      packageLabel: '主包',
      fileName: 'app.js',
      source: 'components/<unsafe>/VSelect.vue',
      sourceType: '<img src=x onerror=alert(1)>' as 'src',
      bytes: 1024,
      packageCount: 1,
    })

    expect(tooltip).toContain('<strong>&lt;unsafe&gt;/VSelect.vue</strong>')
    expect(tooltip).toContain('完整路径')
    expect(tooltip).toContain('components/&lt;unsafe&gt;/VSelect.vue')
    expect(tooltip).not.toContain('<unsafe>')
    expect(tooltip).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('uses group color for fill and risk only for the border', () => {
    const healthy = createTreemapNodeStyle(0.2, 'dark', 0, 'leaf')
    const risky = createTreemapNodeStyle(0.9, 'dark', 0, 'leaf')
    const otherPackage = createTreemapNodeStyle(0.2, 'dark', 1, 'leaf')
    const hiddenLabel = createTreemapNodeStyle(0.2, 'dark', 0, 'leaf', false)
    const groupColors = Array.from({ length: 6 }, (_, index) =>
      createTreemapNodeStyle(0.2, 'dark', index, 'leaf').itemStyle.color)

    const hiddenUpperLabel = createTreemapNodeStyle(0.2, 'dark', 0, 'file', true, false)

    expect(healthy.itemStyle.color).toBe(risky.itemStyle.color)
    expect(healthy.itemStyle.borderColor).not.toBe(risky.itemStyle.borderColor)
    expect(healthy.itemStyle.color).not.toBe(otherPackage.itemStyle.color)
    expect(new Set(groupColors).size).toBe(6)
    expect(healthy.itemStyle.color).toMatch(/^hsl\(\d+, 40%, 31%\)$/)
    expect(hiddenLabel.label.show).toBe(false)
    expect(hiddenUpperLabel.upperLabel.show).toBe(false)
  })
})
