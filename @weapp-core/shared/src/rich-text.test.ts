import type { RichTextOptions, SafeRichTextNode } from './rich-text'
import { describe, expect, it } from 'vitest'
import { normalizeRichTextNodes, sanitizeRichTextAttributes } from './rich-text'

const native: RichTextOptions = { native: true }
const nativeTags = 'a abbr address article aside b bdi bdo big blockquote br caption center cite code col colgroup dd del div dl dt em fieldset font footer h1 h2 h3 h4 h5 h6 header hr i img ins label legend li mark nav ol p pre q rt ruby s section small span strong sub sup table tbody td tfoot th thead tr tt u ul'.split(' ')

function element(name: string, attrs: Record<string, string> = {}, children: SafeRichTextNode[] = []): SafeRichTextNode {
  return { type: 'element', name, attrs, children }
}

describe('native rich-text normalization', () => {
  it.each(nativeTags)('accepts the official %s tag case-insensitively in arrays and HTML', (name) => {
    const sourceName = name.toUpperCase()
    const expected = [element(name)]
    expect(normalizeRichTextNodes([{ name: sourceName }], native)).toEqual(expected)
    const closingTag = ['br', 'col', 'hr', 'img'].includes(name) ? '' : `</${sourceName}>`
    expect(normalizeRichTextNodes(`<${sourceName}>${closingTag}`, native)).toEqual(expected)
  })

  it.each(['unknown', 'unsafe-card', 'script', 'style', 'wxs', 'template', 'iframe', 'svg', 'video'])('removes the entire untrusted %s subtree', (name) => {
    const kept = { type: 'text' as const, text: 'kept' }
    expect(normalizeRichTextNodes([
      { name, children: [{ name: 'strong', children: [{ type: 'text', text: 'removed' }] }] },
      kept,
    ], native)).toEqual([kept])
    expect(normalizeRichTextNodes(`<${name}><strong>removed</strong></${name}>kept`, native)).toEqual([kept])
  })

  it('rejects unknown array elements before traversing their children', () => {
    expect(normalizeRichTextNodes([{
      name: 'unknown',
      get children() {
        throw new Error('An untrusted subtree must not be visited')
      },
    }], native)).toEqual([])
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
      expect(normalizeRichTextNodes([invalid], native)).toEqual([])
      expect(normalizeRichTextNodes([{ type: 'node', name: 'p', children: [invalid, kept] }], native)).toEqual([
        element('p', {}, [kept]),
      ])
    }
    expect(normalizeRichTextNodes([
      { type: 'node', name: 'P', children: [kept] },
      { name: 'p', children: [{ type: 'text', text: '' }] },
    ], native)).toEqual([element('p', {}, [kept]), element('p', {}, [{ type: 'text', text: '' }])])
  })

  it('never coerces nonstring native names or text', () => {
    const nonstring = {
      toString() {
        throw new Error('Native fields must not be coerced')
      },
    }
    expect(normalizeRichTextNodes([{ name: nonstring }, { type: 'text', text: nonstring }], native)).toEqual([])
  })

  it('decodes array text entities once without parsing markup or WXML', () => {
    const text = 'Hello &amp; <b>literal</b> {{secret}} &amp;amp; &#38;amp; &#x26;lt; &lt;strong&gt; &nbsp; &#65; &#x1D11E;'
    expect(normalizeRichTextNodes([{ type: 'text', text }], native)).toEqual([{
      type: 'text',
      text: 'Hello & <b>literal</b> {{secret}} &amp; &amp; &lt; <strong> \u00A0 A \u{1D11E}',
    }])
  })

  it('decodes HTML text and attributes once without reinterpreting decoded content', () => {
    expect(normalizeRichTextNodes('<p class="&amp;amp; {{secret}}">&lt;b&gt;literal&lt;/b&gt; {{secret}} &amp;amp; &#38;amp; &#x26;lt; &nbsp; &#65; &#x1D11E;</p>', native)).toEqual([
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
    expect(sanitizeRichTextAttributes(attrs, name, native)).toEqual(allowed)
    if (name !== 'constructor') {
      expect(normalizeRichTextNodes([{ name, attrs }], native)).toEqual([element(name, allowed)])
      const htmlAttrs = Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ')
      const closingTag = ['col', 'img'].includes(name) ? '' : `</${name}>`
      expect(normalizeRichTextNodes(`<${name} ${htmlAttrs}>${closingTag}`, native)).toEqual([element(name, allowed)])
    }
  })

  it.each(['javascript:trap()', 'java\nscript:trap()', 'data:text/html,bad', 'data:image/png;base64,AAAA', '/local.png', 'mailto:test@example.com'])('rejects unsafe or non-network native image source %s', (src) => {
    expect(normalizeRichTextNodes([{ name: 'img', attrs: { src, alt: 'safe' } }], native)).toEqual([element('img', { alt: 'safe' })])
  })

  it('keeps safe network images and rejects entity-obfuscated executable URLs', () => {
    for (const src of ['https://example.com/a.png', 'http://example.com/a.png', '//example.com/a.png']) {
      expect(sanitizeRichTextAttributes({ src }, 'img', native)).toEqual({ src })
    }
    expect(normalizeRichTextNodes('<img src="java&#x73;cript:trap()" alt="safe">', native)).toEqual([element('img', { alt: 'safe' })])
  })

  it('normalizes empty and malformed values to an empty tree', () => {
    for (const value of [undefined, null, '', [], false, 42, {}, [null, 42, { children: false }]]) {
      expect(normalizeRichTextNodes(value, native)).toEqual([])
    }
  })
})

describe('default Web rich-text policy', () => {
  it('preserves Web links, attributes and unknown-tag flattening without native opt-in', () => {
    const source = '<unknown><a id="web" href="https://example.com" data-state="ready">link</a></unknown><nav>navigation</nav><footer>footer</footer>'
    const expected = [
      element('a', { 'id': 'web', 'href': 'https://example.com', 'data-state': 'ready', 'rel': 'noopener noreferrer' }, [{ type: 'text', text: 'link' }]),
      { type: 'text', text: 'navigation' },
      { type: 'text', text: 'footer' },
    ]
    expect(normalizeRichTextNodes(source)).toEqual(expected)
    expect(normalizeRichTextNodes(source, { native: false })).toEqual(expected)
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
