import type { CorpusProfile } from '../types'
import type { GeneratedCase } from './generator'
import { randomFor } from './random'

/** 既有合法预算中固定五分之一使用独立公共 XML 生成语法。 */
export function generatePublicXmlCase(seed: number, index: number, profile: CorpusProfile, reduction = 0): GeneratedCase {
  const random = randomFor(seed ^ 0x584D4C, index)
  const width = reduction ? 1 : 1 + random(4)
  const name = `Page-${random(1_000_000)}`
  const value = random(1_000_000)
  const text = ['plain 中文😀', 'one &amp; two &lt; three', '&#x1F600;&#128512;', '\r\n\t'][random(4)]!
  let source = `<${name} data-id="${value}" title='one &amp; two' empty="" xml:space="preserve">`
  const shape: unknown[] = [['open', name, false, [['data-id', String(value)], ['title', 'one & two'], ['empty', ''], ['xml:space', 'preserve']]]]
  for (let child = 0; child < width; child++) {
    source += `<Item data-index="${child}" quote="&quot;value&quot;"/>${text}`
    shape.push(['open', 'Item', true, [['data-index', String(child)], ['quote', '"value"']]], ['close', 'Item', true], ['text', text, undefined], ['leave', text, undefined])
  }
  if (reduction < 2) {
    const comment = '<!-- public XML <opaque/> -->'
    const cdata = '<![CDATA[<opaque> & literal]]>'
    source += comment + cdata
    shape.push(['comment', comment, undefined], ['leave', comment, undefined], ['cdata', cdata, undefined], ['leave', cdata, undefined])
  }
  source += `</${name}>`
  shape.push(['close', name, false])
  return { source, shape, scenarios: ['public-xml-subset', 'xml-entities', 'quoted-ordered-attributes', `syntax-${profile.syntax}`] }
}
