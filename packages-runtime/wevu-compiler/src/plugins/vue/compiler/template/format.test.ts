import { describe, expect, it } from 'vitest'
import { formatWxml } from './format'

describe('WXML text whitespace preservation', () => {
  it.each([
    '<text id="actual">总重：<text>{{weight}}</text>kg</text>',
    '<text><text>nested</text></text>',
    '<text> <text>nested</text> </text>',
    '<text>\n <text>nested</text>\n</text>',
    '<text> </text>',
    '<view>before <text>nested</text> after</view>',
    '<view><text>left</text> <text>right</text></view>',
    '<text>before<!-- preserved --> <text>nested</text> after</text>',
    '<text>before <image /> after</text>',
  ])('preserves the original text-bearing subtree: %s', (source) => {
    const result = formatWxml(`<view>${source}</view>`)
    expect(result).toBe(`<view>\n  ${source}\n</view>\n`)
    expect(formatWxml(result)).toBe(result)
  })

  it('formats structural containers without collecting descendant text into the parent', () => {
    expect(formatWxml('<view><view><text>nested</text></view></view>')).toBe('<view>\n  <view>\n    <text>nested</text>\n  </view>\n</view>\n')
  })
})
