/* eslint-disable no-template-curly-in-string -- 输入语料包含待解析的模板字符串。 */
import type { Attribute, Node, Platform, Syntax } from './types'
import { describe, expect, it } from 'vitest'
import { decodeAttribute } from './decode'
import { parse } from './parser'
import { serialize } from './serialize'

const seed = 0x5EED2026
const platforms: Platform[] = ['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'qq', 'ks', 'ty']
const syntaxes: Syntax[] = ['legacy', 'xml']
const attributeFixtures = {
  legacy: [
    { source: String.raw`payload="quoted \"double\" and \\ slash"`, value: 'quoted "double" and \\ slash' },
    { source: String.raw`payload='single \'quote\' and "double"'`, value: 'single \'quote\' and "double"' },
    { source: 'payload="&amp;&#32;&quot;"', value: '& "' },
    { source: 'payload=plain', value: 'plain' },
    { source: 'payload="line 1\r\nline 2"', value: 'line 1\r\nline 2' },
  ],
  xml: [
    { source: 'payload="&amp;&#32;&quot;"', value: '& "' },
    { source: 'payload=\'a&apos;b &quot;c&quot;\'', value: 'a\'b "c"' },
    { source: String.raw`payload="slash\literal"`, value: String.raw`slash\literal` },
    { source: 'payload=plain', value: 'plain' },
    { source: 'payload="line 1\r\nline 2"', value: 'line 1\r\nline 2' },
  ],
}
const probes = [
  'probe="{{ /}}/.test(name) ? { nested: { html: \'<view/>\' } }.nested.html : \'}}\' }}"',
  'probe=\'{{ /[}]{2}/g.test(value) ? `x${{ x: "}}" }.x}` : a / b }}\'',
  'probe="{{ value + /* }} <fake/> */ other }}"',
  'probe="{{ value + // }} <fake/>\n other }}"',
]

function randomGenerator(initial: number) {
  let state = initial
  return (limit: number) => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) % limit
  }
}

function platformFixture(platform: Platform) {
  if (platform === 'alipay') {
    return { directive: 'a:if="{{ ready }}" onTap="select"', script: 'import-sjs' }
  }
  if (platform === 'swan') {
    return { directive: 's-for="row,pos in rows" s-if="row.ready"', script: 'import-sjs' }
  }
  const prefix = platform === 'weapp' ? 'wx' : platform === 'ty' ? 'ty' : platform
  return { directive: `${prefix}:if="{{ ready }}" bind:tap="select"`, script: platform === 'tt' || platform === 'ty' ? 'sjs' : platform === 'ks' ? 'ks' : 'wxs' }
}

function makeCorpus() {
  const random = randomGenerator(seed)
  const corpus: Array<{ platform: Platform, syntax: Syntax, id: number, source: string, payload: string }> = []
  for (const platform of platforms) {
    for (const syntax of syntaxes) {
      for (let id = 0; id < 12; id++) {
        const attribute = attributeFixtures[syntax][random(attributeFixtures[syntax].length)]!
        const probe = probes[random(probes.length)]!
        const fixture = platformFixture(platform)
        const scriptBody = `var marker = "</${fixture.script}><fake/>"; var re = /<view>/; /* fake </${fixture.script}> */ module.exports = { value: 1 };`
        const source = [
          id % 2 ? '\uFEFF' : '',
          '<?xml version="1.0"?><!-- fixed seed -->',
          `<root ${fixture.directive} ${attribute.source} ${probe} disabled empty="" dup=first dup='second'>`,
          'prefix {{ { nested: { tail: "}}" }, rows: [1, 2] }.nested.tail }} suffix',
          '<form><form><text>{{ /}}/.test(name) ? `x${{ value: "<fake/>" }.value}` : "other" }}</text></form></form>',
          `<${fixture.script} module="tools">${scriptBody}</${fixture.script}>`,
          '<![CDATA[ <ignored/> <!-- untouched --> ]]><custom slot="row" />',
          '</root>',
        ].join('')
        corpus.push({ platform, syntax, id, source, payload: attribute.value })
      }
    }
  }
  return corpus
}

function attributeValue(attribute: Attribute, syntax: Syntax) {
  return attribute.value === undefined ? undefined : decodeAttribute(attribute.value, syntax, true, attribute.quote)
}

function semanticTree(nodes: readonly Node[], syntax: Syntax): unknown[] {
  return nodes.map(node => node.kind === 'element'
    ? { name: node.name, selfClosing: node.selfClosing, attributes: node.attributes.map(attribute => ({ name: attribute.name, value: attributeValue(attribute, syntax) })), children: semanticTree(node.children, syntax) }
    : { kind: node.kind, data: node.data })
}

describe(`fixed-seed template combinations (${seed.toString(16)})`, () => {
  it.each(makeCorpus())('$platform/$syntax/$id preserves source and canonical semantics', ({ platform, syntax, source, payload }) => {
    const document = parse(source, { platform, syntax })
    expect(document.diagnostics).toEqual([])
    expect(document.tokens.map(token => source.slice(token.start, token.end)).join('')).toBe(source)
    expect(serialize(document)).toBe(source)
    const root = document.children.find(node => node.kind === 'element')!
    expect(root.kind).toBe('element')
    if (root.kind !== 'element') {
      throw new Error('Expected generated root element.')
    }
    expect(attributeValue(root.attributes.find(attribute => attribute.name === 'payload')!, syntax)).toBe(payload)
    expect(root.attributes.filter(attribute => attribute.name === 'dup').map(attribute => attribute.value)).toEqual(['first', 'second'])
    expect(root.attributes.find(attribute => attribute.name === 'disabled')?.value).toBeUndefined()
    expect(root.attributes.find(attribute => attribute.name === 'empty')?.value).toBe('')
    const canonical = serialize(document, { mode: 'canonical' })
    const reparsed = parse(canonical, { platform, syntax })
    expect(reparsed.diagnostics).toEqual([])
    expect(semanticTree(reparsed.children, syntax)).toEqual(semanticTree(document.children, syntax))
    expect(serialize(reparsed, { mode: 'canonical' })).toBe(canonical)
  })
})
