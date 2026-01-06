import { describe, expect, it } from 'vitest'
import { createViteResolverAdapter } from './viteResolverAdapter'

describe('createViteResolverAdapter', () => {
  it('loads code for resolved ids and skips virtual/node ids', async () => {
    const adapter = createViteResolverAdapter(
      {
        resolve: async (source) => {
          if (source === 'a') {
            return { id: '/abs/a.ts?import' }
          }
          if (source === 'virtual') {
            return { id: '\0virtual:dep' }
          }
          return null
        },
      },
      {
        readFile: async (id) => {
          if (id === '/abs/a.ts') {
            return 'ok'
          }
          throw new Error('unexpected')
        },
      },
      { checkMtime: false },
    )

    await expect(adapter.resolveId('a')).resolves.toBe('/abs/a.ts?import')
    await expect(adapter.loadCode('/abs/a.ts?import')).resolves.toBe('ok')
    await expect(adapter.loadCode('\0virtual:dep')).resolves.toBeUndefined()
    await expect(adapter.loadCode('node:fs')).resolves.toBeUndefined()
  })
})
