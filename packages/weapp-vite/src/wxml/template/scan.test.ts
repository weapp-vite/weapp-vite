import { describe, expect, it } from 'vitest'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { createWxmlRemover } from '../remove'

const fileName = 'pages/source/index.wxml'

describe('WXML cleanup source ranges', () => {
  it('does not interpret markup in quoted attributes, interpolation or comments as elements', () => {
    const expression = `{{ { html: '<debug data-test="x">text</debug>', tail: '}}' } }}`
    const code = `<view title="a > b <debug/>" other='<!-- keep -->'>${expression}<!-- <debug/> --><debug>gone</debug></view>`
    expect(createWxmlRemover({ tag: ['debug'], attr: ['data-test'] })(code, fileName))
      .toBe(`<view title="a > b <debug/>" other='<!-- keep -->'>${expression}<!-- <debug/> --></view>`)
  })

  it('removes complete values containing quotes, markup and unquoted interpolation operators', () => {
    const code = `<view data-test="{{ value > 1 ? '<debug/>' : '}}' }}" keep='yes'/><view data-test={{ value > 1 ? '<debug/>' : '}}' }} keep=yes/>`
    expect(createWxmlRemover({ attr: ['data-test'], tag: ['debug'] })(code, fileName))
      .toBe('<view  keep=\'yes\'/><view  keep=yes/>')
  })

  it.each(getScriptModuleTagNames())('keeps raw %s bodies opaque to every cleanup rule', (tag) => {
    const body = `var html = '<debug data-test="x">raw</debug>'; var comment = '<!-- keep -->'; if (a < b) { a++; } // final comment`
    const code = `<${tag} module="helper">${body}</${tag}><debug/><view data-test="x"/><!-- gone -->`
    expect(createWxmlRemover({ tag: ['debug'], attr: ['data-test'], comment: true })(code, fileName))
      .toBe(`<${tag} module="helper">${body}</${tag}><view />`)
  })

  it('does not mistake longer raw closing names for the module boundary', () => {
    const code = '<wxs module="x">var source = "</wxs-extra><debug/>";</wxs><debug/>'
    expect(createWxmlRemover({ tag: ['debug'] })(code, fileName))
      .toBe('<wxs module="x">var source = "</wxs-extra><debug/>";</wxs>')
  })

  it('preserves CDATA and XML processing instructions without looking inside them', () => {
    const code = '<?tool value="<debug/>"?><view><![CDATA[<!-- keep --><debug/>]]><debug/></view>'
    expect(createWxmlRemover({ tag: ['debug'], comment: true })(code, fileName))
      .toBe('<?tool value="<debug/>"?><view><![CDATA[<!-- keep --><debug/>]]></view>')
  })

  it('only removes ordinary template comments, without trimming neighboring whitespace', () => {
    const instructions = [
      '<!-- #ifdef weapp -->',
      '<!-- #endif -->',
      '<!--! license -->',
      '<!-- @preserve tool metadata -->',
      '<!-- eslint-disable-next-line -->',
      '<!-- prettier-ignore -->',
      '<!-- [if IE]>instruction<![endif] -->',
    ].join('\n')
    const code = `before\n<!-- ordinary <debug/> -->\n${instructions}\n<view title="<!-- literal -->">{{ '<!-- literal -->' }}</view>\n<!-- last -->\n`
    expect(createWxmlRemover({ comment: true })(code, fileName))
      .toBe(`before\n\n${instructions}\n<view title="<!-- literal -->">{{ '<!-- literal -->' }}</view>\n\n`)
  })

  it('leaves comments intact when disabled even if attributes are removed', () => {
    const code = '<!-- keep --><view data-test="x"/><!-- keep too -->'
    expect(createWxmlRemover({ attr: ['data-test'], comment: false })(code, fileName))
      .toBe('<!-- keep --><view /><!-- keep too -->')
  })

  it('preserves legacy interpolations and removes whole escaped attribute values', () => {
    const retained = String.raw`title="{{ value === \"a\\\"b\" ? \"<debug/><!-- literal -->\" : \"other\" }}"`
    const code = String.raw`<view data-test="\"test\"" ${retained}/><!-- ordinary --><debug/>`
    expect(createWxmlRemover({ attr: ['data-test'], tag: ['debug'], comment: true })(code, fileName))
      .toBe(`<view  ${retained}/>`)
    expect(createWxmlRemover({ comment: true })(code, fileName))
      .toBe(String.raw`<view data-test="\"test\"" ${retained}/><debug/>`)
  })

  it('handles single-quoted legacy attributes with the same source range rules', () => {
    const code = String.raw`<view data-test='\'test\'' title='{{ value === \'test\' }}'/>`
    expect(createWxmlRemover({ attr: ['data-test'] })(code, fileName))
      .toBe(String.raw`<view  title='{{ value === \'test\' }}'/>`)
  })

  it('preserves native opposite-quote strings after attribute-layer escaping', () => {
    const retained = String.raw`probe="{{ 'a\\'b' }}"`
    const source = `<keep-card ${retained} data-testid="drop"/><!-- ordinary -->`
    expect(createWxmlRemover({ comment: true })(source, fileName))
      .toBe(`<keep-card ${retained} data-testid="drop"/>`)
    expect(createWxmlRemover({ attr: ['data-testid'], comment: true })(source, fileName))
      .toBe(`<keep-card ${retained} />`)
  })

  it('distinguishes an escaped opposite quote from an encoded trailing backslash', () => {
    const retained = String.raw`probe="{{ 'a\\\'b' }}" tail="{{ 'tail\\\\' }}"`
    const source = `<keep-card ${retained} data-testid="drop"/><!-- ordinary -->`
    expect(createWxmlRemover({ attr: ['data-testid'], comment: true })(source, fileName))
      .toBe(`<keep-card ${retained} />`)
  })

  it('keeps XML literal backslashes distinct from legacy attribute escapes', () => {
    const code = String.raw`<view title="slash\" data-test="drop"><!-- ordinary --></view>`
    expect(createWxmlRemover({ attr: ['data-test'], comment: true })(code, fileName, 'xml'))
      .toBe(String.raw`<view title="slash\" ></view>`)
    expect(createWxmlRemover({ comment: true })(code, fileName, 'xml'))
      .toBe(String.raw`<view title="slash\" data-test="drop"></view>`)
  })

  it('keeps every opaque boundary in comment-only and combined cleanup', () => {
    const opaque = `<view title="<!-- attr -->">{{ '<!-- expression -->' }}</view><wxs module="x">var value = '<!-- script -->';</wxs><![CDATA[<!-- cdata -->]]>`
    const code = `before<!-- first -->${opaque}<!-- last -->after`
    const expected = `before${opaque}after`
    expect(createWxmlRemover({ comment: true })(code, fileName)).toBe(expected)
    expect(createWxmlRemover({ comment: true, attr: ['absent'] })(code, fileName)).toBe(expected)
  })

  it('reports malformed active input at its original output filename and location', () => {
    expect(() => createWxmlRemover({ attr: ['data-test'] })('<view\r\n  data-test="bad>', fileName))
      .toThrow('pages/source/index.wxml:2:3:')
    expect(() => createWxmlRemover({ tag: ['debug'] })('<view>\n  <debug></view>', fileName))
      .toThrow('pages/source/index.wxml:2:10:')
    expect(() => createWxmlRemover({ comment: true })('<view><!-- missing', fileName))
      .toThrow('pages/source/index.wxml:1:7:')
  })
})
