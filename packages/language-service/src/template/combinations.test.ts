/* eslint-disable no-template-curly-in-string -- 用例刻意覆盖模板字符串中的伪闭合标签。 */
import { describe, expect, it } from 'vitest'
import { languageProfiles } from '../profiles'
import { LanguageError } from '../types'
import { analyzeTemplate, formatTemplate } from './index'

function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

describe('seeded lossless template combinations', () => {
  it.each(languageProfiles)('audits $platform protected tokens and idempotence with seed 0x5eed2026', (profile) => {
    const next = random(0x5EED2026)
    const { directives: d, scriptModule } = profile
    const texts = ['😀  中文  text', 'left < right &amp; &#32; right', 'line one\r\n  line two', ' {{ `value${{key: "}}"}.key}` }} ']
    const values = ['{{ rows }}', '{{ [{x: 1}, {x: 2}] }}', '{{ ok ? rows : others }}']
    const widths = [20, 40, 80, 120]
    const configurations = new Set<string>()
    for (let sample = 0; sample < 128; sample++) {
      const newline = next() & 1 ? '\r\n' : '\n'
      const quote = next() & 1 ? '"' : '\''
      const text = texts[next() % texts.length]
      const collection = values[next() % values.length]
      const moduleTag = scriptModule.tag
      const script = `var marker = "</${moduleTag}><view/>"; /* </${moduleTag}> */ var pattern = /[}]{2}/;`
      const source = `${sample % 3 === 0 ? '\uFEFF' : ''}<!-- 😀 {{ opaque }} -->${newline}<![CDATA[<view>  unchanged  </view>]]><view   ${d.for}=${quote}${collection}${quote} ${d.forItem}="row" data-vendor="plain  text" data-vendor="duplicate">${text}<text title="{{ {x: 1, y: 2} }}">text  preserved</text></view><${moduleTag} lang="js" ${scriptModule.moduleAttribute}="tools">${script}</${moduleTag}>${newline}`
      const fileName = `page${profile.templateExtensions[0]}`
      const options = { printWidth: widths[next() % widths.length], singleAttributePerLine: !!(next() & 1), bracketSameLine: !!(next() & 1), useTabs: !!(next() & 1) }
      configurations.add(JSON.stringify([newline, quote, text, collection, options]))
      const before = analyzeTemplate({ source, fileName })
      const formatted = formatTemplate(source, fileName, options)
      const after = analyzeTemplate({ source: formatted, fileName })
      const protectedSlices = (value: string, analysis: typeof before) => analysis.tokens.filter(token => token.kind !== 'tag').map(token => value.slice(token.start, token.end))
      const attributes = (analysis: typeof before) => analysis.elements.map(tag => tag.attributes.map(attribute => [attribute.name, attribute.rawValue]))
      expect(before.valid, `source ${sample}`).toBe(true)
      expect(after.valid, `formatted ${sample}`).toBe(true)
      expect(protectedSlices(formatted, after), `protected ${sample}`).toEqual(protectedSlices(source, before))
      expect(attributes(after), `attributes ${sample}`).toEqual(attributes(before))
      expect(formatTemplate(formatted, fileName, options), `idempotence ${sample}`).toBe(formatted)
      expect(() => formatTemplate(source.replace(collection, '{{ rows + }}'), fileName, options), `invalid ${sample}`).toThrow(LanguageError)
    }
    expect(configurations.size).toBeGreaterThan(80)
  })
})
