import { describe, expect, it } from 'vitest'
import { transformWxssToCss } from '../src/css/wxss'

describe('transformWxssToCss', () => {
  it('converts rpx units to px', () => {
    const input = '.btn { width: 100rpx; margin: 10rpx 5rpx; }'
    const { css } = transformWxssToCss(input, { pxPerRpx: 0.5 })
    expect(css).toContain('width: 50px')
    expect(css).toContain('margin: 5px 2.5px')
  })

  it('uses the runtime viewport variable by default', () => {
    const { css } = transformWxssToCss('.card { width: 750rpx; }')
    expect(css).toContain('width: calc(var(--rpx) * 750)')
  })

  it('maps safe-area env values to runtime viewport variables', () => {
    const result = transformWxssToCss(`
      .fixed {
        padding: env(safe-area-inset-top) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom) env(safe-area-inset-left);
      }
    `)

    expect(result.css).toContain('var(--weapp-safe-area-inset-top)')
    expect(result.css).toContain('var(--weapp-safe-area-inset-right)')
    expect(result.css).toContain('var(--weapp-safe-area-inset-bottom)')
    expect(result.css).toContain('var(--weapp-safe-area-inset-left)')
  })

  it('maps page and native component selectors without changing selector structure', () => {
    const input = `
      page > view.card text:first-child,
      scroll-view[data-axis="y"] image {
        width: 100rpx;
      }
    `
    const { css } = transformWxssToCss(input)
    expect(css).toContain(':host > weapp-view.card weapp-text:first-child')
    expect(css).toContain('weapp-scroll-view[data-axis="y"] weapp-image')
  })
})
