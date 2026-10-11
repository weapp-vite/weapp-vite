import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { analyzeNativeScriptBlocks } from './nativeAnalysis'

const analyze = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/ast', async original => ({
  ...await original<typeof import('@weapp-vite/ast')>(),
  analyzeCompilerScriptsWithNative: analyze,
}))

const summary: NativeCompilerScriptAnalysis = {
  imports: [],
  hasDefaultExport: false,
  defineOptionsStatements: [],
  isMiniProgramComponent: false,
  hasStaticRequireLiteral: false,
  hasPlatformApiAccess: false,
  featureFlags: [],
}

beforeEach(() => analyze.mockReset())

describe('compiler native batch ownership', () => {
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

  it('submits identical source once and gives all three roles independent mutable summaries', () => {
    const code = 'import Item from "./item.vue"; defineOptions({ name: "Page" });'
    const { descriptor } = parse(`<script lang="ts">${code}</script><script setup lang="ts">${code}</script>`)
    const shared: NativeCompilerScriptAnalysis = {
      ...summary,
      imports: [{ local: 'Item', source: './item.vue', kind: 'default', typeOnly: false }],
      defineOptionsStatements: [{ start: code.indexOf('defineOptions'), end: code.length }],
      featureFlags: ['component'],
      registeredComponents: [{ name: 'Item', local: 'Item' }],
      reservedPropsDiagnostic: { warningOffset: 0 },
    }
    analyze.mockReturnValue([shared])

    const result = analyzeNativeScriptBlocks(descriptor, 'src/page.vue', descriptor.scriptSetup!)!

    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([{ code, filename: 'src/page.vue.ts' }])
    expect(result).toEqual({ scripts: { script: shared, scriptSetup: shared }, defineOptions: shared })
    expect(result.scripts.script).toBe(shared)
    expect(result.scripts.scriptSetup).not.toBe(shared)
    expect(result.defineOptions).not.toBe(shared)
    expect(result.defineOptions).not.toBe(result.scripts.scriptSetup)

    const setup = result.scripts.scriptSetup!
    setup.imports[0]!.source = './changed.vue'
    setup.defineOptionsStatements[0]!.start = 1
    setup.featureFlags.push('changed')
    setup.registeredComponents![0]!.local = 'Changed'
    setup.reservedPropsDiagnostic!.warningOffset = 1
    expect(shared.imports[0]!.source).toBe('./item.vue')
    expect(shared.defineOptionsStatements[0]!.start).toBe(code.indexOf('defineOptions'))
    expect(shared.featureFlags).toEqual(['component'])
    expect(shared.registeredComponents![0]!.local).toBe('Item')
    expect(shared.reservedPropsDiagnostic!.warningOffset).toBe(0)
    expect(result.defineOptions).toEqual(shared)
    result.defineOptions!.featureFlags.push('macro')
    expect(shared.featureFlags).toEqual(['component'])
    expect(setup.featureFlags).toEqual(['component', 'changed'])
  })

  it('keeps absent optional summaries absent when assigning duplicate roles', () => {
    const { descriptor } = parse('<script setup>const n = 1</script>')
    analyze.mockReturnValue([summary])

    const result = analyzeNativeScriptBlocks(descriptor, 'src/page.vue', descriptor.scriptSetup!)!

    expect(result.defineOptions).toEqual(summary)
    expect(result.defineOptions).not.toHaveProperty('registeredComponents')
    expect(result.defineOptions).not.toHaveProperty('reservedPropsDiagnostic')
  })

  it.each([
    ['js', 'ts'],
    ['jsx', 'tsx'],
    ['ts', 'tsx'],
  ])('does not merge the same source parsed as %s and %s', (scriptLang, setupLang) => {
    const code = 'const n = 1'
    const { descriptor } = parse(`<script lang="${scriptLang}">${code}</script><script setup lang="${setupLang}">${code}</script>`)
    const script = { ...summary, hasDefaultExport: true }
    analyze.mockReturnValue([script, summary])

    const result = analyzeNativeScriptBlocks(descriptor, 'src/page.vue', descriptor.scriptSetup!)

    expect(analyze).toHaveBeenCalledWith([
      { code, filename: `src/page.vue.${scriptLang}` },
      { code, filename: `src/page.vue.${setupLang}` },
    ])
    expect(result).toEqual({ scripts: { script, scriptSetup: summary }, defineOptions: summary })
  })

  it.each(['const label = "é"', 'const label = "é" '])('requires exact source equality: %s', (originalCode) => {
    const code = 'const label = "é"'
    const { descriptor } = parse(`<script setup>${code}</script>`)
    const original = { ...descriptor.scriptSetup!, content: originalCode }
    analyze.mockReturnValue([summary, summary])

    analyzeNativeScriptBlocks(descriptor, 'src/page.vue', original)

    expect(analyze).toHaveBeenCalledWith([
      { code, filename: 'src/page.vue.ts' },
      { code: originalCode, filename: 'src/page.vue.ts' },
    ])
  })

  it('falls back for every role of a failed unique input while preserving a successful sibling', () => {
    const { descriptor } = parse('<script>export default {}</script><script setup>const invalid =</script>')
    analyze.mockReturnValue([summary, null])

    const result = analyzeNativeScriptBlocks(descriptor, 'src/page.vue', descriptor.scriptSetup!)

    expect(result).toEqual({ scripts: { script: summary }, defineOptions: undefined })
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([
      { code: 'export default {}', filename: 'src/page.vue.ts' },
      { code: 'const invalid =', filename: 'src/page.vue.ts' },
    ])
  })

  it('does not retain successful or failed unique inputs across compiler calls', () => {
    const { descriptor } = parse('<script setup>const n = 1</script>')
    analyze.mockReturnValueOnce([null]).mockReturnValue([summary])

    expect(analyzeNativeScriptBlocks(descriptor, 'src/page.vue', descriptor.scriptSetup!))
      .toEqual({ scripts: {}, defineOptions: undefined })
    for (let index = 0; index < 2; index++) {
      expect(analyzeNativeScriptBlocks(descriptor, 'src/page.vue', descriptor.scriptSetup!))
        .toEqual({ scripts: { scriptSetup: summary }, defineOptions: summary })
    }
    expect(analyze).toHaveBeenCalledTimes(3)
  })

  it('rejects a batch sized for duplicate roles instead of the submitted unique inputs', () => {
    const { descriptor } = parse('<script setup>const n = 1</script>')
    analyze.mockReturnValue([summary, summary])

    expect(analyzeNativeScriptBlocks(descriptor, 'src/page.vue', descriptor.scriptSetup!)).toBeUndefined()
    expect(analyze).toHaveBeenCalledTimes(1)
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
