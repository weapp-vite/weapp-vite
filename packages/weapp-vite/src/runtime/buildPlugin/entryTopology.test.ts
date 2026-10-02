import { expect, it } from 'vitest'
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
