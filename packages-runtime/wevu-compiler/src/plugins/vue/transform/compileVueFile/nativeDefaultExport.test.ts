import type { NativeCompilerScriptAnalysis, NativeCompilerScriptInput } from '@weapp-vite/ast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasDefaultExport } from './defaultExport'
import { compileVueFile } from './index'

const analyze = vi.hoisted(() => vi.fn())
const singleScriptGate = vi.hoisted(() => vi.fn())
const parse = vi.hoisted(() => vi.fn())
const parseComponents = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/ast', async original => ({
  ...await original<typeof import('@weapp-vite/ast')>(),
  analyzeCompilerScriptsWithNative: analyze,
}))
vi.mock('./nativeAnalysis', async (original) => {
  const actual = await original<typeof import('./nativeAnalysis')>()
  singleScriptGate.mockImplementation(actual.mayShareNativeOptionsAnalysis)
  return { ...actual, mayShareNativeOptionsAnalysis: singleScriptGate }
})
vi.mock('../../../../utils/babel', async (original) => {
  const actual = await original<typeof import('../../../../utils/babel')>()
  parse.mockImplementation(actual.parseJsLike)
  parseComponents.mockImplementation(actual.parse)
  return { ...actual, parseJsLike: parse, parse: parseComponents }
})

const summary: NativeCompilerScriptAnalysis = { imports: [], defineOptionsStatements: [] }
const objectScript = 'const title = "😀"; export default { setup() { return { title } } }'

function createSource(code: string) {
  return `<script lang="ts">${code}</script><template><view>{{ title }}<custom-card /></view></template>`
}

beforeEach(() => {
  analyze.mockReset()
  vi.stubEnv('WEAPP_VITE_NATIVE', '1')
  vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', './native-default-export-test.cjs')
  singleScriptGate.mockClear()
  parse.mockClear()
  parseComponents.mockClear()
})

afterEach(() => vi.unstubAllEnvs())

