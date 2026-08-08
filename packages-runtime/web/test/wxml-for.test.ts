import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'

describe('compileWxml for rendering', () => {
  it('uses distinct lexical scope variables for nested loops', () => {
    const result = compileWxml({
      id: '/src/components/skeleton/skeleton.wxml',
      source: `
<view wx:for="{{rows}}" wx:for-item="row" wx:for-index="rowIndex">
  <view wx:for="{{row}}" wx:for-item="cell" wx:for-index="cellIndex">
    {{rowIndex}}:{{cellIndex}}:{{cell}}
  </view>
</view>`,
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })

    expect(result.code).toContain('const __scope = ctx.createScope(scope')
    expect(result.code).toContain('const __scope_nested = ctx.createScope(__scope')
    expect(result.code).not.toContain('const __scope = ctx.createScope(__scope')
  })
})
