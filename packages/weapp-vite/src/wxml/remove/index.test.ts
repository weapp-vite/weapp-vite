import { describe, expect, it } from 'vitest'
import { createWxmlRemover } from './index'

const fileName = 'pages/home/index.wxml'

describe('createWxmlRemover matching', () => {
  it('returns untouched input without parsing when cleanup is disabled', () => {
    const code = '<view data-test="unterminated'
    expect(createWxmlRemover({})(code, fileName)).toBe(code)
    expect(createWxmlRemover({ attr: [], tag: [], comment: false })(code, fileName)).toBe(code)
    expect(createWxmlRemover({ attr: [{ tag: [], name: '*' }] })(code, fileName)).toBe(code)
    expect(createWxmlRemover({ comment: true })(code, fileName)).toBe(code)
  })

  it('preserves every unmatched byte, including whitespace beside removed attributes', () => {
    const code = '<view\r\n\tdata-test = \'a > b\'  id="keep" data-test-extra="keep" DATA-TEST="keep"> x </view>\r\n'
    expect(createWxmlRemover({ attr: ['data-test'] })(code, fileName))
      .toBe('<view\r\n\t  id="keep" data-test-extra="keep" DATA-TEST="keep"> x </view>\r\n')
  })

  it('removes only the exact attribute on the selected tag and preserves its children', () => {
    const code = '<view data-testid="view" data-testid-extra="keep"><text data-testid="text">child</text><view data-testid="nested"/></view><web-view data-testid="web"/>'
    expect(createWxmlRemover({ attr: [{ tag: 'view', name: 'data-testid' }] })(code, fileName))
      .toBe('<view  data-testid-extra="keep"><text data-testid="text">child</text><view /></view><web-view data-testid="web"/>')
  })

  it('unions global and tag-scoped attribute rules without deleting nodes', () => {
    const code = '<debug-card global="a" flag label="keep"><button flag global="b"/></debug-card><debug-panel flag/><view flag global="c"/>'
    const remove = createWxmlRemover({
      attr: ['global', { tag: ['debug-card', 'debug-panel'], name: ['flag'] }],
    })
    expect(remove(code, fileName))
      .toBe('<debug-card   label="keep"><button flag /></debug-card><debug-panel /><view flag />')
  })

  it('uses only explicit stars as complete-name wildcards in tag and attribute rules', () => {
    const code = '<debug-card data-debug-a="1" data-debug="2" xdata-debug-a="3" debug?.x="4" debugXa.x="5"/><Debug-card data-debug-a="6"/>'
    const remove = createWxmlRemover({ attr: [{ tag: 'debug-*', name: ['data-debug-*', 'debug?.*'] }] })
    expect(remove(code, fileName))
      .toBe('<debug-card  data-debug="2" xdata-debug-a="3"  debugXa.x="5"/><Debug-card data-debug-a="6"/>')
  })

  it('removes explicitly selected arbitrary component props but does not guess others', () => {
    const code = '<my-card analytics="{{__wv_bind_0}}" debug-mode="on" label="keep"/>'
    expect(createWxmlRemover({ attr: ['analytics', 'debug-*'] })(code, fileName))
      .toBe('<my-card   label="keep"/>')
  })

  it('deletes boolean, empty, unquoted and duplicate attributes without consuming separators', () => {
    const code = '<view flag data-test="" data-test=plain data-test=\'second\' keep />'
    expect(createWxmlRemover({ attr: ['flag', 'data-test'] })(code, fileName))
      .toBe('<view     keep />')
  })

  it('removes whole nested same-name subtrees and lets parents subsume child ranges', () => {
    const code = 'before\n<debug-box data-test="a"><debug-box/><view data-test="b"/><!-- gone --><debug-box>nested</debug-box></debug-box>\n<view data-test="c"/>after'
    expect(createWxmlRemover({ tag: ['debug-box'], attr: ['data-test'], comment: true })(code, fileName))
      .toBe('before\n\n<view />after')
  })

  it('matches paired and selfclosing tag names exactly and case-sensitively', () => {
    const code = '<debug/><debug>gone</debug><debugger/><Debug/><x-debug/>'
    expect(createWxmlRemover({ tag: ['debug'] })(code, fileName))
      .toBe('<debugger/><Debug/><x-debug/>')
    expect(createWxmlRemover({ tag: ['debug*'] })(code, fileName))
      .toBe('<Debug/><x-debug/>')
  })

  it('does not inject comment or attribute cleanup into custom tag-only options', () => {
    const code = '<!-- keep --><view data-testid="keep"/><debug/>'
    expect(createWxmlRemover({ tag: ['debug'] })(code, fileName))
      .toBe('<!-- keep --><view data-testid="keep"/>')
  })

  it('returns unmatched source intact without reserialization', () => {
    const code = '<?xml version="1.0"?>\r\n<view title=\'&amp;\'\tother = "&quot;" />'
    expect(createWxmlRemover({ attr: ['data-test'], tag: ['debug'] })(code, fileName)).toBe(code)
  })
})