describe('compileVueFile native default export reuse', () => {
  it('keeps native disabled without traversing the single-script template AST', async () => {
    const source = createSource(objectScript)
    const baseline = await compileVueFile(source, 'src/component.vue')
    const baselineParses = parse.mock.calls.length
    analyze.mockClear()
    parse.mockClear()
    singleScriptGate.mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')

    const result = await compileVueFile(source, 'src/component.vue')

    expect(result).toEqual(baseline)
    expect(parse).toHaveBeenCalledTimes(baselineParses)
    expect(analyze).not.toHaveBeenCalled()
    expect(singleScriptGate).not.toHaveBeenCalled()
  })

  it('preserves the existing text fast path even when native confirms a comment-separated declaration', () => {
    expect(hasDefaultExport('export/*comment*/default {}', { hasDefaultExport: true })).toBe(false)
    expect(parse).not.toHaveBeenCalled()
  })

  it('shares one native summary between static component registrations and the default export check', async () => {
    const staticScript = 'const title = "😀"; export default { setup: () => ({ title }) }'
    const source = createSource(staticScript)
    const baseline = await compileVueFile(source, 'src/component.vue')
    const baselineParses = parse.mock.calls.length
    const baselineComponentParses = parseComponents.mock.calls.filter(([code]) => code === staticScript).length
    expect(baselineComponentParses).toBeGreaterThan(0)
    analyze.mockClear()
    parse.mockClear()
    parseComponents.mockClear()
    analyze.mockReturnValue([{ ...summary, hasDefaultExport: true, registeredComponents: [] }])

    const result = await compileVueFile(source, 'src/component.vue')

    expect(result).toEqual(baseline)
    // 仅省去 Options API 组件分析的解析，最终 transformScript 仍保留自己的 Babel AST。
    expect(parseComponents.mock.calls.filter(([code]) => code === staticScript)).toHaveLength(baselineComponentParses - 1)
    expect(parse).toHaveBeenCalledTimes(baselineParses - 1)
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it.each([
    [objectScript, true],
    ['const title = "value"; const options = { setup() { return { title } } }; export default options', true],
    ['import { defineComponent } from "wevu"; export default defineComponent({ setup() { return { title: "value" } } })', true],
    ['// export default {}\nconst title = "value"', false],
    ['const title = "export default {}"', false],
    ['declare module "virtual:card" { const page: any; export default page; }\nconst title = "value"', true],
  ] as const)('preserves complete output and source maps and avoids one default export parse: %s', async (code, fact) => {
    const source = createSource(code)
    const baselineWarn = vi.fn()
    const baseline = await compileVueFile(source, 'src/component.vue', { warn: baselineWarn })
    const baselineParses = parse.mock.calls.length
    expect(baselineParses).toBeGreaterThan(0)
    analyze.mockClear()
    parse.mockClear()
    analyze.mockImplementation((inputs: NativeCompilerScriptInput[]) => inputs.map(() => ({ ...summary, hasDefaultExport: fact })))
    const nativeWarn = vi.fn()

    const result = await compileVueFile(source, 'src/component.vue', { warn: nativeWarn })

    expect(result).toEqual(baseline)
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(parse).toHaveBeenCalledTimes(baselineParses - 1)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([{ code, filename: 'src/component.vue.ts' }])
  })

  it.each([
    ['an old binding summary', summary],
    ['a failed per-item summary', null],
  ] as const)('keeps complete output and runs the existing check once with %s', async (_label, nativeSummary) => {
    const source = createSource(objectScript)
    const baseline = await compileVueFile(source, 'src/component.vue')
    const baselineParses = parse.mock.calls.length
    analyze.mockClear()
    parse.mockClear()
    analyze.mockReturnValue([nativeSummary])

    const result = await compileVueFile(source, 'src/component.vue')

    expect(result).toEqual(baseline)
    expect(parse).toHaveBeenCalledTimes(baselineParses)
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('preserves the single fallback check when the native batch throws', async () => {
    const source = createSource(objectScript)
    const baseline = await compileVueFile(source, 'src/component.vue')
    const baselineParses = parse.mock.calls.length
    analyze.mockClear()
    parse.mockClear()
    analyze.mockImplementation(() => {
      throw new Error('native unavailable')
    })

    const result = await compileVueFile(source, 'src/component.vue')

    expect(result).toEqual(baseline)
    expect(parse).toHaveBeenCalledTimes(baselineParses)
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('preserves macro stripping and disabled source maps with the same summary', async () => {
    const code = `defineComponentJson({ component: true }); ${objectScript}`
    const source = createSource(code)
    const baseline = await compileVueFile(source, 'src/component.vue', { sourceMap: false })
    analyze.mockClear()
    parse.mockClear()
    analyze.mockReturnValue([{ ...summary, hasDefaultExport: true }])

    const result = await compileVueFile(source, 'src/component.vue', { sourceMap: false })

    expect(result).toEqual(baseline)
    expect(result.scriptMap).toBeNull()
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it.each([
    '// export default {}\nconst color = "red"',
    'const color = "red"; const title = "export default {}"',
  ])('rechecks Vue CSS variable generated exports instead of consuming the original false fact: %s', async (code) => {
    const source = `${createSource(code)}<style>.card { color: v-bind(color); }</style>`
    const baselineWarn = vi.fn()
    const baseline = await compileVueFile(source, 'src/component.vue', { warn: baselineWarn })
    const baselineParses = parse.mock.calls.length
    expect(baseline.meta?.cssVars).toEqual(['color'])
    analyze.mockClear()
    parse.mockClear()
    analyze.mockReturnValue([{ ...summary, hasDefaultExport: false, registeredComponents: [] }])
    const nativeWarn = vi.fn()

    const result = await compileVueFile(source, 'src/component.vue', { warn: nativeWarn })

    expect(result).toEqual(baseline)
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(parse).toHaveBeenCalledTimes(baselineParses)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([{ code, filename: 'src/component.vue.ts' }])
  })

  it('uses the external normal script fact without changing its map or dependency metadata', async () => {
    const source = '<script lang="ts" src="./component.ts"></script><template><view>{{ title }}<custom-card /></view></template>'
    const options = {
      sfcSrc: { resolveId: async () => 'src/component.ts', readFile: async () => objectScript },
    }
    const baseline = await compileVueFile(source, 'src/component.vue', options)
    const baselineParses = parse.mock.calls.length
    analyze.mockClear()
    parse.mockClear()
    analyze.mockReturnValue([{ ...summary, hasDefaultExport: true }])

    const result = await compileVueFile(source, 'src/component.vue', options)

    expect(result).toEqual(baseline)
    expect(parse).toHaveBeenCalledTimes(baselineParses - 1)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([{ code: objectScript, filename: 'src/component.vue.ts' }])
  })

  it.each([
    [createSource('const title = "value"'), 'src/component.vue'],
    [`<script lang="ts">${objectScript}</script>`, 'src/component.vue'],
    [createSource(objectScript), 'src/app.vue'],
    [`<script lang="ts">${objectScript}</script><template><view /></template>`, 'src/component.vue'],
    [`<script lang="ts">${objectScript}</script><template><view title="<Card />" /></template>`, 'src/component.vue'],
    [`<script lang="ts">${objectScript}</script><template><view>{{ "<Card />" }}</view></template>`, 'src/component.vue'],
    ['<script setup lang="ts">const title = "value"</script><template><view>{{ title }}</view></template>', 'src/component.vue'],
  ])('keeps scripts with only one summary consumer on the original path: %s', async (source, filename) => {
    await compileVueFile(source, filename)

    expect(analyze).not.toHaveBeenCalled()
  })
})
