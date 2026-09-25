import type { WxmlTransformNode } from '../../types'
import { describe, expect, it } from 'vitest'
import { createWxmlRemover } from '../remove'
import { editWxml } from './editor'

const file = 'pages/editor/index.wxml'

describe('structured WXML editing', () => {
  it('changes only selected attributes and preserves all other bytes', async () => {
    const code = '<!-- keep -->\r\n<view\tdata-test = \'原值\' keep="&quot;" ><text data-test="保留">child</text></view>'
    const output = await editWxml(code, file, 'legacy', (node) => {
      if (node.tagName === 'view') {
        expect(node.getAttribute('data-test')).toEqual({ name: 'data-test', rawValue: '原值', quote: '\'' })
        node.renameAttribute('data-test', 'data-track')
      }
    })
    expect(output).toBe(code.replace('data-test =', 'data-track ='))
  })

  it('awaits visitors in source order and exposes current parent state', async () => {
    const visited: string[] = []
    const output = await editWxml('<view><text/></view><view/>', file, 'legacy', async (node) => {
      await Promise.resolve()
      visited.push(`${node.parent?.tagName ?? 'root'}/${node.tagName}`)
      if (node.tagName === 'view') {
        node.renameTag('cover-view')
        expect(node.tagName).toBe('cover-view')
      }
    })
    expect(visited).toEqual(['root/view', 'cover-view/text', 'root/view'])
    expect(output).toBe('<cover-view><text/></cover-view><cover-view/>')
  })

  it('collapses duplicate setters, removes all duplicates and distinguishes false from a valueless attribute', async () => {
    const output = await editWxml('<button size="mini" size="default" debug debug="yes"/>', file, 'legacy', (node) => {
      node.setAttribute('size', 'default')
      node.removeAttribute('debug')
      node.setAttribute('disabled', false)
      node.setBooleanAttribute('plain')
      expect(node.getAttribute('disabled')?.rawValue).toBe('{{false}}')
      expect(node.getAttribute('plain')?.rawValue).toBeNull()
      expect(node.attributes.map(attr => attr.name)).toEqual(['size', 'disabled', 'plain'])
    })
    expect(output).toBe('<button size="default"    disabled="{{false}}" plain/>')
  })

  it('keeps renamed dynamic values and reports target collisions', async () => {
    const source = '<my-card from = \'hello {{name}}\'/>'
    expect(await editWxml(source, file, 'legacy', node => node.renameAttribute('from', 'to')))
      .toBe('<my-card to = \'hello {{name}}\'/>')
    await expect(editWxml('<view from="a" to="b"/>', file, 'legacy', node => node.renameAttribute('from', 'to')))
      .rejects
      .toThrow('existing attribute to')
  })

  it('skips descendants of deleted nodes without visiting WXS bodies', async () => {
    const visited: string[] = []
    const code = '<view><debug><text/></debug><wxs module="x">var s = "<text/>";</wxs></view>'
    expect(await editWxml(code, file, 'legacy', (node) => {
      visited.push(node.tagName)
      if (node.tagName === 'debug') {
        node.remove()
      }
    })).toBe('<view><wxs module="x">var s = "<text/>";</wxs></view>')
    expect(visited).toEqual(['view', 'debug', 'wxs'])
  })

  it('reports CRLF positions and closes retained handles after editing', async () => {
    let retained: WxmlTransformNode | undefined
    await editWxml('<!-- keep -->\r\n  <view/>', file, 'legacy', (node) => {
      retained = node
      expect(node.location).toEqual({ offset: 17, line: 2, column: 3 })
    })
    expect(() => retained!.setAttribute('title', 'late')).toThrow('no longer editable')
    expect(Object.isFrozen(retained!.attributes)).toBe(true)
  })

  it.each(['wx:if', 'bindtap', 'data-wi-tap', '__wvSlotOwnerId'])('protects %s from modification, removal and destination rename', async (name) => {
    const code = `<view ${name}="keep" plain="value"/>`
    await expect(editWxml(code, file, 'legacy', node => node.removeAttribute(name))).rejects.toThrow('protected attribute')
    await expect(editWxml(code, file, 'legacy', node => node.setAttribute(name, 'change'))).rejects.toThrow('protected attribute')
    await expect(editWxml('<view plain="value"/>', file, 'legacy', node => node.renameAttribute('plain', name))).rejects.toThrow('protected attribute')
  })

  it('protects generated class values and structural tag destinations', async () => {
    await expect(editWxml('<view class="__wv-ref-0"/>', file, 'legacy', node => node.setAttribute('class', 'other'))).rejects.toThrow('protected attribute')
    await expect(editWxml('<view/>', file, 'legacy', node => node.setAttribute('class', '__wv-ref-0'))).rejects.toThrow('protected attribute')
    await expect(editWxml('<view/>', file, 'legacy', node => node.renameTag('wxs'))).rejects.toThrow('structural tag')
    await expect(editWxml('<slot/>', file, 'legacy', node => node.remove())).rejects.toThrow('structural tag')
  })

  it('rejects partial conditional-chain removal but allows the whole enclosing subtree', async () => {
    const code = '<view><debug wx:if="{{ok}}"/><text wx:else/></view>'
    await expect(editWxml(code, file, 'legacy', (node) => {
      if (node.tagName === 'debug') {
        node.remove()
      }
    })).rejects.toThrow('chain')
    expect(await editWxml(code, file, 'legacy', node => node.remove())).toBe('')
  })

  it.each(['legacy', 'xml'] as const)('encodes literals, expressions and typed values for %s and remains readable by the cleanup scanner', async (syntax) => {
    const output = await editWxml('<view/>', file, syntax, (node) => {
      node.setAttribute('title', '中文 & "单\'双" \\')
      node.setAttribute('literal', '{{ notExpression }}')
      node.setAttribute('count', 42)
      node.setAttribute('mixed', { expression: `ok ? "{{" : '}}'` })
    })
    expect(output).toContain('count="{{42}}"')
    expect(output).toContain(syntax === 'xml' ? '中文 &amp;' : '中文 &')
    expect(output).toContain(`literal="{{'{'}}{{'{'}} notExpression }}"`)
    expect(createWxmlRemover({ attr: ['title', 'literal', 'count', 'mixed'] })(output, file, syntax)).toBe('<view    />')
  })

  it('preserves syntax and comments without edits and rejects malformed names', async () => {
    const source = '<?xml version="1.0"?><view a=unquoted flag><![CDATA[<text/>]]></view>'
    expect(await editWxml(source, file, 'xml', () => {})).toBe(source)
    await expect(editWxml('<view/>', file, 'legacy', node => node.renameTag('view><text'))).rejects.toThrow('Invalid template name')
  })
})
