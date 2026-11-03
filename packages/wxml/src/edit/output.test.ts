import type { EditableNode } from '../types'
import { describe, expect, it } from 'vitest'
import { parse } from '../parser'
import { serialize } from '../serialize'
import { edit } from './index'

describe('source edits by original ranges', () => {
  it('keeps distant subtrees byte-identical when retained ancestors are edited after descendants', () => {
    const source = '\uFEFF<root old=\'raw\'>\r\n<left><text >old</text ></left>\n<keep  a=unquoted><!-- intact --></keep >\n<right><text>tail</text></right>\r\n</root><outside />'
    const original = parse(source)
    let root: EditableNode | undefined
    const next = edit(original, (handle) => {
      const { node } = handle
      if (node.kind === 'element' && node.name === 'root') {
        root = handle
      }
      if (node.kind === 'text' && node.data === 'old') {
        handle.replaceText('new & value')
      }
      if (node.kind === 'text' && node.data === 'tail') {
        handle.replaceText('last')
        root!.setAttribute('marker', 'new')
      }
    })
    const expected = source.replace('<root old=\'raw\'>', '<root old=\'raw\' marker="new">')
      .replace('>old</text', '>new &amp; value</text')
      .replace('>tail</text', '>last</text')
    const canonical = serialize(next, { mode: 'canonical' })
    expect(canonical).toBe(serialize(parse(expected), { mode: 'canonical' }))
    expect(next.source).toBe(expected)
    expect(serialize(next)).toBe(expected)
    expect(next.children).toEqual(parse(expected).children)
    expect(serialize(next, { mode: 'canonical' })).toBe(canonical)
    const second = edit(next, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'outside') {
        handle.setBooleanAttribute('edited')
      }
    })
    expect(second.source).toBe(expected.replace('<outside />', '<outside  edited/>'))
    expect(original.source).toBe(source)
  })

  it.each(['replaceWith', 'insertBefore', 'insertAfter'] as const)('renders %s on an empty script at its zero-length original range', (operation) => {
    const source = '<before/><root><pad/><wxs module="m"></wxs><tail/></root><after/>'
    const body = 'var ok = left<right; var fake = "</wxs>";'
    let scriptCount = 0
    const next = edit(parse(source), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        handle.setAttribute('marker', 'shift')
      }
      if (handle.node.kind === 'element' && handle.node.name === 'pad') {
        handle.setBooleanAttribute('shifted')
      }
      if (handle.node.kind === 'script') {
        expect(handle.node.start).toBe(handle.node.end)
        scriptCount++
        handle[operation](body)
      }
    })
    expect(scriptCount).toBe(1)
    expect(next.source).toBe(source.replace('<root>', '<root marker="shift">')
      .replace('<pad/>', '<pad shifted/>')
      .replace('</wxs>', `${body}</wxs>`))
    const root = next.children[1]
    const owner = root?.kind === 'element' ? root.children[1] : undefined
    expect(owner?.kind === 'element' && owner.children).toMatchObject([{ kind: 'script', data: body }])
    expect(serialize(next, { mode: 'canonical' })).toBe('<before /><root marker="shift"><pad shifted /><wxs module="m">var ok = left<right; var fake = "</wxs>";</wxs><tail /></root><after />')
  })
})
