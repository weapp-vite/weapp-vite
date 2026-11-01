import { runInNewContext } from 'node:vm'
import { getMiniProgramPlatformDescriptor } from '@weapp-core/shared'
import { describe, expect, it } from 'vitest'
import { handleWxml } from '../wxml/handle'
import { scanWxml } from '../wxml/scan'
import { transformWxsCode } from './index'
import { prepareWxsSource } from './source'

describe('platform script module contracts', () => {
  it.each(['weapp', 'tt'] as const)('keeps named, default and namespace imports separate for mixed %s exports', (platform) => {
    const options = { extension: platform === 'tt' ? 'sjs' : 'wxs', platform }
    const dependency = transformWxsCode('export const value = "named"; export default { value: "default" }', options)
    const consumer = transformWxsCode('import defaults, { value } from "./mixed.wxs.ts"; import * as namespace from "./mixed.wxs.ts"; export default { named: value, direct: defaults.value, namespaceNamed: namespace.value, namespaceDefault: namespace.default.value }', options)
    const dependencyModule = { exports: {} as { value: string, default: { value: string }, __esModule: boolean } }
    const consumerModule = { exports: {} as Record<string, string> }
    runInNewContext(dependency.result?.code ?? '', { module: dependencyModule })
    runInNewContext(consumer.result?.code ?? '', { module: consumerModule, require: () => dependencyModule.exports })
    expect(dependencyModule.exports.value).toBe('named')
    expect(dependencyModule.exports.default.value).toBe('default')
    expect(consumerModule.exports).toEqual({ named: 'named', direct: 'default', namespaceNamed: 'named', namespaceDefault: 'default' })
    expect(dependency.result?.code).not.toContain('Object.defineProperty')
  })

  it('keeps type-only exports out of the default-only template module API', () => {
    const { result } = transformWxsCode('interface Value { label: string }; export { type Value }; export default { label: "direct" }', { platform: 'weapp', extension: 'wxs' })
    const module = { exports: {} as { label: string } }
    runInNewContext(result?.code ?? '', { module })
    expect(module.exports.label).toBe('direct')
    expect(module.exports).not.toHaveProperty('default')
  })

  it('keeps local and re-exported default aliases compatible with the direct template API', () => {
    const options = { platform: 'weapp' as const, extension: 'wxs' }
    const local = transformWxsCode('const value = { label: "local" }; export { value as default }', options)
    const localModule = { exports: {} as { label: string } }
    runInNewContext(local.result?.code ?? '', { module: localModule })
    expect(localModule.exports.label).toBe('local')
    const dependency = transformWxsCode('export default { label: "reexport" }', options)
    const exported = transformWxsCode('export { default } from "./dependency.wxs.ts"', options)
    const dependencyModule = { exports: {} }
    const exportModule = { exports: {} as { label: string } }
    runInNewContext(dependency.result?.code ?? '', { module: dependencyModule })
    runInNewContext(exported.result?.code ?? '', { module: exportModule, require: () => dependencyModule.exports })
    expect(exportModule.exports.label).toBe('reexport')
    expect(exported.importees).toEqual([{ source: './dependency.wxs.ts' }])
  })

  it.each(['weapp', 'tt'] as const)('exposes default exports directly to %s template module consumers', (platform) => {
    const extension = platform === 'tt' ? 'sjs' : 'wxs'
    const dependency = transformWxsCode('export default function label(value: string) { return value + "!" }', { extension, platform })
    const consumer = transformWxsCode('import label from "./label.wxs.ts"; export default { label };', { extension, platform })
    const nativeModule = { exports: {} as { label: (value: string) => string } }
    const dependencyModule = { exports: undefined as unknown }
    runInNewContext(dependency.result?.code ?? '', { module: dependencyModule })
    runInNewContext(consumer.result?.code ?? '', { module: nativeModule, require: () => dependencyModule.exports })
    expect(nativeModule.exports.label('native')).toBe('native!')
    expect(consumer.importees).toEqual([{ source: './label.wxs.ts' }])
  })

  it('normalizes ESM module paths while keeping original dependency ids', () => {
    const { result, importees } = transformWxsCode('import helper from "./helper.wxs.ts"; export { value } from "./other.wxs.ts"; export default helper', { extension: 'sjs', platform: 'alipay' })
    expect(result?.code).toContain('./helper.sjs')
    expect(result?.code).toContain('./other.sjs')
    expect(importees).toEqual([{ source: './helper.wxs.ts' }, { source: './other.wxs.ts' }])
  })

  it('keeps local require, module, exports and constructors intact', () => {
    const { result, importees } = transformWxsCode('function local(require, module, exports, Date, RegExp) { module.exports = exports.value; require("package"); return [new Date(), new RegExp("x")] }', { extension: 'sjs', platform: 'alipay' })
    expect(importees).toEqual([])
    expect(result?.code).toContain('module.exports = exports.value')
    expect(result?.code).toContain('new Date()')
    expect(result?.code).toContain('new RegExp')
  })

  it('preserves native syntax while compiling cross-platform WXS input', async () => {
    const source = 'module.exports = { label: function(value) { return value } }'
    expect((await prepareWxsSource(`${source}\n/* native tail`, { filename: 'helper.wxs', extension: 'wxs', platform: 'weapp' })).code).toBe(`${source}\n/* native tail`)
    expect((await prepareWxsSource(source, { filename: 'helper.wxs', extension: 'sjs', platform: 'alipay' })).code).toContain('export default')
    expect((await prepareWxsSource('const value: number = 1; export default { value }', { filename: 'helper.wxs', extension: 'wxs', platform: 'weapp', compile: true })).code).not.toContain(': number')
    expect((await prepareWxsSource('export default { label: (value: string) => value }', { filename: 'helper.filter.js', extension: 'js', platform: 'swan', compile: true, filter: true })).code).not.toContain(': string')
  })

  it('declares Douyin SJS and converts compiled sources to native CommonJS', () => {
    expect(getMiniProgramPlatformDescriptor('tt').outputExtensions.wxs).toBe('sjs')
    const { result } = transformWxsCode('export default { label: (value: string) => value }', { extension: 'sjs', platform: 'tt' })
    expect(result?.code).toContain('module.exports')
    expect(result?.code).not.toContain('export default')
    expect(result?.code).not.toContain(': string')
  })

  it('keeps Baidu import-sjs src/module attributes and collects its dependency', () => {
    const source = '<import-sjs src="./helper.sjs" module="helper"/><view>{{helper.label(value)}}</view>'
    const token = scanWxml(source, { platform: 'swan' })
    expect(token.deps).toMatchObject([{ value: './helper.sjs', tagName: 'import-sjs' }])
    expect(handleWxml(token, { platform: 'swan', scriptModuleExtension: 'sjs', scriptModuleTag: 'import-sjs' }).code).toContain('<import-sjs src="./helper.sjs" module="helper"/>')
  })

  it('normalizes compiled WXS declarations to platform attributes', () => {
    const source = '<wxs module="helper" src="./helper.wxs.ts"/>'
    for (const platform of ['alipay', 'swan', 'tt'] as const) {
      const token = scanWxml(source, { platform })
      const code = handleWxml(token, { platform, scriptModuleExtension: 'sjs' }).code
      expect(code).toContain(platform === 'alipay' ? '<import-sjs name="helper" from="./helper.sjs"' : platform === 'swan' ? '<import-sjs module="helper" src="./helper.sjs"' : '<sjs module="helper" src="./helper.sjs"')
    }
  })
})
