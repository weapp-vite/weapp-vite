import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseVueFile } from './parse'

const analyze = vi.hoisted(() => vi.fn())
const parseBabel = vi.hoisted(() => vi.fn())
const inlineOptions = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/ast', async original => ({
  ...await original<typeof import('@weapp-vite/ast')>(),
  analyzeCompilerScriptsWithNative: analyze,
}))
vi.mock('../../../../utils/babel', async (original) => {
  const actual = await original<typeof import('../../../../utils/babel')>()
  parseBabel.mockImplementation(actual.parse)
  return { ...actual, parse: parseBabel }
})
vi.mock('../defineOptions/inline', () => ({ inlineScriptSetupDefineOptionsArgs: inlineOptions }))

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
  parseBabel.mockClear()
  inlineOptions.mockReset().mockImplementation(async (code: string) => ({ code }))
})

describe('defineOptions native hash reuse', () => {
  it('keeps the original hash across inlining and Unicode without another Babel parse', async () => {
    const statement = 'defineOptions({ name: "Before" });'
    const code = `const label = "中文😀";\n${statement}`
    const source = `<script setup>${code}</script><template><view /></template>`
    inlineOptions.mockImplementation(async () => ({ code: 'const label = "中文😀";' }))
    analyze.mockReturnValue(undefined)
    const baseline = await parseVueFile(source, 'src/page.vue')
    expect(parseBabel).toHaveBeenCalledTimes(1)
    parseBabel.mockClear()
    const macro = { ...summary, defineOptionsStatements: [{ start: code.indexOf(statement), end: code.length }] }
    analyze.mockReturnValue([summary, macro])

    const current = await parseVueFile(source, 'src/page.vue')

    expect(current.defineOptionsHash).toBe(baseline.defineOptionsHash)
    expect(current.descriptorForCompile).toEqual(baseline.descriptorForCompile)
    expect(parseBabel).not.toHaveBeenCalled()
    expect(analyze).toHaveBeenLastCalledWith([
      { code: 'const label = "中文😀";', filename: 'src/page.vue.ts' },
      { code, filename: 'src/page.vue.ts' },
    ])
  })

  it('falls back once for a missing macro summary while preserving valid sibling results', async () => {
    const source = '<script setup>defineOptions({ name: "Page" });</script>'
    inlineOptions.mockImplementation(async () => ({ code: 'const title = "inlined";' }))
    analyze.mockReturnValue([summary, null])
    const result = await parseVueFile(source, 'src/page.vue')
    expect(result.defineOptionsHash).toHaveLength(12)
    expect(result.nativeScriptAnalysis?.scriptSetup).toBe(summary)
    expect(parseBabel).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('falls back once when the setup and original macro share a failed unique summary', async () => {
    const code = 'defineOptions({ name: "Page" });'
    const source = `<script setup>${code}</script>`
    analyze.mockReturnValue(undefined)
    const baseline = await parseVueFile(source, 'src/page.vue')
    parseBabel.mockClear()
    analyze.mockClear().mockReturnValue([null])

    const result = await parseVueFile(source, 'src/page.vue')

    expect(result.defineOptionsHash).toBe(baseline.defineOptionsHash)
    expect(result.nativeScriptAnalysis?.scriptSetup).toBeUndefined()
    expect(parseBabel).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(analyze).toHaveBeenCalledWith([{ code, filename: 'src/page.vue.ts' }])
  })

  it('trusts a valid empty macro summary without invoking the fallback', async () => {
    analyze.mockReturnValue([summary])
    const result = await parseVueFile('<script setup>function later() { defineOptions({ name: "Nested" }) }</script>', 'src/page.vue')
    expect(result.defineOptionsHash).toBeUndefined()
    expect(parseBabel).not.toHaveBeenCalled()
  })
})
