import type { ComponentPublicInstance } from '../src/runtime/component'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyScanState } from '../src/plugin/state'
import { compileWebVueSfc, generateWebVueSfcTemplate } from '../src/plugin/vueSfc'
import { createRenderContext } from '../src/runtime/renderContext'

describe('inline uni-app WXS through the Web SFC compiler', () => {
  it('executes exported helpers after preserving comments, operators and literal markup', async () => {
    const filename = 'src/components/inline.vue'
    const meta = { kind: 'component' as const, id: 'components/inline', scriptPath: filename, sourceType: 'vue-sfc' as const }
    const source = `<template><view>{{handler.span}}|{{handler.view}}|{{handler.raw}}</view></template>
<script module="handler" lang="wxs">
// 行内标签列表，与 uview-plus 的内联模块入口一致。
var inlineTags = { span: true }
var raw = '<view>&amp;{{ untouched }}</view>'
var ending = '</wxs>'
/* 这里的 </wxs> 不是模块边界。 */
function isInline(tagName) { return !!inlineTags[tagName] }
function literal() { return 1 < 2 && 2 > 1 ? raw : ending }
module.exports = {
  isInline: isInline,
  literal: literal,
  span: isInline('span'),
  view: isInline('view'),
  raw: literal()
}
</script>
<script>export default {}</script>`
    const result = await compileWebVueSfc({ source, filename, meta, srcRoot: 'src', state: createEmptyScanState(), uniApp: { include: [] } })
    const compiled = generateWebVueSfcTemplate(result, meta, filename, 'src')
    expect(compiled.warnings).toBeUndefined()
    const commonjs = await transform(compiled.code, { format: 'cjs', loader: 'js', target: 'es2022' })
    const output = { exports: {} as { default: (scope: Record<string, unknown>, context: unknown) => unknown } }
    const values: unknown[] = []
    runInNewContext(commonjs.code, {
      module: output,
      exports: output.exports,
      require: (request: string) => request === 'lit'
        ? { html: (_strings: TemplateStringsArray, ...parts: unknown[]) => {
            values.push(...parts)
            return parts
          } }
        : {},
    })
    const context = createRenderContext({} as ComponentPublicInstance, {})
    const created = vi.spyOn(context, 'createWxsModule')
    output.exports.default({}, context)
    expect(values.flat(Infinity).join('')).toContain('true|false|<view>&amp;{{ untouched }}</view>')
    expect(created).toHaveBeenCalledTimes(1)
    const handler = created.mock.results[0]?.value
    expect(handler.isInline('span')).toBe(true)
    expect(handler.isInline('view')).toBe(false)
    expect(handler.literal()).toBe('<view>&amp;{{ untouched }}</view>')
    output.exports.default({}, context)
    expect(created).toHaveBeenCalledTimes(1)
  })
})
