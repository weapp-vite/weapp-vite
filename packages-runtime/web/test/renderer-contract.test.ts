import type { RenderNode } from '../src/compiler/wxml/types'
import { describe, expect, it } from 'vitest'
import { Renderer } from '../src/compiler/wxml/renderer'

function element(name: string, attribs: Record<string, string> = {}, children: RenderNode[] = []): RenderNode {
  return { type: 'element', name, attribs, children }
}

describe('WXML renderer contracts', () => {
  it('renders empty, text, unknown and self-closing nodes', () => {
    const renderer = new Renderer()
    expect(renderer.renderNodes([], 'scope', 'wxs')).toBe('""')
    expect(renderer.renderNodes([{ type: 'text' }], 'scope', 'wxs')).toBe('""')
    expect(renderer.renderNodes([{ type: 'comment' } as unknown as RenderNode], 'scope', 'wxs')).toBe('""')
    expect(renderer.renderNodes([element('img', { src: '/cover.png' })], 'scope', 'wxs'))
      .toContain('<img')
    expect(renderer.renderNodes([
      element('image', {}, [{ type: 'text', data: 'fallback' }]),
    ], 'scope', 'wxs')).toContain('</weapp-image>')
  })

  it('separates interrupted conditional sequences and malformed leading branches', () => {
    const renderer = new Renderer()
    const interrupted = renderer.renderNodes([
      element('view', { 'wx:if': '{{first}}' }),
      { type: 'text', data: 'separator' },
      element('view', { 'wx:else': '' }),
    ], 'scope', 'wxs')
    expect(interrupted).toContain('ctx.eval("first"')
    expect(interrupted).toContain('separator')

    const separateIfs = renderer.renderNodes([
      element('view', { 'wx:if': '{{first}}' }),
      element('view', { 'wx:if': '{{second}}' }),
    ], 'scope', 'wxs')
    expect(separateIfs).toContain('ctx.eval("first"')
    expect(separateIfs).toContain('ctx.eval("second"')

    expect(renderer.renderNodes([
      element('view', { 'wx:elif': '{{orphan}}' }),
    ], 'scope', 'wxs')).toContain('<weapp-view')

    const emptySequence = (renderer as any).renderConditionalSequence([], 0, 'scope', 'wxs')
    expect(emptySequence).toEqual({ rendered: '""', endIndex: 0 })
  })

  it('renders full conditional chains, templates, loops, fragments and custom tags', () => {
    const renderer = new Renderer()
    const conditional = renderer.renderNodes([
      element('view', { 'wx:if': '{{first}}' }),
      element('view', { 'wx:elif': '{{second}}' }),
      element('view', { 'wx:else': '' }),
    ], 'scope', 'wxs')
    expect(conditional).toContain('ctx.eval("first"')
    expect(conditional).toContain('ctx.eval("second"')

    expect(renderer.renderNodes([
      element('template', { is: '{{name}}' }),
      element('template', { is: 'card', data: '{{value}}' }),
    ], 'scope', 'wxs')).toContain('ctx.mergeScope')

    const loop = renderer.renderNodes([
      element('block', {
        'wx:for': '{{items}}',
        'wx:for-item': 'entry',
        'wx:for-index': 'position',
      }, [element('card', {}, [{ type: 'text', data: '{{entry}}' }])]),
    ], 'outer', 'wxs', { card: 'wv-component-card' })
    expect(loop).toContain('outer_nested')
    expect(loop).toContain('<wv-component-card')
  })

  it('renders malformed parser nodes through stable fallbacks', () => {
    const renderer = new Renderer()
    const missingAttributes = { type: 'element', name: 'view' } as RenderNode
    expect((renderer as any).renderConditionalSequence(
      [missingAttributes],
      0,
      'scope',
      'wxs',
    ).rendered).toContain('weapp-view')
    expect((renderer as any).renderTemplateInvoke(
      { type: 'element', name: 'template' },
      'scope',
      'wxs',
    )).toContain('renderTemplate')
    expect(renderer.renderNodes([
      { type: 'element', children: [{ type: 'text' }] } as RenderNode,
      { type: 'element', name: 'block' } as RenderNode,
    ], 'scope', 'wxs')).toContain('html`<div')
  })
})
