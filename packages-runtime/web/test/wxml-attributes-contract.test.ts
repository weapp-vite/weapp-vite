import { describe, expect, it } from 'vitest'
import {
  extractFor,
  isConditionalElement,
  renderAttributes,
  resolveComponentTagName,
  stripControlAttributes,
} from '../src/compiler/wxml/attributes'

describe('WXML attribute contracts', () => {
  it('extracts loop aliases, keys and non-control attributes', () => {
    expect(extractFor({ 'class': 'list', 'wx:for': '{{items}}' })).toEqual({
      expr: '{{items}}',
      indexName: 'index',
      itemName: 'item',
      key: undefined,
      restAttribs: { class: 'list' },
    })
    expect(extractFor({
      'a:for': '{{items}}',
      'a:for-index': ' row ',
      'a:for-item': ' row ',
      'a:key': 'id',
      'data-kind': 'item',
    })).toEqual({
      expr: '{{items}}',
      indexName: 'rowIndex',
      itemName: 'row',
      key: 'id',
      restAttribs: { 'data-kind': 'item' },
    })
  })

  it('identifies conditional elements and strips every control attribute', () => {
    expect(isConditionalElement({ type: 'text', data: 'text' })).toBe(false)
    expect(isConditionalElement({ type: 'element', name: 'view' } as never)).toBe(false)
    expect(isConditionalElement({ type: 'element', name: 'view', attribs: { 'wx:if': 'ready' } })).toBe(true)
    expect(isConditionalElement({ type: 'element', name: 'view', attribs: { 'a:elif': 'ready' } })).toBe(true)
    expect(isConditionalElement({ type: 'element', name: 'view', attribs: { 'tt:else': '' } })).toBe(true)
    expect(stripControlAttributes({ 'class': 'card', 'wx:if': 'ready', 'wx:key': 'id' }))
      .toEqual({ class: 'card' })
  })

  it('resolves component tags with exact and normalized aliases', () => {
    expect(resolveComponentTagName('card')).toBeUndefined()
    expect(resolveComponentTagName('Card', { Card: 'wv-card-exact', card: 'wv-card' })).toBe('wv-card-exact')
    expect(resolveComponentTagName('CARD', { card: 'wv-card' })).toBe('wv-card')
    expect(resolveComponentTagName('missing', { card: 'wv-card' })).toBeUndefined()
  })

  it('renders event flags and property or attribute bindings', () => {
    const rendered = renderAttributes({
      'aria-label': 'Label',
      'bindtap': 'handleTap',
      'capture-catch:longpress': 'handleLong',
      'class': 'card',
      'data-id': '{{id}}',
      'custom-value': '{{value}}',
      'title': 'Title',
      'wx:if': '{{ready}}',
    }, 'scope', 'wxs', {
      preferProperty: false,
      propertyAttributes: ['custom-value'],
      skipControl: true,
    })
    expect(rendered).toContain('@click=')
    expect(rendered).toContain('"catch":false')
    expect(rendered).toContain('@longpress=')
    expect(rendered).toContain('"capture":true')
    expect(rendered).toContain('.customValue=')
    expect(rendered).toContain(' data-id=')
    expect(rendered).toContain(' aria-label=')
    expect(rendered).toContain(' class=')
    expect(rendered).not.toContain('wx:if')

    const preferred = renderAttributes({
      'id': 'root',
      'slot': 'content',
      'style': 'color:red',
      'value': null as any,
      'wx:if': 'ready',
    }, 'scope', 'wxs', { preferProperty: true })
    expect(preferred).toContain('.value=')
    expect(preferred).toContain(' @if=')
    expect(preferred).not.toContain('.id=')
    expect(renderAttributes({ bindtap: null as any }, 'scope', 'wxs')).toContain('@click=')
    expect(renderAttributes({ plain: 'value' }, 'scope', 'wxs')).toContain(' plain=')
  })
})
