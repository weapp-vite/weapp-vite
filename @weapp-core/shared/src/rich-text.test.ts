import type { SafeRichTextNode } from './rich-text'
import { describe, expect, it } from 'vitest'
import { normalizeNativeRichTextNodes, normalizeRichTextNodes, sanitizeNativeRichTextAttributes, sanitizeRichTextAttributes } from './rich-text'

const nativeTags = 'a abbr address article aside b bdi bdo big blockquote br caption center cite code col colgroup dd del div dl dt em fieldset font footer h1 h2 h3 h4 h5 h6 header hr i img ins label legend li mark nav ol p pre q rt ruby s section small span strong sub sup table tbody td tfoot th thead tr tt u ul'.split(' ')

function element(name: string, attrs: Record<string, string> = {}, children: SafeRichTextNode[] = []): SafeRichTextNode {
  return { type: 'element', name, attrs, children }
}

describe('native rich-text normalization', () => {
  it.each(nativeTags)('accepts the official %s tag case-insensitively in arrays and HTML', (name) => {
    const sourceName = name.toUpperCase()
    const expected = [element(name)]
    expect(normalizeNativeRichTextNodes([{ name: sourceName }])).toEqual(expected)
    const closingTag = ['br', 'col', 'hr', 'img'].includes(name) ? '' : `</${sourceName}>`
    expect(normalizeNativeRichTextNodes(`<${sourceName}>${closingTag}`)).toEqual(expected)
  })

  it.each(['unknown', 'unsafe-card', 'script', 'style', 'wxs', 'template', 'iframe', 'svg', 'video'])('removes the entire untrusted %s subtree', (name) => {
    const kept = { type: 'text' as const, text: 'kept' }
    expect(normalizeNativeRichTextNodes([
      { name, children: [{ name: 'strong', children: [{ type: 'text', text: 'removed' }] }] },
      kept,
    ])).toEqual([kept])
    expect(normalizeNativeRichTextNodes(`<${name}><strong>removed</strong></${name}>kept`)).toEqual([kept])
  })

  it('rejects unknown array elements before traversing their children', () => {
    expect(normalizeNativeRichTextNodes([{
      name: 'unknown',
      get children() {
        throw new Error('An untrusted subtree must not be visited')
      },
    }])).toEqual([])
  })

  it('requires native node types and their string fields without inferring text', () => {
    const kept = { type: 'text' as const, text: 'kept' }
    const invalidNodes = [
      { type: 'node', text: 'missing name' },
      { text: 'missing text type' },
      { type: 'unknown', name: 'p', children: [kept] },
      { type: null, name: 'p', children: [kept] },
      { type: '', name: 'p', children: [kept] },
      { name: ['p'], children: [kept] },
      { name: 42, children: [kept] },
      { name: null, children: [kept] },
      { type: 'text' },
      { type: 'text', text: 42 },
      { type: 'text', text: false },
      { type: 'text', text: null },
      { type: 'text', text: ['not a string'] },
      { type: 'text', name: 'p', text: {}, children: [kept] },
    ]
    for (const invalid of invalidNodes) {
      expect(normalizeNativeRichTextNodes([invalid])).toEqual([])
      expect(normalizeNativeRichTextNodes([{ type: 'node', name: 'p', children: [invalid, kept] }])).toEqual([
        element('p', {}, [kept]),
      ])
    }
    expect(normalizeNativeRichTextNodes([
      { type: 'node', name: 'P', children: [kept] },
      { name: 'p', children: [{ type: 'text', text: '' }] },
    ])).toEqual([element('p', {}, [kept]), element('p', {}, [{ type: 'text', text: '' }])])
  })

  it('never coerces nonstring native names or text', () => {
    const nonstring = {
      toString() {
        throw new Error('Native fields must not be coerced')
      },
    }
    expect(normalizeNativeRichTextNodes([{ name: nonstring }, { type: 'text', text: nonstring }])).toEqual([])
  })

  it('decodes array text entities once without parsing markup or WXML', () => {
    const text = 'Hello &amp; <b>literal</b> {{secret}} &amp;amp; &#38;amp; &#x26;lt; &lt;strong&gt; &nbsp; &#65; &#x1D11E;'
    expect(normalizeNativeRichTextNodes([{ type: 'text', text }])).toEqual([{
      type: 'text',
      text: 'Hello & <b>literal</b> {{secret}} &amp; &amp; &lt; <strong> \u00A0 A \u{1D11E}',
    }])
  })

  it('preserves named and numeric HTML entity decoding without decoding unknown entities', () => {
    expect(normalizeNativeRichTextNodes([{ type: 'text', text: '&amp;amp; &unknown; &#65; &nbsp;' }])).toEqual([{
      type: 'text',
      text: '&amp; &unknown; A \u00A0',
    }])
  })

  it('decodes HTML text and attributes once without reinterpreting decoded content', () => {
    expect(normalizeNativeRichTextNodes('<p class="&amp;amp; {{secret}}">&lt;b&gt;literal&lt;/b&gt; {{secret}} &amp;amp; &#38;amp; &#x26;lt; &nbsp; &#65; &#x1D11E;</p>')).toEqual([
      element('p', { class: '&amp; {{secret}}' }, [{
        type: 'text',
        text: '<b>literal</b> {{secret}} &amp; &amp; &lt; \u00A0 A \u{1D11E}',
      }]),
    ])
  })

  it.each([
    ['p', {}],
    ['a', {}],
    ['span', {}],
    ['font', {}],
    ['bdi', {}],
    ['bdo', { dir: 'rtl' }],
    ['col', { span: '2', width: '80' }],
    ['colgroup', { span: '2', width: '80' }],
    ['img', { alt: '{{secret}}', src: 'https://example.com/image.png', height: '20', width: '80' }],
    ['ol', { start: '3', type: 'A' }],
    ['table', { width: '80' }],
    ['td', { colspan: '2', height: '20', rowspan: '3', width: '80' }],
    ['th', { colspan: '2', height: '20', rowspan: '3', width: '80' }],
    ['tr', { colspan: '2', height: '20', rowspan: '3', width: '80' }],
    ['constructor', {}],
  ] as Array<[string, Record<string, string>]>)('allows only global and official per-tag attributes on %s', (name, expected) => {
    const attrs = {
      'Class': 'safe {{secret}}',
      'Style': 'color: red; width: expression(trap()); background: url(javascript:trap())',
      'id': 'rejected',
      'href': 'https://example.com',
      'target': '_blank',
      'rel': 'opener',
      'title': 'rejected',
      'aria-label': 'rejected',
      'data-state': 'rejected',
      'data-sim-node': 'forged',
      'data-sim-scope': 'forged',
      'data-sim-tap': 'trap',
      'data-sim-component': 'unsafe-card',
      'onclick': 'trap()',
      'bindtap': 'trap',
      'wx:if': '{{false}}',
      'wx:for': '{{items}}',
      'dir': 'rtl',
      'span': '2',
      'width': '80',
      'height': '20',
      'alt': '{{secret}}',
      'src': 'https://example.com/image.png',
      'start': '3',
      'type': 'A',
      'colspan': '2',
      'rowspan': '3',
    }
    const allowed = { class: 'safe {{secret}}', style: 'color: red', ...expected }
    expect(sanitizeNativeRichTextAttributes(attrs, name)).toEqual(allowed)
    if (name !== 'constructor') {
      expect(normalizeNativeRichTextNodes([{ name, attrs }])).toEqual([element(name, allowed)])
      const htmlAttrs = Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ')
      const closingTag = ['col', 'img'].includes(name) ? '' : `</${name}>`
      expect(normalizeNativeRichTextNodes(`<${name} ${htmlAttrs}>${closingTag}`)).toEqual([element(name, allowed)])
    }
  })

  it.each(['javascript:trap()', 'java\nscript:trap()', 'data:text/html,bad', 'data:image/png;base64,AAAA', '/local.png', 'mailto:test@example.com'])('rejects unsafe or non-network native image source %s', (src) => {
    expect(normalizeNativeRichTextNodes([{ name: 'img', attrs: { src, alt: 'safe' } }])).toEqual([element('img', { alt: 'safe' })])
  })

  it('keeps safe network images and rejects entity-obfuscated executable URLs', () => {
    for (const src of ['https://example.com/a.png', 'http://example.com/a.png', '//example.com/a.png']) {
      expect(sanitizeNativeRichTextAttributes({ src }, 'img')).toEqual({ src })
    }
    expect(normalizeNativeRichTextNodes('<img src="java&#x73;cript:trap()" alt="safe">')).toEqual([element('img', { alt: 'safe' })])
  })

  it('normalizes empty and malformed values to an empty tree', () => {
    for (const value of [undefined, null, '', [], false, 42, {}, [null, 42, { children: false }]]) {
      expect(normalizeNativeRichTextNodes(value)).toEqual([])
    }
  })
})

