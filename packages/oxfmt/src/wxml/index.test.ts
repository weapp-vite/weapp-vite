import { describe, expect, it } from 'vitest'
import { formatWxml } from './index'

describe('formatWxml semantic token protection', () => {
  it.each([
    '<text   class="label">prefix  {{label}}  suffix</text>\n',
    '<view   class="layout"><text>A</text> <text>B</text>\n\t<text>\n  first  line\n second  line\n</text></view>\n',
    '<view   wx:if="{{ count < 3 && width > 1 }}" bind:tap="select" catchtap="stop">{{ flag ? ">" : "<" }}</view>',
    '<view   data-value="{{ { label: \'}}<view>\', value: { x: 1 } } }}">{{ /}}/.test(label) ? a / 2 : b }}</view>',
    '<view   wx:for="{{items}}" wx:key="id" data-id="{{item.id}}" class=\'item\'>{{item.name}}</view>',
    '<wxs module="math">var text = "<view  fake=\'tag\'/>";\nvar value = a < b ? ">" : "<";\n</wxs>\n<view   bindtap="open">{{math.text}}</view>',
    '<!-- keep  comment -->\n<view   class="data"><![CDATA[  <view>  {{ not an expression  ]]></view>',
  ])('preserves all semantic source while changing only tag layout: %s', async (source) => {
    const result = await formatWxml(source, 'tokens.wxml', { printWidth: 320 })
    expect(result).not.toBe(source)
    expect(await formatWxml(result, 'tokens.wxml', { printWidth: 320 })).toBe(result)
    const expected = source.replace(/<(text|view) {3}/g, '<$1 ')
    expect(result).toBe(expected)
  })

  it('preserves CRLF and spaces in text without inserting new text nodes', async () => {
    const source = '<view   class="x">\r\n  prefix  {{label}}  suffix\r\n</view>\r\n'
    expect(await formatWxml(source)).toBe('<view class="x">\r\n  prefix  {{label}}  suffix\r\n</view>\r\n')
  })

  it('preserves multiline attribute expressions while indenting formatted tag layout', async () => {
    const expression = '{{\n  count < 3 ? "  first  " : "second"\n}}'
    const source = `<view>\n  <text   class="long-label" data-value='${expression}'>  body  </text>\n</view>\n`
    const result = await formatWxml(source, 'multiline.wxml', { printWidth: 40 })
    expect(result).toContain(`data-value='${expression}'`)
    expect(result).toContain('>  body  </text>')
    expect(await formatWxml(result, 'multiline.wxml', { printWidth: 40 })).toBe(result)
  })

  it('uses caller formatting options for long attributes', async () => {
    const source = '<view alpha="first-value" beta="second-value" gamma="third-value">  text  </view>'
    const narrow = await formatWxml(source, 'options.wxml', { printWidth: 40 })
    const wide = await formatWxml(source, 'options.wxml', { printWidth: 120 })
    expect(narrow).toContain('\n')
    expect(wide).toBe(source)
    expect(await formatWxml(narrow, 'options.wxml', { printWidth: 40 })).toBe(narrow)
  })

  it.each([
    '<view class="unterminated>',
    '<view wx:if="{{ value < 2 }">',
    '<view data-value="{{ \'unterminated }}">',
    '<wxs module="math">var x = 1;',
    '<!-- unclosed',
  ])('rejects incomplete tokens without returning a partial result', async (source) => {
    await expect(formatWxml(source, 'invalid.wxml')).rejects.toThrow('invalid.wxml')
  })
})
