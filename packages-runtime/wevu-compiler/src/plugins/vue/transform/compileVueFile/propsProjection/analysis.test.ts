import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../utils/babel'
import { resolveSetupPropConflicts } from './index'

function fixture(files: Record<string, string> = {}) {
  const filename = path.resolve('src/navigation.vue')
  const sources = new Map(Object.entries(files).map(([id, source]) => [path.resolve('src', id), source]))
  const reads: string[] = []
  const resolveId = vi.fn(async (source: string, importer = filename) => {
    if (!source.startsWith('.')) {
      return undefined
    }
    const id = path.resolve(path.dirname(importer), source)
    return [id, `${id}.ts`, `${id}/index.ts`].find(candidate => sources.has(candidate)) ?? `${id}.ts`
  })
  const readFile = vi.fn(async (id: string) => {
    reads.push(id)
    const source = sources.get(id)
    if (source === undefined) {
      throw Object.assign(new Error('Missing analysis fixture'), { code: 'ENOENT' })
    }
    return source
  })
  const analyze = (preamble: string, props: string, keys = ['haveNext', 'havePrev']) => {
    const script = `${preamble}\nexport default { props: ${props}, setup(__props) { const props = __props; return {} } }`
    return resolveSetupPropConflicts({
      script,
      bindings: Object.fromEntries([...keys, 'props'].map(key => [key, 'setup-ref'])),
      getScriptAst: () => parseJsLike(script),
      filename,
      source: { resolveId, readFile },
    })
  }
  return { analyze, filename, sources, reads, resolveId, readFile }
}

