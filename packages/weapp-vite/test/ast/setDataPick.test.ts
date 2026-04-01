import { describe, expect, it } from 'vitest'
import { collectSetDataPickKeysFromTemplateCode } from '../../src/ast'

describe('collectSetDataPickKeysFromTemplateCode', () => {
  it('keeps current key collection behavior across engine options', () => {
    const template = `
<view wx:for="{{ list }}" wx:for-item="row" wx:for-index="i">
  <text>{{ row.name }}</text>
  <text>{{ __wv_bind_0[i] }}</text>
</view>
<text>{{ count > 0 ? count : 0 }}</text>
    `.trim()

    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'babel' })).toEqual(['__wv_bind_0', 'count', 'list'])
    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'oxc' })).toEqual(['__wv_bind_0', 'count', 'list'])
  })
})
