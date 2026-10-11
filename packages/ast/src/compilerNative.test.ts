import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let directory: string | undefined
const valid = {
  imports: [],
  hasDefaultExport: false,
  defineOptionsStatements: [],
  isMiniProgramComponent: false,
  hasStaticRequireLiteral: false,
  hasPlatformApiAccess: false,
  featureFlags: [],
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
    observation: await import('./native/observation'),
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
    const { native, observation } = await fixture('exports.analyzeCompilerScriptsNative = () => [valid, null, { ...valid, imports: [null] }, valid]')
    const { value, stats } = await observation.observeNativeAnalysis(() => native.analyzeCompilerScriptsWithNative(
      Array.from({ length: 4 }, () => ({ code: 'defineOptions({})' })),
    ))
    expect(value).toEqual([valid, null, null, valid])
    expect(stats).toMatchObject({ bindingCalls: 1, batchCalls: 1, inputScripts: 4, fallbacks: 2 })
  })

  it.each(['imports', 'registeredComponents', 'featureFlags'])(
    'rejects sparse %s without discarding valid neighboring summaries',
    async (field) => {
      const complete = {
        ...valid,
        imports: [{ local: 'Card', imported: 'default', source: './card', kind: 'default', typeOnly: false }],
        registeredComponents: [{ name: 'Card', local: 'Card' }],
        hasDefaultExport: true,
        featureFlags: ['onPageScroll'],
      }
      const { native, observation } = await fixture(`
        const complete = ${JSON.stringify(complete)};
        const sparse = [complete.${field}[0], , complete.${field}[0]];
        exports.analyzeCompilerScriptsNative = () => [complete, { ...complete, ${field}: sparse }, complete];
      `)
      const { value, stats } = await observation.observeNativeAnalysis(() => native.analyzeCompilerScriptsWithNative(
        Array.from({ length: 3 }, () => ({ code: 'import Card from "./card"; export default { components: { Card } }' })),
      ))
      expect(value).toEqual([complete, null, complete])
      expect(stats).toMatchObject({ bindingCalls: 1, batchCalls: 1, inputScripts: 3, fallbacks: 1 })
    },
  )

  it.each([
    'exports.analyzeCompilerScriptsNative = () => { throw new Error("native failure") }',
    'exports.analyzeCompilerScriptsNative = () => [valid]',
    'exports.analyzeCompilerScriptsNative = () => null',
    'exports.analyzeCompilerScriptsNative = () => ({})',
  ])('counts a full batch fallback once per item for %s', async (body) => {
    const { native, observation } = await fixture(body)
    const { value, stats } = await observation.observeNativeAnalysis(() => native.analyzeCompilerScriptsWithNative([
      { code: 'const value = 1' },
      { code: 'const other = 2' },
    ]))
    expect(value).toEqual([null, null])
    expect(stats).toMatchObject({ bindingCalls: 1, fallbacks: 2 })
  })

  it('counts missing capability fallback and keeps an empty batch cold', async () => {
    const { native, observation } = await fixture('')
    const { value, stats } = await observation.observeNativeAnalysis(() => {
      expect(native.analyzeCompilerScriptsWithNative([])).toEqual([])
      return native.analyzeCompilerScriptsWithNative([{ code: '' }, { code: '' }])
    })
    expect(value).toEqual([null, null])
    expect(stats).toMatchObject({ bindingCalls: 0, fallbacks: 2 })
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
    const { native, observation } = await fixture(`exports.analyzeCompilerScriptsNative = () => [{ ...valid, defineOptionsStatements: ${JSON.stringify(spans)} }]`)
    const { value, stats } = await observation.observeNativeAnalysis(() => native.analyzeCompilerScriptsWithNative([{ code: '😀; defineOptions({})' }]))
    expect(value).toEqual([null])
    expect(stats).toMatchObject({ bindingCalls: 1, fallbacks: 1 })
  })

  it('accepts valid UTF-16 statement ranges', async () => {
    const code = 'const emoji = "😀"; defineOptions({})'
    const spans = [{ start: code.indexOf('defineOptions'), end: code.length }]
    const { native, observation } = await fixture(`exports.analyzeCompilerScriptsNative = () => [{ ...valid, defineOptionsStatements: ${JSON.stringify(spans)} }]`)
    const { value, stats } = await observation.observeNativeAnalysis(() => native.analyzeCompilerScriptsWithNative([{ code }]))
    expect(value?.[0]?.defineOptionsStatements).toEqual(spans)
    expect(stats.fallbacks).toBe(0)
  })
})
