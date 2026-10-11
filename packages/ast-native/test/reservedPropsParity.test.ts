import { describe, expect, it } from 'vitest'
import { warnReservedScriptSetupProps } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/reservedProps'
import { isNativeCompilerScriptAnalysis } from '../../ast/src/native/compilerAnalysis'
import { analyzeCompilerScriptsNative } from '../index.js'

describe('native reserved props diagnostic parity', () => {
  it.each([
    ['defineProps({ id: String })', true],
    ['const emoji = "😀"; defineProps(["class"])', true],
    ['const emoji = "😀";\r\n  defineProps({ slot: String })', true],
    ['// 😀\rdefineProps(["id"])', true],
    ['const emoji = "😀";\u2028defineProps(["id"])', true],
    ['const emoji = "😀";\u2029defineProps(["slot"])', true],
    ['(defineProps)(({ id: String }))', true],
    ['defineProps([("class")])', true],
    ['defineProps({ title: defineProps(["slot"]) }); defineProps({ id: String })', true],
    ['defineProps({ id: defineProps(["slot"]) })', true],
    ['defineProps({ title: String })', false],
    ['defineProps({ ["id"]: String })', false],
    ['defineProps({ id() {} })', false],
    ['defineProps({ get id() { return String } })', false],
    ['defineProps({ set id(value) {} })', false],
    ['defineProps({ ...props })', false],
    ['defineProps([`id`, ...props, "title"])', false],
    ['defineProps?.({ id: String })', false],
    ['(defineProps as any)({ id: String })', false],
    ['defineProps({ id: String } as const)', false],
    ['const title = "😀"', false],
  ])('matches production Babel warning text and location for %s', (code, expectedWarning) => {
    const [summary] = analyzeCompilerScriptsNative([{ code, filename: 'component.ts' }])
    expect(summary).not.toBeNull()
    expect(isNativeCompilerScriptAnalysis(summary, code)).toBe(true)
    expect(summary?.reservedPropsDiagnostic).toBeDefined()
    const context = { filename: 'src/component.vue', scriptSetupStart: { line: 3, column: 8 } }
    const baseline: string[] = []
    warnReservedScriptSetupProps(code, message => baseline.push(message), context)
    expect(baseline).toHaveLength(expectedWarning ? 1 : 0)
    const native: string[] = []
    warnReservedScriptSetupProps(code, message => native.push(message), context, summary?.reservedPropsDiagnostic)
    expect(native).toEqual(baseline)
  })

  it.each([
    'defineProps<{ id: string }>()',
    'interface Props { class: string }; defineProps<Props>()',
    'type Props = { slot: string } & { title: string }; defineProps<Props>()',
    'defineProps<{ title: string }>(); defineProps({ id: String })',
    'defineProps({ id: String }); defineProps<{ title: string }>()',
  ])('retains full Babel fallback for typed declarations without losing neighboring summaries: %s', (code) => {
    const results = analyzeCompilerScriptsNative([
      { code: 'defineProps({ title: String })' },
      { code, filename: 'component.ts' },
      { code: 'const =' },
      { code: 'defineProps(["id"])' },
    ])
    expect(results[0]?.reservedPropsDiagnostic).toEqual({})
    expect(results[1]).not.toBeNull()
    expect(results[1]?.reservedPropsDiagnostic).toBeUndefined()
    expect(isNativeCompilerScriptAnalysis(results[1], code)).toBe(true)
    expect(results[2]).toBeNull()
    expect(results[3]?.reservedPropsDiagnostic).toEqual({ warningOffset: 0 })
    const baseline: string[] = []
    const fallback: string[] = []
    warnReservedScriptSetupProps(code, message => baseline.push(message))
    warnReservedScriptSetupProps(code, message => fallback.push(message), {}, results[1]?.reservedPropsDiagnostic)
    expect(baseline).toHaveLength(1)
    expect(fallback).toEqual(baseline)
  })
})
