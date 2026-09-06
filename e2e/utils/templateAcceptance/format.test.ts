import { describe, expect, it } from 'vitest'
import { canonicalWxml, canonicalWxss } from './format'

describe('template artifact canonicalization', () => {
  it('preserves native tag casing, bindings and attribute entities', () => {
    const source = '<HelloWorld title="{{title}}"><text> &lt;hello&gt; </text></HelloWorld>'
    expect(canonicalWxml(source)).toBe('<HelloWorld title="{{title}}"><text> &lt;hello&gt; </text></HelloWorld>')
    expect(canonicalWxml(canonicalWxml(source))).toBe(canonicalWxml(source))
  })

  it('normalizes inline styles without trimming text, indentation or inline separators', () => {
    expect(canonicalWxml('<view style="display:flex; color:red;">\n <text>Hello </text> <text> World</text>\n</view>'))
      .toBe(canonicalWxml('<view style="display: flex; color: red">\n <text>Hello </text> <text> World</text>\n</view>'))
    expect(canonicalWxml('<text> Hello </text>')).not.toBe(canonicalWxml('<text>Hello</text>'))
  })

  it('preserves stylesheet declaration order and fallback values', () => {
    const css = canonicalWxss('.probe{display:-webkit-box;display:flex}')
    expect(css.indexOf('display: -webkit-box')).toBeLessThan(css.indexOf('display: flex'))
    expect(css).toBe(canonicalWxss('.probe {\n  display: -webkit-box;\n  display: flex;\n}\n'))
  })

  it('keeps whitespace-only custom properties stable across normalization', () => {
    const source = '.probe { --tw-font-weight: ; --tw-custom:  ; }'
    expect(canonicalWxss(canonicalWxss(source))).toBe(canonicalWxss(source))
  })
})
