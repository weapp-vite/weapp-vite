import type { NativeCompilerScriptAnalysis, NativeCompilerScriptInput } from '@weapp-vite/ast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileVueFile } from './index'

const analyze = vi.hoisted(() => vi.fn())
const parse = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/ast', async original => ({
  ...await original<typeof import('@weapp-vite/ast')>(),
  analyzeCompilerScriptsWithNative: analyze,
}))
vi.mock('../../../../utils/babel', async (original) => {
  const actual = await original<typeof import('../../../../utils/babel')>()
  parse.mockImplementation(actual.parseJsLike)
  return { ...actual, parseJsLike: parse }
})

const summary: NativeCompilerScriptAnalysis = {
  imports: [],
  defineOptionsStatements: [],
}

function createSource(code: string) {
  return `<script lang="ts">export default {}</script><script setup lang="ts">${code}</script><template><view /></template>`
}

beforeEach(() => {
  analyze.mockReset()
  parse.mockClear()
})

describe('compileVueFile reserved props native parity', () => {
  it.each([
    ['const props = defineProps({ id: String }); const title = "😀"', true],
    ['const title = "😀";\r\nconst props = defineProps(["slot"])', true],
    ['const props = defineProps({ title: String }); const title = "safe"', false],
  ] as const)('preserves complete output and diagnostics while avoiding the original setup parse: %s', async (code, warning) => {
    const source = createSource(code)
    const baselineWarn = vi.fn()
    const baseline = await compileVueFile(source, 'src/component.vue', { warn: baselineWarn })
    const submittedInputs = analyze.mock.calls[0]![0] as NativeCompilerScriptInput[]
    const submittedCode = submittedInputs.find(input => input.code.includes('defineProps'))!.code
    expect(baselineWarn).toHaveBeenCalledTimes(warning ? 1 : 0)
    expect(parse.mock.calls.filter(([input]) => input === submittedCode)).toHaveLength(1)
    analyze.mockClear()
    parse.mockClear()
    analyze.mockImplementation((inputs: NativeCompilerScriptInput[]) => inputs.map(input => ({
      ...summary,
      reservedPropsDiagnostic: input.code === submittedCode && warning
        ? { warningOffset: submittedCode.indexOf('defineProps') }
        : {},
    })))
    const nativeWarn = vi.fn()

    const result = await compileVueFile(source, 'src/component.vue', { warn: nativeWarn })

    expect(result).toEqual(baseline)
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(parse.mock.calls.filter(([input]) => input === submittedCode)).toHaveLength(0)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([
      { code: 'export default {}', filename: 'src/component.vue.ts' },
      { code: submittedCode, filename: 'src/component.vue.ts' },
    ])
  })

  it('keeps setup diagnostics when the original defineOptions role duplicates the setup source', async () => {
    const statement = 'defineOptions({ name: "NativeReservedProps" });'
    const code = `${statement}\nconst props = defineProps({ id: String })`
    const source = `<script setup lang="ts">${code}</script><template><view /></template>`
    const baselineWarn = vi.fn()
    const baseline = await compileVueFile(source, 'src/component.vue', { warn: baselineWarn })
    const submittedInputs = analyze.mock.calls[0]![0] as NativeCompilerScriptInput[]
    expect(submittedInputs).toHaveLength(2)
    const submittedCode = submittedInputs[0]!.code
    expect(submittedCode).toContain('defineProps')
    expect(submittedInputs[1]!.code).toBe(submittedCode)
    expect(baselineWarn).toHaveBeenCalledTimes(1)
    expect(parse.mock.calls.filter(([input]) => input === submittedCode)).toHaveLength(1)
    analyze.mockClear()
    parse.mockClear()
    analyze.mockImplementation((inputs: NativeCompilerScriptInput[]) => inputs.map(input => ({
      ...summary,
      defineOptionsStatements: [{ start: input.code.indexOf('defineOptions'), end: input.code.indexOf(';') + 1 }],
      reservedPropsDiagnostic: { warningOffset: input.code.indexOf('defineProps') },
    })))
    const nativeWarn = vi.fn()

    const result = await compileVueFile(source, 'src/component.vue', { warn: nativeWarn })

    expect(result).toEqual(baseline)
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(parse.mock.calls.filter(([input]) => input === submittedCode)).toHaveLength(0)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith(submittedInputs)
  })

  it.each([
    ['an old binding summary', summary],
    ['a failed per-item summary', null],
  ] as const)('preserves type diagnostics with %s and executes the original setup fallback once', async (_label, nativeSummary) => {
    const code = 'type Props = { id: string } & { title: string }; const props = defineProps<Props>()'
    const source = createSource(code)
    const baselineWarn = vi.fn()
    const baseline = await compileVueFile(source, 'src/component.vue', { warn: baselineWarn })
    analyze.mockClear()
    parse.mockClear()
    analyze.mockReturnValue([summary, nativeSummary])
    const nativeWarn = vi.fn()

    const result = await compileVueFile(source, 'src/component.vue', { warn: nativeWarn })

    expect(result).toEqual(baseline)
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(nativeWarn).toHaveBeenCalledTimes(1)
    expect(nativeWarn).toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
    expect(parse.mock.calls.filter(([input]) => input === code)).toHaveLength(1)
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('keeps single-block diagnostics on the existing Babel path without a native round trip', async () => {
    const code = 'const props = defineProps({ id: String })'
    const warn = vi.fn()

    await compileVueFile(`<script setup>${code}</script><template><view /></template>`, 'src/component.vue', { warn })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(parse.mock.calls.filter(([input]) => input === code)).toHaveLength(1)
    expect(analyze).not.toHaveBeenCalled()
  })
})
