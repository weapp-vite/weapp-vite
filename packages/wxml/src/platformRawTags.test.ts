import type { ElementNode, Platform } from './types'
import { describe, expect, it } from 'vitest'
import { edit, parse, serialize } from './index'

describe('platform-owned script tags', () => {
  it.each([['jd', 'jds'], ['qq', 'qs']] as const)('recognizes %s %s without turning pseudo tags into template elements', (platform, tag) => {
    const source = `<${tag} module="m">var text="</${tag}><fake/>"; module.exports = {};</${tag}><view/>`
    const document = parse(source, { platform })
    expect(document.diagnostics).toEqual([])
    expect((document.children[0] as ElementNode).children).toMatchObject([{ kind: 'script', tagName: tag }])
    expect(document.children).toHaveLength(2)
    expect(serialize(document)).toBe(source)
    const next = edit(document, (handle) => {
      if (handle.node.kind === 'script') {
        handle.insertBefore('var added="<view/>";')
      }
    })
    expect(serialize(next)).toContain('var added="<view/>";')
    expect(parse(serialize(next), { platform }).diagnostics).toEqual([])
  })

  it.each(['weapp', 'alipay', 'tt', 'swan', 'xhs', 'ks', 'ty'] satisfies Platform[])('retains same-name custom components on %s', (platform) => {
    const document = parse('<jds><view/></jds><qs><text/></qs>', { platform })
    expect(document.diagnostics).toEqual([])
    expect((document.children[0] as ElementNode).children[0]?.kind).toBe('element')
    expect((document.children[1] as ElementNode).children[0]?.kind).toBe('element')
  })

  it('honors an explicit empty raw-tag override and invalidates raw-owner renames', () => {
    expect((parse('<jds><view/></jds>', { platform: 'jd', rawTags: [] }).children[0] as ElementNode).children[0]?.kind).toBe('element')
    expect(() => edit(parse('<jds>var n=left<right;</jds>', { platform: 'jd' }), (handle) => {
      if (handle.node.kind === 'element') {
        handle.rename('custom')
      }
    })).toThrow()
  })
})
