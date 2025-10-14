import { describe, expect, it } from 'vitest'
import { transformWxssToCss } from '../src/css/wxss'

describe('transformWxssToCss', () => {
  it('converts rpx units to px', () => {
    const input = '.btn { width: 100rpx; margin: 10rpx 5rpx; }'
    const { css } = transformWxssToCss(input, { pxPerRpx: 0.5 })
    expect(css).toContain('width: 50px')
    expect(css).toContain('margin: 5px 2.5px')
  })
})
