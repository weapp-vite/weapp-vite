import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { parseTemplateWithScriptModules } from '../../../../utils/templateScriptModules'
import { analyzeVueTemplateTags } from '../../../../utils/vueTemplateTags'
import { parseVueSfc } from '../../../utils/vueSfc'
import { analyzeTemplate } from '../../transform/compileVueFile/nativeSlotContext/template'
import { createAnalysisSourceReader } from '../../transform/compileVueFile/sourceReader'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from '../template'

const filename = 'src/components/inline.vue'
const body = `
// 行内标签列表：这一行不能吞掉导出。
var inlineTags = { span: true }
var literal = '<view>&amp;{{ untouched }}</view>'
var closing = '</wxs>'
/* 注释中的 </wxs> 也不是结束边界。 */
module.exports = {
  isInline: function (tagName, style) {
    return inlineTags[tagName] || (style || '').indexOf('display:inline') !== -1
  },
  pick: function (value) { return value > 0 && value < 2 ? literal : closing }
}
`

function evaluate(source: string) {
  const module = { exports: {} as { isInline: (tag: string, style?: string) => boolean, pick: (value: number) => string } }
  runInNewContext(source, { module })
  return module.exports
}

describe('raw script modules in Vue templates', () => {
  it.each([false, true])('preserves executable source with formatWxml=%s', (formatWxml) => {
    const module = `<wxs module="handler">${body}</wxs>`
    const source = `${module}<view>{{ handler.pick(1) }}</view>`
    const result = compileVueTemplateToWxml(source, filename, { formatWxml })

    expect(result.diagnostics).toEqual([])
    expect(result.code).toContain(module)
    expect(result.code).not.toContain('<!--wevu:raw-script:')
    const actualBody = result.code.slice(result.code.indexOf('>') + 1, result.code.lastIndexOf('</wxs>'))
    const exports = evaluate(actualBody)
    expect(exports.isInline('span')).toBe(true)
    expect(exports.isInline('view', 'display:inline')).toBe(true)
    expect(exports.isInline('view')).toBe(false)
    expect(exports.pick(1)).toBe('<view>&amp;{{ untouched }}</view>')
    expect(exports.pick(2)).toBe('</wxs>')
  })

  it.each([
    ['tt', 'sjs', 'module'],
    ['alipay', 'import-sjs', 'name'],
  ] as const)('uses the %s native script contract', (platform, tag, attribute) => {
    const module = `<${tag} ${attribute}="handler">${body}</${tag}>`
    const result = compileVueTemplateToWxml(module, filename, { platform: getMiniProgramTemplatePlatform(platform), formatWxml: true })
    expect(result.diagnostics).toEqual([])
    expect(result.code).toContain(module)
  })

  it('keeps script source and original UTF-16 locations through the SFC parser', () => {
    const module = `<wxs module="handler">${body}</wxs>`
    const source = `<template>😀\n${module}<view /></template><script>export default {}</script>`
    const result = parseVueSfc(source, { filename })
    expect(result.errors).toEqual([])
    expect(result.descriptor.template?.content).toBe(`😀\n${module}<view />`)
    expect(result.descriptor.template?.loc.source).toBe(`😀\n${module}<view />`)
    const raw = result.descriptor.template?.ast?.children.find(node => node.type === 1 && node.tag === 'wxs')
    expect(raw?.loc.start.offset).toBe(source.indexOf('<wxs'))
    expect(raw?.loc.source).toBe(module)
  })

  it('lets Vue own quoted attributes, comments and interpolation strings', () => {
    const prefix = `<view :title="'<wxs>fake</wxs> {{'" /><!-- <wxs>fake</wxs> -->`
    const module = `<wxs module="handler">${body}</wxs>`
    const parsed = parseTemplateWithScriptModules(`${prefix}${module}`, {})
    expect(parsed.scripts.byStart.size).toBe(1)
    expect(parsed.scripts.byStart.has(prefix.length)).toBe(true)
    expect(compileVueTemplateToWxml(`${prefix}${module}`, filename).diagnostics).toEqual([])
  })

  it('keeps scoped-slot scripts intact after the child template is emitted', () => {
    const module = `<wxs module="handler">${body}</wxs>`
    const result = compileVueTemplateToWxml(`<custom-card v-slot="{ value }">${module}<view>{{value}}</view></custom-card>`, filename, {
      scopedSlotsCompiler: 'augmented',
      formatWxml: true,
    })
    expect(result.diagnostics).toEqual([])
    expect(result.scopedSlotComponents).toHaveLength(1)
    expect(result.scopedSlotComponents?.[0]?.template).toContain(module)
    expect(result.scopedSlotComponents?.[0]?.template).not.toContain('<!--wevu:raw-script:')
  })

  it('discovers later modules hidden by a fake HTML raw-text opening tag', () => {
    const first = `<wxs module="first">module.exports = { text: '</wxs><script>' }</wxs>`
    const second = '<wxs module="second">module.exports = { ready: 1 < 2 && 2 > 1 }</wxs>'
    const result = compileVueTemplateToWxml(`${first}${second}<view />`, filename, { formatWxml: true })
    expect(result.diagnostics).toEqual([])
    expect(result.code).toContain(first)
    expect(result.code).toContain(second)
  })

  it('reads the opening boundary from source when Vue removes v-pre attributes', () => {
    const module = '<wxs module="handler" v-pre=">">module.exports = { ready: 1 < 2 }</wxs>'
    const result = compileVueTemplateToWxml(module, filename)
    expect(result.diagnostics).toEqual([])
    expect(result.code).toBe(module)
  })

  it('restores replacement metacharacters and placeholder-looking script literals verbatim', () => {
    const text = ['<!--wevu:raw-script:0-->', '$&', '$$', '$\'', '$`'].join('|')
    const module = `<wxs module="handler">module.exports = { text: ${JSON.stringify(text)} }</wxs>`
    expect(compileVueTemplateToWxml(module, filename, { formatWxml: true }).code.trim()).toBe(module)
  })

  it('keeps raw scripts out of native slot ownership analysis', () => {
    const result = analyzeTemplate(`<wxs module="handler">${body}</wxs><view>{{ label }}</view>`)
    expect(result.required).toBe(false)
    expect(result.tags.size).toBe(0)
    expect(result.expressions).not.toContain('untouched')
    expect(result.expressions).toContain('label')
  })

  it('keeps script literals out of component discovery and dependency SFC validation', async () => {
    const module = `<wxs module="handler">${body.replace('<view>', '<fake-card>')}</wxs>`
    expect([...analyzeVueTemplateTags(`${module}<real-card />`).tags]).toEqual(['real-card'])
    const reader = createAnalysisSourceReader({ source: { readFile: async () => `<template>${module}<view /></template>` } }, new Set())
    const facts = await reader.load('src/Dependency.vue')
    expect(facts?.invalid).toBe(false)
    expect(facts?.descriptor?.template?.content).toContain(module)
  })

  it('retains structural errors and rejects uncertain script boundaries', () => {
    expect(compileVueTemplateToWxml('<wxs module="handler">"unterminated</wxs>', filename).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'WV2002' })]))
    expect(compileVueTemplateToWxml(`<wxs module="handler">${body}</wxs><view></text>`, filename).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'WV2001' })]))
  })
})
