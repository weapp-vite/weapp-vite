import { describe, expect, it } from 'vitest'
import { getWxmlInterpolationContext, getWxmlScopedIdentifierMatch } from './templateContext'
import { getEventExpressionIdentifiers, getTemplateEventExpressions } from './templateEvents'

describe('shared platform expression contexts', () => {
  it('keeps alipay events separate from wechat and preserves Vue event syntax', () => {
    const source = '<view onTap="handlers.tap(row)" bindtap="wechat" @tap="vueTap"/>'
    expect(getTemplateEventExpressions(source, 'page.axml').map(event => event.source)).toEqual(['handlers.tap(row)'])
    expect(getTemplateEventExpressions(source, 'page.wxml').map(event => event.source)).toEqual(['wechat'])
    expect(getTemplateEventExpressions(source, 'page.vue').map(event => event.source)).toEqual(['wechat', 'vueTap'])
    expect(getEventExpressionIdentifiers('handlers.tap("handlers.fake", row)', 0).map(identifier => identifier.name)).toEqual(['handlers', 'tap', 'row'])
  })

  it('maps nested Baidu inline bindings and rejects a false interpolation inside raw scripts', () => {
    const source = '<view s-for="row,i in rows"><view s-for="row,j in row.children">{{row.title}} {{j}}</view>{{row.title}} {{i}}</view><filter module="tools">var fake="{{row}}";</filter>'
    const inner = source.indexOf('row.title')
    const outer = source.lastIndexOf('row.title')
    expect(getWxmlScopedIdentifierMatch(source, inner, 'row', 'page.swan')?.definitionStart).toBe(source.indexOf('row,j'))
    expect(getWxmlScopedIdentifierMatch(source, outer, 'row', 'page.swan')?.definitionStart).toBe(source.indexOf('row,i'))
    expect(getWxmlInterpolationContext(source, source.indexOf('fake=') + 'fake="{{'.length + 1, 'page.swan')).toBeNull()
  })

  it('uses scanner expression boundaries for braces inside strings and Unicode offsets', () => {
    const source = '😀<text>{{ "}}" + value }}</text>'
    const context = getWxmlInterpolationContext(source, source.indexOf('value') + 1)
    expect(context?.expression).toBe('"}}" + value')
    expect(context?.end).toBe(source.lastIndexOf('}}'))
  })
})
