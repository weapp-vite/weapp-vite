import { parseWxmlTokens } from './tokenScanner'

function scan(source: string) {
  return parseWxmlTokens({ source, platform: 'weapp', excludeComponent: () => false }).token
}

describe('shared build token views', () => {
  it('collects native JD dependencies and keeps JDS scripts out of portable rewrites', () => {
    const source = '<jds src="./utils.jds" module="utils"/><jds module="inline">var html="</jds><fake/>";</jds><view/>'
    const token = parseWxmlTokens({ source, platform: 'jd', excludeComponent: () => false }).token
    expect(token.deps.map(({ tagName, value }) => [tagName, value])).toEqual([['jds', './utils.jds']])
    expect(token.scriptModules?.map(({ tagName }) => tagName)).toEqual(['jds', 'jds'])
    expect(token.components.fake).toBeUndefined()
    expect(token.wxsImportNormalizeTokens).toEqual([])
    expect(token.scriptModuleTagTokens).toEqual([])
    expect(scan('<jds src="./ordinary.jds"><child/></jds>').deps).toEqual([])
    expect(scan('<jds><child/></jds>').components.child).toBeDefined()
  })

  it.each(['lang="ts"', 'lang="js"', 'lang="typescript"', 'src="./utils.ts"', 'src="./utils.js"', 'src="./utils.jds.ts"', 'src="./utils.jds.mts"'])('rejects unsupported compiled JDS inputs: %s', (attribute) => {
    expect(() => parseWxmlTokens({ source: `<jds ${attribute}/>`, platform: 'jd', excludeComponent: () => false })).toThrow('only supports native .jds scripts without lang')
  })

  it('preserves close-event component order and legacy range offsets', () => {
    const source = 'lead<Parent><Inner /></Parent>'
    const token = scan(source)
    expect(Object.keys(token.components)).toEqual(['Inner', 'Parent'])
    expect(token.components.Inner).toEqual([{ start: source.indexOf('<Inner'), end: source.indexOf('</Parent>') }])
    expect(token.components.Parent).toEqual([{ start: 0, end: source.length }])
  })

  it('preserves multiline closing-tag offsets without leaking markup into text', () => {
    const source = '<Panel>body</Panel \n>tail'
    const token = scan(source)
    const legacyCloseEnd = source.indexOf('</Panel') + '</Panel'.length + 1
    expect(token.components.Panel).toEqual([{ start: 0, end: legacyCloseEnd }])
    expect(token.templateTokens).toEqual([
      { start: source.indexOf('body'), end: source.indexOf('</Panel'), value: 'body' },
      { start: legacyCloseEnd, end: source.length, value: 'tail' },
    ])
  })

  it('keeps per-attribute dependency values and the legacy final-value attribute view', () => {
    const token = scan('<include src="first.wxml" src="second.wxml" />')
    expect(token.deps.map(({ value }) => value)).toEqual(['first.wxml', 'second.wxml'])
    expect(token.deps.map(({ attrs }) => attrs)).toEqual([
      { src: 'second.wxml' },
      { src: 'second.wxml' },
    ])
  })

  it('preserves the first entity callback offset after a multiline closing tag', () => {
    const source = '<Panel></Panel \n>&amp;tail'
    const token = scan(source)
    const entityEnd = source.indexOf('&amp;') + '&amp;'.length
    expect(token.templateTokens).toEqual([
      { start: source.indexOf('</Panel') + '</Panel'.length + 1, end: entityEnd, value: '&' },
      { start: entityEnd, end: source.length, value: 'tail' },
    ])
  })

  it('retains first script-module values while collecting each duplicate callback', () => {
    const token = scan('<wxs module="a" module="b" src="one.wxs.ts" src="two.wxs.ts" lang="bad" lang="ts">let a=1</wxs>')
    expect(token.scriptModules).toEqual([{ tagName: 'wxs', attrs: { module: 'a', src: 'one.wxs.ts', lang: 'bad' } }])
    expect(token.wxsImportNormalizeTokens.map(({ value }) => value)).toEqual(['one.wxs.ts', 'one.wxs.ts'])
    expect(token.inlineWxsTokens.map(({ value }) => value)).toEqual(['let a=1'])
  })

  it('preserves quoted and unquoted backslashes while decoding XML entities', () => {
    const token = scan(String.raw`<include src=foo\bar.wxml /><include src="foo\\bar.wxml" />`)
    expect(token.deps.map(({ value }) => value)).toEqual([String.raw`foo\bar.wxml`, String.raw`foo\\bar.wxml`])
  })

  it('recognizes self-closing syntax beside an unquoted dependency value', () => {
    const source = '<include src=foo.wxml/><view />'
    const token = scan(source)
    expect(token.deps.map(({ value }) => value)).toEqual(['foo.wxml'])
    expect(token.components.include).toEqual([{ start: 0, end: source.indexOf('<view') }])
  })

  it.each(['weapp', 'alipay'] as const)('keeps generated XML escape rules for the %s target', (platform) => {
    const source = String.raw`<include src="folder\" /><Next />`
    const token = parseWxmlTokens({ source, platform, excludeComponent: () => false }).token
    expect(token.deps.map(({ value }) => value)).toEqual(['folder\\'])
    expect(Object.keys(token.components)).toEqual(platform === 'weapp' ? ['include', 'Next'] : ['include', 'next'])
  })

  it('keeps script attributes owned by their own tag and omits empty text callbacks', () => {
    expect(scan('<wxs lang="ts"></wxs>').inlineWxsTokens).toEqual([])
    expect(scan('<view lang="ts"><wxs>var a=1</wxs></view>').inlineWxsTokens).toEqual([])
    const token = scan('<script>const title="{{ secret }}"</script><view>{{ shown }}</view>')
    expect(token.templateTokens?.map(({ value }) => value)).toEqual(['{{ shown }}'])
  })

  it('preserves entity callback ranges and CDATA text for i18n consumers', () => {
    const source = '<view>a&amp;b&#32;c</view><![CDATA[d & e]]>'
    const token = scan(source)
    expect(token.templateTokens).toEqual([
      { start: 6, end: 7, value: 'a' },
      { start: 7, end: 12, value: '&' },
      { start: 12, end: 13, value: 'b' },
      { start: 13, end: 18, value: ' ' },
      { start: 18, end: 19, value: 'c' },
      { start: source.indexOf('<![CDATA['), end: source.length, value: 'd & e' },
    ])
  })

  it('keeps special attribute and component names as own dictionary entries', () => {
    const token = scan('<__proto__ constructor="c" __proto__="p" />')
    expect(Object.hasOwn(token.components, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(token.components)).toBeNull()
  })

  it('rejects malformed structure with a source offset', () => {
    expect(() => scan('<view><text></view>')).toThrow(/\[weapp\.wxml\] \d+:/)
  })

  it('retains the legacy escape diagnostic without recovering malformed structure', () => {
    const source = String.raw`<view title="\"legacy\"" />`
    expect(scan(source).glassEaselFindings).toEqual([
      expect.objectContaining({ code: 'GE004', severity: 'error', start: source.indexOf('title=') }),
    ])
    expect(() => scan(String.raw`<view title="\"legacy\""><text></view>`)).toThrow(/\[weapp\.wxml\] \d+:/)
  })

  it('reports each complete escaped attribute once while preserving following components', () => {
    const source = String.raw`<view title="\"legacy\"" label='\'other\'' /><Next />`
    const token = scan(source)
    expect(token.glassEaselFindings).toEqual([
      expect.objectContaining({ code: 'GE004', severity: 'error', start: source.indexOf('title=') }),
      expect.objectContaining({ code: 'GE004', severity: 'error', start: source.indexOf('label=') }),
    ])
    expect(Object.keys(token.components)).toEqual(['view', 'Next'])
  })
})
