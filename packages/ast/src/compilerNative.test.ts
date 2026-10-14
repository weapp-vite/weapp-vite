import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let directory: string | undefined
const valid = {
  imports: [],
  defineOptionsStatements: [],
}

async function fixture(body: string) {
  directory = await mkdtemp(join(tmpdir(), 'compiler-native-'))
  const filename = join(directory, 'binding.cjs')
  await writeFile(filename, `const valid = ${JSON.stringify(valid)}; ${body}`)
  vi.stubEnv('WEAPP_VITE_NATIVE', '1')
  vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', filename)
  vi.resetModules()
  return {
    native: await import('./native'),
  }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.resetModules()
  if (directory) {
    await rm(directory, { recursive: true, force: true })
    directory = undefined
  }
})

describe('compiler native result validation', () => {
  it('keeps valid neighboring items and counts every failed item once', async () => {
    const { native } = await fixture('exports.analyzeCompilerScriptsNative = () => [valid, null, { ...valid, imports: [null] }, valid]')
    const value = native.analyzeCompilerScriptsWithNative(
      Array.from({ length: 4 }, () => ({ code: 'defineOptions({})' })),
    )
    expect(value).toEqual([valid, null, null, valid])
  })

  it.each([
    'exports.analyzeCompilerScriptsNative = () => { throw new Error("native failure") }',
    'exports.analyzeCompilerScriptsNative = () => [valid]',
    'exports.analyzeCompilerScriptsNative = () => null',
    'exports.analyzeCompilerScriptsNative = () => ({})',
  ])('counts a full batch fallback once per item for %s', async (body) => {
    const { native } = await fixture(body)
    const value = native.analyzeCompilerScriptsWithNative([
      { code: 'const value = 1' },
      { code: 'const other = 2' },
    ])
    expect(value).toEqual([null, null])
  })

  it('counts missing capability fallback and keeps an empty batch cold', async () => {
    const { native } = await fixture('')
    expect(native.analyzeCompilerScriptsWithNative([])).toEqual([])
    const value = native.analyzeCompilerScriptsWithNative([{ code: '' }, { code: '' }])
    expect(value).toEqual([null, null])
  })

  it.each([
    [{ start: -1, end: 2 }],
    [{ start: 0, end: 1000 }],
    [{ start: 2, end: 1 }],
    [{ start: 0.5, end: 2 }],
    [{ start: 1, end: 2 }],
    [{ start: 0, end: 1 }],
    [{ start: 0, end: 2 }, { start: 0, end: 2 }],
  ])('rejects invalid or split-surrogate statement spans %j', async (...spans) => {
    const { native } = await fixture(`exports.analyzeCompilerScriptsNative = () => [{ ...valid, defineOptionsStatements: ${JSON.stringify(spans)} }]`)
    const value = native.analyzeCompilerScriptsWithNative([{ code: '😀; defineOptions({})' }])
    expect(value).toEqual([null])
  })

  it('accepts valid UTF-16 statement ranges', async () => {
    const code = 'const emoji = "😀"; defineOptions({})'
    const spans = [{ start: code.indexOf('defineOptions'), end: code.length }]
    const { native } = await fixture(`exports.analyzeCompilerScriptsNative = () => [{ ...valid, defineOptionsStatements: ${JSON.stringify(spans)} }]`)
    const value = native.analyzeCompilerScriptsWithNative([{ code }])
    expect(value?.[0]?.defineOptionsStatements).toEqual(spans)
  })
})
