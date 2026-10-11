import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
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
  hasDefaultExport: false,
  defineOptionsStatements: [],
  isMiniProgramComponent: false,
  hasStaticRequireLiteral: false,
  hasPlatformApiAccess: false,
  featureFlags: [],
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
    const source = `<script setup>${code}</script><template><view>{{ title }}</view></template>`
    const baselineWarn = vi.fn()
    const baseline = await compileVueFile(source, 'src/component.vue', { warn: baselineWarn })
    const submittedCode = analyze.mock.calls[0]![0][0].code as string
    expect(parse.mock.calls.filter(([input]) => input === submittedCode)).toHaveLength(1)
    parse.mockClear()
    analyze.mockReturnValue([{ ...summary, reservedPropsDiagnostic: warning ? { warningOffset: submittedCode.indexOf('defineProps') } : {} }])
    const nativeWarn = vi.fn()
    const result = await compileVueFile(source, 'src/component.vue', { warn: nativeWarn })
    expect(result).toEqual(baseline)
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(parse.mock.calls.filter(([input]) => input === submittedCode)).toHaveLength(0)
    expect(analyze).toHaveBeenLastCalledWith([{ code: submittedCode, filename: 'src/component.vue.ts' }])
  })

  it.each([summary, null])('preserves type diagnostics with old or failed per-item native summaries', async (nativeSummary) => {
    const code = 'type Props = { id: string } & { title: string }; const props = defineProps<Props>()'
    const source = `<script setup lang="ts">${code}</script><template><view /></template>`
    const baselineWarn = vi.fn()
    const baseline = await compileVueFile(source, 'src/component.vue', { warn: baselineWarn })
    parse.mockClear()
    analyze.mockReturnValue([nativeSummary])
    const nativeWarn = vi.fn()
    const result = await compileVueFile(source, 'src/component.vue', { warn: nativeWarn })
    expect(result).toEqual(baseline)
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(nativeWarn).toHaveBeenCalledWith(expect.stringContaining('defineProps 中声明 id/class/slot'))
    expect(parse.mock.calls.filter(([input]) => input === code)).toHaveLength(1)
  })
})
