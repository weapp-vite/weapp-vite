import { describe, expect, it } from 'vitest'
import { resolveTouchAppWxssEnabled } from '../buildPlugin/touchAppWxss'

describe('resolveTouchAppWxssEnabled', () => {
  const base = {
    option: 'auto' as const,
    platform: 'weapp' as const,
  }

  it('honors explicit true even for managed integration and other platforms', () => {
    expect(resolveTouchAppWxssEnabled({
      ...base,
      option: true,
      platform: 'alipay',
      managedTailwindcss: true,
    })).toBe(true)
  })

  it('honors explicit false for actual Tailwind invalidation', () => {
    expect(resolveTouchAppWxssEnabled({
      ...base,
      option: false,
      dirtyReasonSummary: ['tailwind-content:2'],
    })).toBe(false)
  })

  it('disables auto on non-weapp platforms', () => {
    expect(resolveTouchAppWxssEnabled({
      ...base,
      platform: 'alipay',
      dirtyReasonSummary: ['tailwind-content:2'],
    })).toBe(false)
  })

  it.each([
    undefined,
    [],
    ['style-sidecar:1'],
    ['entry-style-only:1'],
    ['css-importer:4'],
    ['entry-direct:1'],
  ])('keeps ordinary page updates local: %j', (dirtyReasonSummary) => {
    expect(resolveTouchAppWxssEnabled({ ...base, dirtyReasonSummary })).toBe(false)
  })

  it('keeps native output emission as the only refresh owner for managed Tailwind', () => {
    expect(resolveTouchAppWxssEnabled({
      ...base,
      managedTailwindcss: true,
      dirtyReasonSummary: ['tailwind-content:2'],
    })).toBe(false)
  })

  it('refreshes existing app styles only for actual legacy Tailwind content invalidation', () => {
    expect(resolveTouchAppWxssEnabled({
      ...base,
      dirtyReasonSummary: ['entry-local-asset:1', 'tailwind-content:2'],
    })).toBe(true)
  })
})
