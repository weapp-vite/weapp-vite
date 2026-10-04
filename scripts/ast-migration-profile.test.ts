import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { transformScript } from '../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript'
import { profileCompileVueFilePhases, profileTransformScriptPhases, runCompilerProfile } from './ast-migration-profile'
import { createTransformScriptFixture } from './astMigrationProfile/fixtures'

it('profiles module-scoped macros without leaking page metadata into runtime output', () => {
  const result = profileTransformScriptPhases(`
import { defineComponent } from 'vue'
import { definePageMeta as pageMeta, onLoad } from 'wevu'

export default defineComponent({
  setup() {
    pageMeta({ title: 'profile' })
    onLoad(() => {})
    return { count: 1 }
  },
})
`, { isPage: true })

  expect(result.code).not.toContain('definePageMeta')
  expect(result.code).not.toContain('pageMeta')
  expect(result.code).toContain('onLoad')
  expect(result.code).toContain('count: 1')
  expect(Object.values(result.timings).every(value => Number.isFinite(value) && value >= 0)).toBe(true)
})

describe('actual compiler entry profiling', () => {
  it.each([{ sourceMap: true, minify: false }, { sourceMap: false, minify: true }])('preserves script capabilities, source maps and warnings: %o', (options) => {
    const source = createTransformScriptFixture()
    const warnings: string[] = []
    const baseline = transformScript(source, { ...options, isPage: true, warn: message => warnings.push(message) })
    const profiled = profileTransformScriptPhases(source, { ...options, isPage: true })
    expect(profiled.value).toStrictEqual(baseline)
    expect(profiled.warnings).toStrictEqual(warnings)
    expect(profiled.observation.counters.babelParseCalls).toBeGreaterThan(0)
    expect(profiled.observation.counters.babelGenerateCalls).toBeGreaterThan(0)
    expect(profiled.observation.spans.some(span => span.name === 'transformScript.sourceCapabilities')).toBe(true)
  })

  it('follows the real fast setup path without inventing Babel generation', () => {
    const source = `import { defineComponent as _defineComponent } from 'vue'
export default /*@__PURE__*/_defineComponent({
  __name: 'profile',
  setup(__props, { expose: __expose }) {
    __expose();
    const count = 1
    const __returned__ = { count }
    Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })
    return __returned__
  }
})`
    const options = { isPage: true, sourceMap: false }
    const profiled = profileTransformScriptPhases(source, options)
    expect(profiled.value).toStrictEqual(transformScript(source, options))
    expect(profiled.value.transformed).toBe(true)
    expect(profiled.observation.counters.babelGenerateCalls).toBeUndefined()
    expect(profiled.observation.spans.map(span => span.name)).toEqual(['transformScript', 'transformScript.fastSetup'])
  })

  it('forwards actual warnings once with identical output', () => {
    const circular: { component: { options: object } } = { component: { options: {} } }
    circular.component.options = circular
    const source = createTransformScriptFixture()
    const baselineWarnings: string[] = []
    const observedWarnings: string[] = []
    const baseline = transformScript(source, { wevuDefaults: circular, warn: message => baselineWarnings.push(message) })
    const profiled = profileTransformScriptPhases(source, { wevuDefaults: circular, warn: message => observedWarnings.push(message) })
    expect(baselineWarnings.length).toBeGreaterThan(0)
    expect(profiled.warnings).toStrictEqual(baselineWarnings)
    expect(observedWarnings).toStrictEqual(baselineWarnings)
    expect(profiled.value).toStrictEqual(baseline)
  })

  it('does not invent generation work for an unchanged script', () => {
    const source = 'export const answer = 42'
    const profiled = profileTransformScriptPhases(source)
    expect(profiled.value).toStrictEqual(transformScript(source))
    expect(profiled.value.transformed).toBe(false)
    expect(profiled.observation.counters.babelGenerateCalls).toBeUndefined()
    expect(profiled.observation.spans.some(span => span.name === 'transformScript.generate')).toBe(false)
  })

  it('preserves full SFC style, props, metadata, source map and configuration behavior', async () => {
    const source = `<template><view class="panel">{{ message }} {{ count }}</view></template>
<script setup lang="ts">
import { ref } from 'wevu'
const { message = 'hello' } = defineProps<{ message?: string }>()
const count = ref(1)
definePageJson({ navigationBarTitleText: 'profile' })
</script>
<style scoped>.panel { color: v-bind(message); }</style>`
    const filename = 'src/pages/profile/index.vue'
    const warnings: string[] = []
    const baseline = await compileVueFile(source, filename, { isPage: true, warn: message => warnings.push(message) })
    const profiled = await profileCompileVueFilePhases(source, filename, { isPage: true })
    expect(profiled.value).toStrictEqual(baseline)
    expect(profiled.warnings).toStrictEqual(warnings)
    expect(profiled.value.scriptMap).toBeTruthy()
    expect(profiled.value.style).toBeTruthy()
    expect(profiled.observation.spans.map(span => span.name)).toEqual(expect.arrayContaining([
      'compileVueFile',
      'compileVueFile.style',
      'compileVueFile.template',
      'compileVueFile.script',
      'compileVueFile.config',
      'transformScript',
    ]))
    const script = profiled.observation.spans.find(span => span.name === 'compileVueFile.script')!
    expect(profiled.observation.spans.find(span => span.name === 'transformScript')!.parentId).toBe(script.id)
  })

  it('retains real compiler failures', async () => {
    const source = '<script setup>const value = </script>'
    await expect(profileCompileVueFilePhases(source, 'src/pages/profile/index.vue')).rejects.toThrow()
  })

  it('reports actual entry samples and explicit measurement limits', async () => {
    const report = await runCompilerProfile({ iterations: 1, warmup: 0 })
    expect(report.scenarios.map(scenario => scenario.id)).toEqual(['transformScript', 'compileVueFile'])
    for (const scenario of report.scenarios) {
      expect(scenario.samples).toHaveLength(1)
      expect(scenario.samples[0]!.observation.spans[0]!.name).toBe(scenario.id)
      expect(scenario.samples[0]!.outputSha256).toMatch(/^[a-f0-9]{64}$/)
      expect(scenario.samples[0]!.native.scope).toContain('baseline excluded')
      expect(scenario.samples[0]!.native.counters).toEqual({
        bindingCalls: expect.any(Number),
        batchCalls: expect.any(Number),
        inputScripts: expect.any(Number),
        inputBytes: expect.any(Number),
        cacheHits: expect.any(Number),
        fallbacks: expect.any(Number),
        loadFailures: expect.any(Number),
      })
    }
    expect(report.limitations.join(' ')).toContain('not phase CPU')
    expect(report.limitations.join(' ')).toContain('not reported as wait time')
    expect(report.gc.scope).toContain('warmup')
    expect(report.gc.attribution).toContain('not attributable')
    expect(JSON.stringify(report)).not.toContain('estimatedSpeedup')
  })
})
