import type { Fixture } from './types'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import * as wxml from '../../packages/wxml/src'
import { supplementFixtures } from './fixtures'
import { readPolicy } from './freeze'
import { createOperations } from './operations'

const require = createRequire(new URL('../../packages/wxml/package.json', import.meta.url))
const html = require('htmlparser2')
const render = require('dom-serializer').default

function fixture(source: string): Fixture {
  return { id: 'test', sha256: 'test', bytes: source.length, origins: ['test.wxml'], source, platform: 'weapp', cohort: 'shared', size: 'small' }
}

describe('WXML benchmark semantic oracle', () => {
  it.each([
    '<view title="&quot;quoted&quot; &amp; &apos;single&apos;" empty="" bare/>',
    '<view title="first" title="second" constructor="value"/>',
    '<view><text>A &amp; B</text><!--comment--><![CDATA[<raw>]]></view>',
  ])('compares lexical attribute values and complete tree semantics: %s', (source) => {
    const file = fixture(source)
    for (const operation of createOperations({ wxml, html, render }, [file])) {
      const result = operation.verify!(file)
      expect(result, operation.id).toMatchObject({ equal: true })
      expect(result.candidate, operation.id).toBe(result.baseline)
    }
  })

  it('keeps duplicate attribute first-value semantics and special object keys', () => {
    const file = fixture('<view title="first &amp;" title="second" __proto__="kept"/>')
    const scan = createOperations({ wxml, html, render }, [file]).find(operation => operation.id === 'scan')!
    const [, attributes] = (scan.run(file, 'candidate') as Array<[string, Record<string, string>]>)[0]!
    expect(attributes.title).toBe('first &')
    expect(Object.hasOwn(attributes, '__proto__')).toBe(true)
    expect(Reflect.get(attributes, '__proto__')).toBe('kept')
    expect(scan.verify!(file).equal).toBe(false)
  })

  it('reports old processing-instruction index and serializer differences instead of normalizing them away', () => {
    const file = fixture('<?xml version="1.0"?><view/>')
    const operations = createOperations({ wxml, html, render }, [file])
    const parse = operations.find(operation => operation.id === 'parse')!.verify!(file)
    expect(parse.equal).toBe(false)
    const followingTag = file.source.indexOf('<view')
    expect(JSON.parse(parse.candidate)).toContainEqual(['directive', '?xml version="1.0"', [0, followingTag]])
    expect(JSON.parse(parse.baseline)).toContainEqual(['directive', '?xml version="1.0"', [0, followingTag - 1]])
    const canonical = operations.find(operation => operation.id === 'canonical')!
    expect(canonical.verify!(file).equal).toBe(false)
  })

  it('checks generated quoted and numeric entities in attributes and text', async () => {
    const file = supplementFixtures([], await readPolicy()).find(file => file.pressureId === 'stress-entities-16')!
    for (const operation of createOperations({ wxml, html, render }, [file])) {
      expect(operation.verify!(file).equal, operation.id).toBe(true)
    }
  })

  it('compares raw entities and common UTF-16 node ranges without decoding outside the timer', () => {
    const file = fixture('😀<view title="&amp; &#32; &#x1f600;">&lt;text&gt;<!--note--><![CDATA[&amp;]]><text /></view>')
    const decodeAttribute = vi.fn(wxml.decodeAttribute)
    const operations = createOperations({ wxml: { ...wxml, decodeAttribute }, html, render }, [file])
    const parse = operations.find(operation => operation.id === 'parse')!
    const result = parse.verify!(file)
    expect(result.candidate).toBe(result.baseline)
    expect(decodeAttribute).not.toHaveBeenCalled()
    const projection = JSON.parse(result.candidate) as unknown[][]
    expect(projection).toContainEqual(['text', '😀', [0, 2]])
    expect(projection).toContainEqual(['element', 'view', { title: '&amp; &#32; &#x1f600;' }, [file.source.indexOf('<view'), file.source.length]])
    expect(projection).toContainEqual(['text', '&lt;text&gt;', [file.source.indexOf('&lt;'), file.source.indexOf('<!--')]])
    const baseline = parse.run(file, 'baseline') as { children: Array<{ data?: string, attribs?: Record<string, string> }> }
    expect(baseline.children[1]!.attribs!.title).toBe('&amp; &#32; &#x1f600;')
    expect(operations.find(operation => operation.id === 'scan')!.run(file, 'candidate')).toContainEqual(['view', { title: '&   😀' }])
    expect(decodeAttribute).toHaveBeenCalled()
  })

  it('fails parse parity when only a common source position changes', () => {
    const file = fixture('😀<view title="&amp;">text</view>')
    const changed = { ...wxml, parse: (source: string, options?: Parameters<typeof wxml.parse>[1]) => {
      const document = wxml.parse(source, options)
      return { ...document, children: document.children.map((node, index) => index === 1 ? { ...node, end: node.end - 1 } : node) }
    } }
    const parse = createOperations({ wxml: changed, html, render }, [file]).find(operation => operation.id === 'parse')!
    expect(parse.verify!(file).equal).toBe(false)
  })

  it('keeps decoded serializer trees distinct from raw parse trees', () => {
    const file = fixture('<view title="&amp;amp;">&#65; &amp;amp;</view>')
    const operations = createOperations({ wxml, html, render }, [file])
    const canonical = operations.find(operation => operation.id === 'canonical')!
    expect(canonical.run(file, 'baseline')).toBe('<view title="&amp;amp;">A &amp;amp;</view>')
    expect(canonical.run(file, 'candidate')).toBe(file.source)
    expect(canonical.verify!(file).equal).toBe(true)
    expect(operations.find(operation => operation.id === 'parse-edit-serialize')!.verify!(file).equal).toBe(true)
  })

  it.each([
    ['<view>&#32;</view>', '<view data-wxml-benchmark="edited">wxml benchmark text</view>'],
    ['<view><![CDATA[keep]]>&#32;<text>tail</text></view>', '<view data-wxml-benchmark="edited"><![CDATA[keep]]>wxml benchmark text<text>tail</text></view>'],
    ['<view><![CDATA[keep]]></view>', '<view data-wxml-benchmark="edited"><![CDATA[keep]]></view>'],
    ['<view> \n<text>tail</text></view>', '<view data-wxml-benchmark="edited"> \n<text>wxml benchmark text</text></view>'],
  ])('edits the same first nonblank original-source text: %s', (source, expected) => {
    const file = fixture(source)
    const edit = createOperations({ wxml, html, render }, [file]).find(operation => operation.id === 'parse-edit-serialize')!
    expect(edit.run(file, 'baseline')).toBe(expected)
    expect(edit.run(file, 'candidate')).toBe(expected)
    expect(edit.verify!(file).equal).toBe(true)
  })

  it('leaves WXML raw-script editing differences visible', () => {
    const file = fixture('<wxs>opaque</wxs><text>tail</text>')
    file.cohort = 'wxml'
    const edit = createOperations({ wxml, html, render }, [file]).find(operation => operation.id === 'parse-edit-serialize')!
    expect(edit.verify!(file).equal).toBe(false)
  })
})
