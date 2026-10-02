import { expect, it, vi } from 'vitest'
import { entryTopologySignature, hasEntryTopologyChange } from './entryTopology'

it('compares entry references independently from presentation fields and key ordering', () => {
  const before = { usingComponents: { a: '/a', b: '/b' }, navigationBarTitleText: 'before' }
  const after = { navigationBarTitleText: 'after', usingComponents: { b: '/b', a: '/a' } }
  expect(entryTopologySignature(before)).toBe(entryTopologySignature(after))
  for (const changed of [{ usingComponents: { a: '/a' } }, {}, { pages: ['home', 'other'] }, { componentGenerics: { card: { default: '/new' } } }]) {
    expect(entryTopologySignature(changed)).not.toBe(entryTopologySignature(before))
  }
})

it('compares the previously compiled JSON before reading its new value', async () => {
  const cache = new Map([['page.json', { usingComponents: { card: '/card' } }]])
  const ctx = {
    jsonService: {
      cache,
      read: async (file: string) => {
        cache.delete(file)
        return {}
      },
    },
  } as any
  expect(await hasEntryTopologyChange(ctx, ['page.json'])).toBe(true)
  expect(await hasEntryTopologyChange(ctx, ['page.json'])).toBe(false)
})

it('does not parse external JSON dependencies as mini-program entry configuration', async () => {
  const read = vi.fn(async () => ({ usingComponents: { external: '/unrelated' } }))
  const ctx = { jsonService: { cache: new Map(), read } } as any
  expect(await hasEntryTopologyChange(ctx, ['transform-rules.json', 'data.json.ts'])).toBe(false)
  expect(read).not.toHaveBeenCalled()
})

it('detects the first configuration added to a previously compiled native entry', async () => {
  const read = vi.fn(async () => ({ usingComponents: { card: '/card' } }))
  const ctx = {
    jsonService: { cache: new Map(), read },
    runtimeState: { build: { hmr: { entriesMap: new Map([
      ['/project/pages/home.ts', { path: '/project/pages/home.ts', type: 'page' }],
    ]) } } },
  } as any
  expect(await hasEntryTopologyChange(ctx, ['/project/pages/home.json.ts'])).toBe(true)
  expect(read).toHaveBeenCalledWith('/project/pages/home.json.ts')
})

it('retains the compiled topology baseline after its JSON cache entry is evicted', async () => {
  const ctx = {
    jsonService: { cache: new Map(), read: async () => undefined },
    runtimeState: { build: { hmr: { entriesMap: new Map([
      ['/project/pages/home.ts', {
        path: '/project/pages/home.ts',
        type: 'page',
        jsonPath: '/project/pages/home.json',
        declaredJson: { usingComponents: { card: '/card' } },
      }],
    ]) } } },
  } as any
  expect(await hasEntryTopologyChange(ctx, ['/project/pages/home.json'])).toBe(true)
})
