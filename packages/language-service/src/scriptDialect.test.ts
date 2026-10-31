import { describe, expect, it } from 'vitest'
import { analyzeScript } from './script'

describe('native WXS and compiled source boundaries', () => {
  it('rejects a native dialect that belongs to another platform instead of borrowing defaults', () => {
    expect(analyzeScript('module.exports = {}', 'tools.sjs', { platform: 'weapp' }).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/platform-dialect')
    expect(analyzeScript('module.exports = {}', 'tools.sjs.ts', { platform: 'weapp' }).diagnostics).toEqual([])
    for (const platform of ['weapp', 'qq', 'jd', 'xhs'] as const) {
      expect(analyzeScript('module.exports = {}', 'tools.wxs', { platform }).diagnostics).toEqual([])
    }
    expect(analyzeScript('module.exports = {}', 'tools.wxs', { platform: 'alipay' }).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/platform-dialect')
    expect(analyzeScript('module.exports = {}', 'tools.ks', { platform: 'ks' }).diagnostics).toEqual([])
  })

  it.each([
    'const value = 1',
    'let value = 1',
    'var value = input => input',
    'class Value {}',
    'var value = `text`',
    'var { value } = input',
    'var [value] = input',
    'function value(...args) { return args }',
    'var value = { ...input }',
    'var value = input?.field',
    'var value = input?.()',
    'var value = input ?? 0',
    'async function value() { await task() }',
    'function* value() { yield 1 }',
    'for (var value of input) {}',
    'var value = 1n',
    'var value = 2 ** 3',
    'var value = { input }',
    'var value = { method() {} }',
    'var value = { [input]: 1 }',
    'var value = 0b10',
    'var value = 1_000',
    'value ||= 1',
    'import("./helper.wxs")',
  ])('requires the build-source entry for modern syntax: %s', (source) => {
    expect(analyzeScript(source, 'tools.wxs').diagnostics.map(diagnostic => diagnostic.code)).toContain('script/wxs-syntax')
    expect(analyzeScript(source, 'tools.wxs.ts').diagnostics).toEqual([])
  })

  it('keeps ES5 object functions and explicit properties available', () => {
    const source = 'var label = function (value) { return value + "!" }; module.exports = { label: label, values: [1, 2] }'
    expect(analyzeScript(source, 'tools.wxs').diagnostics).toEqual([])
  })
})

describe('documented SJS platform differences', () => {
  // 抖音模块及数据类型文档：https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/framework/sjs-syntax-reference/module
  it('checks Douyin CommonJS modules, constructors and static relative SJS imports', () => {
    const options = { platform: 'tt' as const }
    expect(analyzeScript('var value = require("./value.sjs"); module.exports = { value: value, date: getDate(0) }', 'tools.sjs', options).diagnostics).toEqual([])
    for (const source of ['export default {}', 'new Date(0)', 'new Local()', 'require("./value.js")', 'require("/value.sjs")', 'require(getPath())']) {
      expect(analyzeScript(source, 'tools.sjs', options).valid).toBe(false)
      expect(analyzeScript(source, 'tools.sjs.ts', options).diagnostics).toEqual([])
    }
    expect(analyzeScript('function local(require) { return require(getPath()) }', 'tools.sjs', options).diagnostics).toEqual([])
  })

  it('keeps ordinary JavaScript comments distinct from WXS trailing comments', () => {
    const source = 'module.exports = {}; /* unfinished'
    expect(analyzeScript(source, 'tools.wxs').valid).toBe(true)
    for (const platform of ['alipay', 'tt', 'swan', 'ty'] as const) {
      expect(analyzeScript(source, 'tools.sjs', { platform }).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/syntax')
    }
  })

  // 百度模块与 ESNext 文档：https://smartprogram.baidu.com/docs/develop/framework/sjs_start 与 sjs_esnext。
  it('accepts documented Baidu ESM, CommonJS and ESNext syntax without applying WXS restrictions', () => {
    const options = { platform: 'swan' as const }
    // eslint-disable-next-line no-template-curly-in-string -- 被测源码需要原样保留模板插值。
    const source = 'import helper from "./helper.sjs"; const { value = 1 } = helper; const label = (...items) => `${value}:${items.length}`; export default { label, date: new Date(0) }; module.exports.extra = label'
    expect(analyzeScript(source, 'tools.sjs', options).diagnostics).toEqual([])
    expect(analyzeScript('var value = require("./other.sjs"); module.exports = { value: value }', 'tools.sjs', options).diagnostics).toEqual([])
    expect(analyzeScript('export { value } from "./other.js"', 'tools.sjs', options).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/sjs-require')
    expect(analyzeScript('var value = getRegExp("x", "u")', 'tools.sjs', options).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/sjs-regexp-flags')
    expect(analyzeScript('swan.request({})', 'tools.sjs', options).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/sjs-host-api')
  })

  it('rejects the explicitly unsupported Baidu super keyword only for native sources', () => {
    const source = 'var object = { method() { return super.method() } }'
    expect(analyzeScript(source, 'tools.sjs', { platform: 'swan' }).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/sjs-super')
    expect(analyzeScript(source, 'tools.sjs.ts', { platform: 'swan' }).diagnostics).toEqual([])
  })

  // 涂鸦 SJS 文档：https://developer.tuya.com/cn/miniapp/develop/miniapp/framework/sjs。
  it('allows all three documented Tuya export forms and its modern variables', () => {
    const options = { platform: 'ty' as const }
    const source = 'const value = require("./value.sjs"); let result = value; export default { result }; module.exports.extra = result; exports.other = result'
    expect(analyzeScript(source, 'tools.sjs', options).diagnostics).toEqual([])
    expect(analyzeScript('var value = require("./value.js")', 'tools.sjs', options).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/sjs-require')
    expect(analyzeScript('var value = require("package.sjs")', 'tools.sjs', options).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/sjs-require')
    expect(analyzeScript('ty.showToast({})', 'tools.sjs', options).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/sjs-host-api')
  })
})

describe('Baidu Filter remains distinct from SJS', () => {
  // 百度 Filter 文档：https://smartprogram.baidu.com/docs/develop/framework/view_filter。
  const options = { platform: 'swan' as const }

  it('accepts the documented default object of functions and JavaScript libraries', () => {
    const source = 'function label(value) { return String(value) }; export default { label, max: values => Math.max(...values) }'
    expect(analyzeScript(source, 'tools.filter.js', options).diagnostics).toEqual([])
    expect(analyzeScript('export default { date() { return new Date(0) } }', 'tools.filter.js', options).diagnostics).toEqual([])
  })

  it('checks only verified native Filter restrictions', () => {
    for (const source of ['export const value = 1', 'module.exports = {}', 'export default { value: 1 }', 'export default { label(value) { return value ? "yes" : "no" } }']) {
      expect(analyzeScript(source, 'tools.filter.js', options).valid).toBe(false)
      expect(analyzeScript(source, 'tools.filter.ts', options).diagnostics).toEqual([])
    }
    expect(analyzeScript('export default { label() { return swan.request({}) } }', 'tools.filter.js', options).diagnostics.map(diagnostic => diagnostic.code)).toContain('script/filter-host-api')
    expect(analyzeScript('export default { label(value) { return value ? "yes" : "no" } }', 'tools.sjs', options).diagnostics).toEqual([])
  })
})