describe('default Web rich-text policy', () => {
  it('preserves Web links, attributes and unknown-tag flattening through the Web entry', () => {
    const source = '<unknown><a id="web" href="https://example.com" data-state="ready">link</a></unknown><nav>navigation</nav><footer>footer</footer>'
    const expected = [
      element('a', { 'id': 'web', 'href': 'https://example.com', 'data-state': 'ready', 'rel': 'noopener noreferrer' }, [{ type: 'text', text: 'link' }]),
      { type: 'text', text: 'navigation' },
      { type: 'text', text: 'footer' },
    ]
    expect(normalizeRichTextNodes(source)).toEqual(expected)
  })

  it('retains literal array text and flattened untrusted array children for Web callers', () => {
    const source = [{ name: 'SCRIPT', children: [{ type: 'text', text: '&amp;<b>{{secret}}</b>' }] }]
    expect(normalizeRichTextNodes(source)).toEqual([{ type: 'text', text: '&amp;<b>{{secret}}</b>' }])
    expect(sanitizeRichTextAttributes({ src: 'data:image/png;base64,AAAA' }, 'img')).toEqual({ src: 'data:image/png;base64,AAAA' })
  })

  it('preserves default Web type inference and string coercion', () => {
    expect(normalizeRichTextNodes([
      { type: 'node', text: 'inferred' },
      { text: 'implicit' },
      { type: 'unknown', name: 'p', children: [{ type: 'text', text: 42 }] },
      { name: ['p'] },
      { type: 'text' },
    ])).toEqual([
      { type: 'text', text: 'inferred' },
      { type: 'text', text: 'implicit' },
      element('p', {}, [{ type: 'text', text: '42' }]),
      element('p'),
      { type: 'text', text: '' },
    ])
  })
})
