import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readNativeCompilerScriptAnalysis } from './native/compilerAnalysis'

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
  it.each([
    'null',
    '[]',
    '"invalid"',
    '{ warningOffset: null }',
    '{ warningOffset: -1 }',
    '{ warningOffset: 0.5 }',
    '{ warningOffset: 1000 }',
    '{ warningOffset: 1 }',
    '{ warningOffset: Number.NaN }',
    '{ warningOffset: Number.POSITIVE_INFINITY }',
  ])('rejects malformed or split-surrogate reserved props diagnostics per item: %s', async (diagnostic) => {
    const { native } = await fixture(`exports.analyzeCompilerScriptsNative = () => [valid, { ...valid, reservedPropsDiagnostic: ${diagnostic} }, valid]`)
    const value = native.analyzeCompilerScriptsWithNative(
      Array.from({ length: 3 }, () => ({ code: '😀; defineProps({ id: String })' })),
    )
    expect(value).toEqual([valid, null, valid])
  })

  it('accepts missing, empty and valid reserved props diagnostics', async () => {
    const code = 'const emoji = "😀"; defineProps({ id: String })'
    const diagnostic = { warningOffset: code.indexOf('defineProps') }
    const { native } = await fixture(`exports.analyzeCompilerScriptsNative = () => [valid, { ...valid, reservedPropsDiagnostic: {} }, { ...valid, reservedPropsDiagnostic: ${JSON.stringify(diagnostic)} }]`)
    const value = native.analyzeCompilerScriptsWithNative(Array.from({ length: 3 }, () => ({ code })))
    expect(value).toEqual([valid, { ...valid, reservedPropsDiagnostic: {} }, { ...valid, reservedPropsDiagnostic: diagnostic }])
  })

  it('falls back once for a throwing diagnostic getter and keeps valid neighbors', async () => {
    const { native } = await fixture('exports.analyzeCompilerScriptsNative = () => [valid, { ...valid, get reservedPropsDiagnostic() { throw new Error("diagnostic failure") } }, valid]')
    const binding = native.loadNativeAstBindingSync()!
    const analyze = vi.fn(binding.analyzeCompilerScriptsNative)
    binding.analyzeCompilerScriptsNative = analyze

    const value = native.analyzeCompilerScriptsWithNative(Array.from({ length: 3 }, () => ({ code: 'defineProps({})' })))

    expect(value).toEqual([valid, null, valid])
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('reads diagnostic offsets once and exposes only the validated snapshot', () => {
    const code = 'defineProps({ id: String })'
    let reads = 0
    const result = readNativeCompilerScriptAnalysis({
      ...valid,
      reservedPropsDiagnostic: {
        get warningOffset() {
          if (++reads > 1) {
            throw new Error('diagnostic was read again')
          }
          return 0
        },
      },
    }, code)

    expect(reads).toBe(1)
    expect(result?.reservedPropsDiagnostic).toEqual({ warningOffset: 0 })
    expect(result?.reservedPropsDiagnostic?.warningOffset).toBe(0)
    expect(reads).toBe(1)
  })

  it('owns every mutable compiler summary container after validation', () => {
    const code = 'defineOptions({ name: "Page" }); defineProps({ id: String })'
    const raw = {
      imports: [{ local: 'Card', source: './card.vue', kind: 'default', typeOnly: false }],
      defineOptionsStatements: [{ start: 0, end: code.indexOf(';') + 1 }],
      registeredComponents: [{ name: 'Card', local: 'Card' }],
      reservedPropsDiagnostic: { warningOffset: code.indexOf('defineProps') },
    }
    const result = readNativeCompilerScriptAnalysis(raw, code)
    const expected = {
      imports: [{ ...raw.imports[0]! }],
      defineOptionsStatements: [{ ...raw.defineOptionsStatements[0]! }],
      registeredComponents: [{ ...raw.registeredComponents[0]! }],
      reservedPropsDiagnostic: { ...raw.reservedPropsDiagnostic },
    }
    raw.imports[0]!.source = 'changed'
    raw.defineOptionsStatements[0]!.end = 0
    raw.registeredComponents[0]!.name = 'changed'
    raw.reservedPropsDiagnostic.warningOffset = -1

    expect(result).toEqual(expected)
  })

  it.each(['imports', 'defineOptionsStatements', 'registeredComponents'])('rejects sparse %s arrays', async (field) => {
    const { native } = await fixture(`exports.analyzeCompilerScriptsNative = () => [valid, { ...valid, ${field}: new Array(1) }]`)
    expect(native.analyzeCompilerScriptsWithNative([{ code: 'defineProps({})' }, { code: 'defineProps({})' }])).toEqual([valid, null])
  })

  it.each(['imports', 'defineOptionsStatements', 'registeredComponents'].flatMap(field =>
    ['Number.NaN', '-1', '"0"', 'Number.POSITIVE_INFINITY', '0.5'].map(length => [field, length] as const),
  ))('rejects malformed %s array length %s without losing valid neighbors', async (field, length) => {
    const { native } = await fixture(`
exports.analyzeCompilerScriptsNative = () => [valid, {
  ...valid,
  ${field}: new Proxy([], {
    get(target, key) { return key === 'length' ? ${length} : Reflect.get(target, key) }
  })
}, valid]
`)
    const binding = native.loadNativeAstBindingSync()!
    const analyze = vi.fn(binding.analyzeCompilerScriptsNative)
    binding.analyzeCompilerScriptsNative = analyze

    expect(native.analyzeCompilerScriptsWithNative(Array.from({ length: 3 }, () => ({ code: 'defineProps({})' })))).toEqual([valid, null, valid])
    expect(analyze).toHaveBeenCalledTimes(1)
  })

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