describe('props key proofs', () => {
  it.each([
    ['local object', 'const base = { max: Number }', 'base'],
    ['local aliases', 'const base = { max: Number }; const alias = base', '{ ...alias }'],
    ['nested spreads', 'const base = { max: Number }; const extra = { ...base, min: Number }', '{ ...extra }'],
    ['static computed key', 'const key = "max"', '{ [key]: Number }'],
    ['literal computed key', '', '{ ["max"]: Number }'],
    ['typed object', 'const base = { max: Number } as const', 'base satisfies Record<string, unknown>'],
    ['local frozen alias', 'const base = { max: Number }; const frozen = Object.freeze(base)', 'frozen'],
    ['fresh assign', 'const base = { max: Number }', 'Object.assign({}, base, { min: Number })'],
    ['local array', 'const base = ["max"]', 'base'],
    ['array spread', 'const base = ["max"]', '[...base, "min"]'],
  ])('proves %s without projecting unrelated bindings', async (_kind, preamble, props) => {
    const current = fixture()
    const result = await current.analyze(preamble, props)
    expect(result.conflicts).toEqual([])
    expect(result.dependencies).toEqual([])
    expect(current.readFile).not.toHaveBeenCalled()
  })

  it.each([
    ['named', 'export const props = Object.freeze({ max: Number })', 'import { props as declared } from "./props"', 'declared'],
    ['default', 'export default Object.freeze({ max: Number })', 'import declared from "./props"', 'declared'],
    ['namespace', 'export const props = Object.freeze({ max: Number })', 'import * as declared from "./props"', 'declared.props'],
    ['string export', 'const value = Object.freeze({ max: Number }); export { value as "nav-props" }', 'import { "nav-props" as declared } from "./props"', 'declared'],
    ['spread', 'export const props = Object.freeze({ max: Number })', 'import { props as declared } from "./props"', '{ ...declared }'],
    ['array', 'export const props = Object.freeze(["max"])', 'import { props as declared } from "./props"', 'declared'],
  ])('proves a frozen %s import', async (_kind, source, imports, props) => {
    const current = fixture({ 'props.ts': source })
    const result = await current.analyze(imports, props)
    expect(result.conflicts).toEqual([])
    expect(result.dependencies).toEqual(expect.arrayContaining([path.resolve('src/props.ts')]))
    expect(current.reads).toEqual([path.resolve('src/props.ts')])
  })

  it('retains only true conflicts through explicit re-exports and shared imports', async () => {
    const current = fixture({
      'props.ts': 'export const props = Object.freeze({ max: Number, haveNext: Boolean })',
      'barrel.ts': 'export { props as navigation } from "./props"',
    })
    const result = await current.analyze('import { navigation } from "./barrel"; import { props as shared } from "./props"', '{ ...navigation, ...shared }')
    expect(result.conflicts).toEqual(['haveNext'])
    expect(result.dependencies).toEqual(expect.arrayContaining([path.resolve('src/barrel.ts'), path.resolve('src/props.ts')]))
    expect(current.reads).toEqual([path.resolve('src/barrel.ts'), path.resolve('src/props.ts')])
  })

  it('resolves an imported immutable primitive key without treating its object as frozen', async () => {
    const current = fixture({ 'key.ts': 'export const key = "haveNext"' })
    const result = await current.analyze('import { key } from "./key"', '{ [key]: Boolean }')
    expect(result.conflicts).toEqual(['haveNext'])
    expect(result.dependencies).toEqual(expect.arrayContaining([path.resolve('src/key.ts')]))
  })

  it.each([
    ['reassigned binding', 'let base = { max: Number }; base = other', 'base'],
    ['member assignment', 'const base = { max: Number }; base.haveNext = Boolean', 'base'],
    ['member deletion', 'const base = { max: Number }; delete base.max', '{ ...base }'],
    ['defineProperty', 'const base = { max: Number }; Object.defineProperty(base, "haveNext", descriptor)', '{ ...base }'],
    ['opaque call', 'const base = { max: Number }; mutate(base)', '{ ...base }'],
    ['escaped alias', 'const base = { max: Number }; const alias = base; mutate(alias)', '{ ...base }'],
    ['escaped member', 'const base = { max: Number }; const other = { base }; mutate(other)', '{ ...base }'],
    ['exported mutable object', 'export const base = { max: Number }', '{ ...base }'],
    ['unknown key', 'const key = readKey()', '{ [key]: Number }'],
    ['getter', '', 'Object.freeze({ get max() { return Number } })'],
    ['prototype', '', 'Object.freeze({ __proto__: inherited })'],
    ['shadowed Object', 'const Object = custom', 'Object.freeze({ max: Number })'],
    ['mutable assign target', 'const base = { max: Number }', 'Object.assign(base, { min: Number })'],
    ['arbitrary factory', '', 'makeProps({ max: Number })'],
  ])('keeps the conservative projection for %s', async (_kind, preamble, props) => {
    expect((await fixture().analyze(preamble, props)).conflicts).toEqual(['haveNext', 'havePrev'])
  })

  it.each([
    ['mutable object', 'export const props = { max: Number }'],
    ['mutable array', 'export const props = ["max"]'],
    ['reassigned frozen binding', 'export let props = Object.freeze({ max: Number }); props = other'],
    ['unknown freeze input', 'export const props = Object.freeze(makeProps())'],
    ['getter freeze input', 'export const props = Object.freeze({ get max() { return Number } })'],
    ['mutable alias before freeze', 'const base = { max: Number }; mutate(base); export const props = Object.freeze(base)'],
    ['unsupported export star', 'export * from "./other"'],
  ])('does not trust an imported %s', async (_kind, source) => {
    const current = fixture({ 'props.ts': source })
    const result = await current.analyze('import { props } from "./props"', 'props')
    expect(result.conflicts).toEqual(['haveNext', 'havePrev'])
  })

  it('stops re-export cycles and retains the visited dependency closure', async () => {
    const current = fixture({
      'a.ts': 'export { props } from "./b"',
      'b.ts': 'export { props } from "./a"',
    })
    const result = await current.analyze('import { props } from "./a"', 'props')
    expect(result.conflicts).toEqual(['haveNext', 'havePrev'])
    expect(result.dependencies).toEqual(expect.arrayContaining([path.resolve('src/a.ts'), path.resolve('src/b.ts')]))
  })

  it('recomputes a changed and restored dependency on each analysis', async () => {
    const current = fixture({ 'props.ts': 'export const props = Object.freeze({ max: Number })' })
    const analyze = () => current.analyze('import { props } from "./props"', 'props')
    expect((await analyze()).conflicts).toEqual([])
    current.sources.set(path.resolve('src/props.ts'), 'export const props = Object.freeze({ haveNext: Boolean })')
    expect((await analyze()).conflicts).toEqual(['haveNext'])
    current.sources.set(path.resolve('src/props.ts'), 'export const props = Object.freeze({ max: Number })')
    expect((await analyze()).conflicts).toEqual([])
  })

  it.each([undefined, 'ENOENT', 'ENOTDIR'])('propagates the original custom-reader error (%s)', async (code) => {
    const current = fixture({ 'props.ts': '' })
    const error = Object.assign(new Error('Compilation source changed'), { code })
    current.readFile.mockRejectedValueOnce(error)
    await expect(current.analyze('import { props } from "./props"', 'props')).rejects.toBe(error)
  })

  it('propagates the original custom-resolver error even when it resembles a missing file', async () => {
    const current = fixture()
    const error = Object.assign(new Error('Resolution input changed'), { code: 'ENOENT' })
    current.resolveId.mockRejectedValueOnce(error)
    await expect(current.analyze('import { props } from "./props"', 'props')).rejects.toBe(error)
  })

  it('tracks logical import paths as well as a resolved physical target', async () => {
    const current = fixture({ 'physical.ts': 'export const props = Object.freeze({ max: Number })' })
    current.resolveId.mockResolvedValue(path.resolve('src/physical.ts'))
    const result = await current.analyze('import { props } from "./alias"', 'props')
    expect(result.conflicts).toEqual([])
    expect(result.dependencies).toEqual(expect.arrayContaining([
      path.resolve('src/alias'),
      path.resolve('src/alias.ts'),
      path.resolve('src/alias/index.ts'),
      path.resolve('src/physical.ts'),
    ]))
    expect(current.reads).toEqual([path.resolve('src/physical.ts')])
  })

  it('does not inspect unused imported modules for inline props', async () => {
    const current = fixture()
    expect((await current.analyze('import { something } from "./unrelated"', '{ max: Number }')).conflicts).toEqual([])
    expect(current.resolveId).not.toHaveBeenCalled()
    expect(current.readFile).not.toHaveBeenCalled()
  })
})
