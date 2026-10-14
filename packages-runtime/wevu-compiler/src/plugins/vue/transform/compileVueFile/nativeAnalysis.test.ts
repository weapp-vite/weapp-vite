import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { analyzeNativeScriptBlocks, mayShareNativeOptionsAnalysis } from './nativeAnalysis'

const analyze = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/ast', async original => ({
  ...await original<typeof import('@weapp-vite/ast')>(),
  analyzeCompilerScriptsWithNative: analyze,
}))

const summary: NativeCompilerScriptAnalysis = {
  imports: [],
  defineOptionsStatements: [],
}

beforeEach(() => analyze.mockReset())

describe('compiler native batch ownership', () => {
  it.each([
    ['export default {}', '<Card />', true],
    ['export default {}', '<custom-card />', true],
    ['export default {}', '<view />', false],
    ['export default {}', '<slot />', false],
    ['export default {}', '<!-- <Card /> --><view />', false],
    ['export default {}', '<view title="<Card />" />', false],
    ['export default {}', '<view>{{ "<Card />" }}</view>', false],
    ['export default {}', '<view><slot><Card /></slot></view>', true],
    ['export default {}', undefined, false],
    ['const title = "value"', '<Card />', false],
  ] as const)('requires both consumers before considering single-script native analysis: %s / %s', (script, template, expected) => {
    const { descriptor } = parse(`<script>${script}</script>${template === undefined ? '' : `<template>${template}</template>`}`)
    expect(mayShareNativeOptionsAnalysis(script, descriptor.template)).toBe(expected)
  })

  it('keeps external templates and templates without a reusable AST on the existing path', () => {
    const { descriptor } = parse('<script>export default {}</script><template><Card /></template>')
    expect(mayShareNativeOptionsAnalysis('export default {}', { ...descriptor.template!, ast: undefined })).toBe(false)
    expect(mayShareNativeOptionsAnalysis('export default {}', { ...descriptor.template!, src: './card.html' })).toBe(false)
  })

  it('batches transformed scripts with the original macro source in one call', () => {
    const { descriptor } = parse('<script lang="ts">export default {}</script><script setup lang="ts">const n = 1</script>')
    const original = { ...descriptor.scriptSetup!, content: 'defineOptions({ name: "Before" });' }
    const macro = { ...summary, defineOptionsStatements: [{ start: 0, end: original.content.length }] }
    analyze.mockReturnValue([summary, summary, macro])

    const result = analyzeNativeScriptBlocks(descriptor, 'src/page.vue', original)

    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([
      { code: 'export default {}', filename: 'src/page.vue.ts' },
      { code: 'const n = 1', filename: 'src/page.vue.ts' },
      { code: original.content, filename: 'src/page.vue.ts' },
    ])
    expect(result).toEqual({ scripts: { script: summary, scriptSetup: summary }, defineOptions: macro })
  })

  it('retains successful siblings when a script cannot be analyzed', () => {
    const { descriptor } = parse('<script>export default {}</script><script setup>const invalid =</script>')
    analyze.mockReturnValue([summary, null])
    expect(analyzeNativeScriptBlocks(descriptor, 'src/page.vue')).toEqual({ scripts: { script: summary }, defineOptions: undefined })
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('leaves thrown, disabled and truncated batches to the existing compiler without retrying', () => {
    const { descriptor } = parse('<script setup>const n = 1</script>')
    for (const result of [undefined, []]) {
      analyze.mockReturnValueOnce(result)
      expect(analyzeNativeScriptBlocks(descriptor, 'src/page.vue')).toBeUndefined()
    }
    analyze.mockImplementationOnce(() => {
      throw new Error('native unavailable')
    })
    expect(analyzeNativeScriptBlocks(descriptor, 'src/page.vue')).toBeUndefined()
    expect(analyze).toHaveBeenCalledTimes(3)
  })

  it('does not cross the native boundary for a template-only SFC', () => {
    const { descriptor } = parse('<template><view /></template>')
    expect(analyzeNativeScriptBlocks(descriptor, 'src/page.vue')).toBeUndefined()
    expect(analyze).not.toHaveBeenCalled()
  })
})
