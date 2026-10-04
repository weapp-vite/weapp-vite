import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { ResolvedAutoImportComponent } from '../autoImport'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { materializeVueAutoImportEntries } from './autoImport'

function createMaterializer(sourceRoot = '/project/src', resolvedSource?: string) {
  const externalComponentEntryMap = new Map<string, string>()
  const configService = {
    relativeOutputPath: (id: string) => path.relative(sourceRoot, id),
  }
  const ctx = {
    configService,
    runtimeState: { build: { hmr: { externalComponentEntryMap } } },
  } as unknown as CompilerContext
  const resolve = vi.fn(async (_source: string, _importer?: string) => resolvedSource ? { id: resolvedSource } : null)
  const pluginCtx = { resolve } as unknown as PluginContext
  const importer = path.join(sourceRoot, 'pages/home.vue')

  return {
    externalComponentEntryMap,
    importer,
    resolve,
    async materialize(records: ResolvedAutoImportComponent[]) {
      const json = {
        usingComponents: Object.fromEntries(records.map((record, index) => [`Card${index}`, record.from])),
      }
      const entries = await materializeVueAutoImportEntries(ctx, pluginCtx, importer, json, records)
      return { entries, json }
    },
  }
}

describe('materializeVueAutoImportEntries provenance', () => {
  it.each([
    'C:\\project\\src\\components\\Card.vue',
    'C:/project/src/components/Card.vue',
    '/@fs/C:/project/src/components/Card.vue?import',
  ])('normalizes a Windows physical source while preserving a custom runtime path: %s', async (resolvedId) => {
    const { materialize, resolve, externalComponentEntryMap } = createMaterializer('C:/project/src')
    const { entries, json } = await materialize([{ kind: 'local', from: '/custom/Card', resolvedId }])

    expect(entries).toEqual(['/custom/Card'])
    expect(json.usingComponents).toEqual({ Card0: '/custom/Card' })
    expect(externalComponentEntryMap.get('custom/Card')).toBe('C:/project/src/components/Card.vue')
    expect(resolve).not.toHaveBeenCalled()
  })

  it.each([
    'custom-ui/Card',
    '../components/Card',
    '../components/Card.vue',
    '/project/src/components/Card',
    '/project/src/components/Card.vue?import',
    '/@fs/project/src/components/Card',
    '/absolute-alias/Card',
  ])('preserves bundler resolution for resolver-origin requests even with a physical source: %s', async (from) => {
    const source = '/project/src/components/Resolved.vue'
    const { materialize, resolve, importer, externalComponentEntryMap } = createMaterializer('/project/src', source)
    const { entries, json } = await materialize([{
      kind: 'resolver',
      from,
      resolvedId: '/project/src/components/Card.vue',
      sourceType: 'wevu-sfc',
    }])

    expect(entries).toEqual(['/components/Resolved'])
    expect(json.usingComponents).toEqual({ Card0: '/components/Resolved' })
    expect(externalComponentEntryMap.get('components/Resolved')).toBe(source)
    expect(resolve).toHaveBeenCalledExactlyOnceWith(from, importer)
  })

  it('retains a custom resolver runtime mapping when the bundler does not resolve its request', async () => {
    const from = '/custom/Card'
    const source = '/project/src/components/Card.vue'
    const { materialize, resolve, importer, externalComponentEntryMap } = createMaterializer()
    externalComponentEntryMap.set('custom/Card', source)
    const { entries, json } = await materialize([{ kind: 'resolver', from, resolvedId: source }])

    expect(entries).toEqual([from])
    expect(json.usingComponents).toEqual({ Card0: from })
    expect(externalComponentEntryMap.get('custom/Card')).toBe(source)
    expect(resolve).toHaveBeenCalledExactlyOnceWith(from, importer)
  })

  it.each([undefined, 'relative/Card.vue', '\0virtual:Card.vue'])('resolves local records that do not carry a proven physical source: %s', async (resolvedId) => {
    const source = '/project/src/components/Resolved.vue'
    const from = '/components/Card'
    const { materialize, resolve, importer, externalComponentEntryMap } = createMaterializer('/project/src', source)
    const { entries, json } = await materialize([{ kind: 'local', from, resolvedId }])

    expect(entries).toEqual(['/components/Resolved'])
    expect(json.usingComponents).toEqual({ Card0: '/components/Resolved' })
    expect(externalComponentEntryMap.get('components/Resolved')).toBe(source)
    expect(resolve).toHaveBeenCalledExactlyOnceWith(from, importer)
  })

  it.each([undefined, '/project/src/components/Native.js'])('keeps native resolver metadata on the existing bundler path: %s', async (resolvedId) => {
    const source = '/project/src/components/Resolved.vue'
    const from = 'custom-ui/Card'
    const { materialize, resolve, importer, externalComponentEntryMap } = createMaterializer('/project/src', source)
    const { entries, json } = await materialize([{ kind: 'resolver', from, resolvedId, sourceType: 'native' }])

    expect(entries).toEqual(['/components/Resolved'])
    expect(json.usingComponents).toEqual({ Card0: '/components/Resolved' })
    expect(externalComponentEntryMap.get('components/Resolved')).toBe(source)
    expect(resolve).toHaveBeenCalledExactlyOnceWith(from, importer)
  })

  it.each<{ records: ResolvedAutoImportComponent[] }>([
    { records: [
      { kind: 'local', from: '/components/Card', resolvedId: '/project/src/components/First.vue' },
      { kind: 'local', from: '/components/Card', resolvedId: '/project/src/components/Second.vue' },
      { kind: 'local', from: '/components/Card', resolvedId: '/project/src/components/First.vue' },
    ] },
    { records: [
      { kind: 'local', from: '/components/Card', resolvedId: '/project/src/components/Card.vue' },
      { kind: 'resolver', from: '/components/Card', resolvedId: '/project/src/components/Card.vue' },
    ] },
    { records: [
      { kind: 'local', from: '/components/Card', resolvedId: '/project/src/components/Card.vue', sourceType: 'native' },
      { kind: 'local', from: '/components/Card', resolvedId: '/project/src/components/Card.vue', sourceType: 'wevu-sfc' },
    ] },
    { records: [
      { kind: 'local', from: '/components/Card', resolvedId: '/project/src/components/Card.vue' },
      { kind: 'resolver', from: '/components/Card' },
    ] },
  ])('resolves conflicting current records once instead of selecting a source: %j', async ({ records }) => {
    const source = '/project/src/components/Resolved.vue'
    const { materialize, resolve, importer, externalComponentEntryMap } = createMaterializer('/project/src', source)
    const { entries, json } = await materialize(records)

    expect(entries).toEqual(['/components/Resolved'])
    expect(Object.values(json.usingComponents)).toEqual(records.map(() => '/components/Resolved'))
    expect(externalComponentEntryMap.get('components/Resolved')).toBe(source)
    expect(resolve).toHaveBeenCalledExactlyOnceWith('/components/Card', importer)
  })
})
