import { describe, expect, it } from 'vitest'
import { formatTreemapNodeLabel, formatTreemapTooltip } from './treemap'
import { createTreemapNodeStyle } from './treemapRisk'

function convertHslColor(value: string) {
  const match = value.match(/^hsl\((\d+), (\d+)%, (\d+)%\)$/)
  if (!match) {
    throw new Error(`Unexpected HSL color: ${value}`)
  }
  const hue = Number(match[1])
  const saturation = Number(match[2]) / 100
  const lightness = Number(match[3]) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lightness - chroma / 2
  const [red, green, blue] = hue < 60
    ? [chroma, secondary, 0]
    : hue < 120
      ? [secondary, chroma, 0]
      : hue < 180
        ? [0, chroma, secondary]
        : hue < 240
          ? [0, secondary, chroma]
          : hue < 300
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  return [red + offset, green + offset, blue + offset]
}

function convertHexColor(value: string) {
  const color = Number.parseInt(value.slice(1), 16)
  return [
    ((color >> 16) & 255) / 255,
    ((color >> 8) & 255) / 255,
    (color & 255) / 255,
  ]
}

function getLuminance(channels: number[]) {
  const [red, green, blue] = channels.map(channel => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

function getContrastRatio(background: string, foreground: string) {
  const backgroundLuminance = getLuminance(convertHslColor(background))
  const foregroundLuminance = getLuminance(convertHexColor(foreground))
  return (Math.max(backgroundLuminance, foregroundLuminance) + 0.05)
    / (Math.min(backgroundLuminance, foregroundLuminance) + 0.05)
}

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
    const packageIds = [
      '__main__',
      'centerPages',
      'coursePages',
      'homePages',
      'improvePages',
      'managePages',
      'accountPages',
      'reportPages',
      'settingsPages',
      'sharedPages',
    ]
    const colorById = new Map(packageIds.map(id => [
      id,
      createTreemapNodeStyle(0.2, id, 'leaf').itemStyle.color,
    ]))
    const reorderedColorById = new Map([...packageIds].reverse().map(id => [
      id,
      createTreemapNodeStyle(0.2, id, 'leaf').itemStyle.color,
    ]))
    const healthy = createTreemapNodeStyle(0.2, '__main__', 'leaf')
    const risky = createTreemapNodeStyle(0.9, '__main__', 'leaf')
    const otherPackage = createTreemapNodeStyle(0.2, 'centerPages', 'leaf')
    const hiddenLabel = createTreemapNodeStyle(0.2, '__main__', 'leaf', false)
    const hiddenUpperLabel = createTreemapNodeStyle(0.2, '__main__', 'file', true, false)

    expect(new Set(colorById.values()).size).toBe(packageIds.length)
    for (const packageId of packageIds) {
      expect(reorderedColorById.get(packageId)).toBe(colorById.get(packageId))
    }
    for (const packageId of packageIds) {
      for (const depth of ['package', 'file', 'leaf'] as const) {
        const style = createTreemapNodeStyle(0.2, packageId, depth)
        expect(getContrastRatio(style.itemStyle.color, style.label.color)).toBeGreaterThanOrEqual(4.5)
        expect(style.upperLabel.backgroundColor).toBe(style.itemStyle.color)
      }
    }
    expect(healthy.itemStyle.color).toBe(risky.itemStyle.color)
    expect(healthy.itemStyle.borderColor).not.toBe(risky.itemStyle.borderColor)
    expect(healthy.itemStyle.color).not.toBe(otherPackage.itemStyle.color)
    expect(healthy.itemStyle.color).toMatch(/^hsl\(\d+, 42%, 46%\)$/)
    expect(hiddenLabel.label.show).toBe(false)
    expect(hiddenUpperLabel.upperLabel.show).toBe(false)
  })
})
