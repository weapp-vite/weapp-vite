import { describe, expect, it } from 'vitest'
import {
  normalizeRichTextNodes,
  sanitizeRichTextAttributes,
  sanitizeRichTextStyle,
} from '../src/runtime/nativeComponents/richText/helpers'

describe('rich text sanitization contract', () => {
  it('accepts safe URL forms and rejects active URL schemes', () => {
    for (const href of ['', '#section', '/root', './child', '../parent', 'https://example.com', 'http://example.com', 'mailto:test@example.com', 'tel:123']) {
      const attributes = sanitizeRichTextAttributes({ href }, 'a')
      if (href) {
        expect(attributes.href).toBe(href)
      }
      else {
        expect(attributes.href).toBeUndefined()
      }
      expect(attributes.rel).toBe('noopener noreferrer')
    }

    expect(sanitizeRichTextAttributes({ src: 'data:image/png;base64,AAAA' }, 'img')).toEqual({
      src: 'data:image/png;base64,AAAA',
    })
    expect(sanitizeRichTextAttributes({ href: 'data:image/png;base64,AAAA' }, 'a')).toEqual({
      rel: 'noopener noreferrer',
    })
    expect(sanitizeRichTextAttributes({ href: ' javascript:\nalert(1)' }, 'a')).toEqual({
      rel: 'noopener noreferrer',
    })
  })

  it('filters every unsafe style and attribute shape', () => {
    expect(sanitizeRichTextStyle(null)).toBe('')
    expect(sanitizeRichTextStyle([
      'broken',
      ':missing-property',
      'position: fixed',
      'color:',
      'color: red',
      'width: url(test)',
      'height: expression(test)',
      'background: javascript:test',
      'border: behavior:test',
      'font-family: -moz-binding(test)',
    ].join(';'))).toBe('color: red')

    expect(sanitizeRichTextAttributes(null, 'div')).toEqual({})
    expect(sanitizeRichTextAttributes({
      'aria-label': 'label',
      'data-state': 'ready',
      'empty': null,
      'onclick': 'bad()',
      'src': '/image.png',
      'srcdoc': '<script />',
      'style': 'position: fixed',
      'title': null,
      'unknown': 'value',
    }, 'span')).toEqual({
      'aria-label': 'label',
      'data-state': 'ready',
    })
  })

  it('normalizes malformed object nodes without preserving unsafe wrappers', () => {
    expect(normalizeRichTextNodes(42)).toEqual([])
    expect(normalizeRichTextNodes({ type: 'text' })).toEqual([{ type: 'text', text: '' }])
    expect(normalizeRichTextNodes({ text: 'implicit' })).toEqual([{ type: 'text', text: 'implicit' }])
    expect(normalizeRichTextNodes({
      name: 'SCRIPT',
      children: [null, { type: 'text', text: 'visible' }],
    })).toEqual([{ type: 'text', text: 'visible' }])
    expect(normalizeRichTextNodes({ children: [] })).toEqual([])
    expect(normalizeRichTextNodes({ name: 'P', attrs: null, children: null })).toEqual([{
      type: 'element',
      name: 'p',
      attrs: {},
      children: [],
    }])
  })

  it('normalizes parsed comments and unwraps unknown HTML tags', () => {
    expect(normalizeRichTextNodes('<!-- hidden --><custom><b>visible</b></custom>')).toEqual([{
      type: 'element',
      name: 'b',
      attrs: {},
      children: [{ type: 'text', text: 'visible' }],
    }])
  })
})
