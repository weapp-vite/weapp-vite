import type { CorpusProfile } from '../types'
import { randomFor } from './random'
import { generatePublicXmlCase } from './xml'

export const formalFuzzBudget = Object.freeze({ valid: 100_000, invalid: 100_000, editSequences: 10_000, editSteps: 8 })
export const defaultFuzzSeed = 0x5EED2026

export { randomFor } from './random'

export interface GeneratedCase {
  source: string
  shape: unknown[]
  scenarios: string[]
}

/** 预期结构由生成语法构造，不调用被测 parser 产生预言。 */
export function generateValidCase(seed: number, index: number, profile: CorpusProfile, reduction = 0, publicXml = index % 5 === 0): GeneratedCase {
  if (publicXml) {
    return generatePublicXmlCase(seed, index, profile, reduction)
  }
  const random = randomFor(seed, index)
  const width = reduction > 0 ? 1 : 1 + random(4)
  const depth = reduction > 1 ? 1 : 1 + random(4)
  const text = reduction > 2 ? 'x' : ['ASCII', '中文😀', '&amp;&lt;&#x1F600;', '{{items[index]}}', '{{({n: 1}).n}}', '{{ /[}]/.test(text) }}', '\r\n\t'][random(7)]!
  const value = ['plain', '中文😀', 'one &amp; two', '{{value + 1}}'][random(4)]!
  const semanticValue = value === 'one &amp; two' ? 'one & two' : value
  const shape: unknown[] = []
  const names: string[] = []
  let source = ''
  const scenarios = ['ordered-duplicates', 'bare', 'empty', 'unquoted', `text-${text.startsWith('{{') ? 'binding' : text.includes('&') ? 'entity' : 'literal'}`, `syntax-${profile.syntax}`]
  for (let level = 0; level < depth; level++) {
    const name = `view-${random(1_000_000)}`
    names.push(name)
    source += `<${name} data-v="${value}" data-v='second' bare empty="" unquoted=ok>`
    shape.push(['open', name, false, [['data-v', semanticValue], ['data-v', 'second'], ['bare', null], ['empty', ''], ['unquoted', 'ok']]])
  }
  for (let child = 0; child < width; child++) {
    source += `<item index="${child}" />${text}`
    shape.push(['open', 'item', true, [['index', String(child)]]], ['close', 'item', true], ['text', text, undefined], ['leave', text, undefined])
  }
  const opaque = ['<!-- <fake a="b"/> -->', '<![CDATA[<fake>{{ignored}}</fake>]]>'][random(2)]!
  const kind = opaque.startsWith('<!--') ? 'comment' : 'cdata'
  if (reduction < 3) {
    source += opaque
    shape.push([kind, opaque, undefined], ['leave', opaque, undefined])
    scenarios.push(kind)
  }
  if (reduction < 3 && profile.rawTags.length && random(2)) {
    const tag = profile.rawTags[random(profile.rawTags.length)]!
    const script = `const fake = "</${tag}>"; const text = '<fake/>'; module.exports = ${random(100)};`
    source += `<${tag}>${script}</${tag}>`
    shape.push(['open', tag, false, []], ['script', script, tag], ['leave', script, tag], ['close', tag, false])
    scenarios.push(`raw-${tag}`, 'pseudo-script-close')
  }
  for (const name of names.reverse()) {
    source += `</${name}>`
    shape.push(['close', name, false])
  }
  return { source, shape, scenarios }
}

/** 每种变异具有独立语法证明，不把任意随机字节破坏自动判为无效。 */
export function generateInvalidCase(seed: number, index: number, profile: CorpusProfile) {
  const valid = generateValidCase(seed, index, profile).source
  const variants = [
    { source: `<corpus>${valid}</wrong>`, witness: '</wrong>', code: 'template/mismatched-tag', scenario: 'mismatched-close' },
    { source: `<corpus>${valid}`, witness: '<corpus>', code: 'template/unclosed-tag', scenario: 'missing-close' },
    { source: `${valid}<view value="unterminated`, witness: '<view value="unterminated', code: 'template/invalid-syntax', scenario: 'unterminated-attribute' },
    { source: `${valid}<!--unterminated`, witness: '<!--unterminated', code: 'template/invalid-syntax', scenario: 'unterminated-comment' },
    { source: `${valid}{{([)]}}`, witness: '{{([)]}}', code: 'template/invalid-interpolation', scenario: 'mismatched-binding' },
    { source: `${valid}<view x=>`, witness: '<view x=>', code: 'template/invalid-syntax', scenario: 'missing-attribute-value' },
    { source: `${valid}</view illegal>`, witness: '</view illegal>', code: 'template/invalid-syntax', scenario: 'closing-attributes' },
    { source: `${valid}{{ 'unterminated }}`, witness: '{{ \'unterminated }}', code: 'template/invalid-syntax', scenario: 'unterminated-binding-string' },
  ]
  return variants[index % variants.length]!
}
