import { describe, expect, it } from 'vitest'
import { resolveEntryPath } from './entryResolve'

describe('resolveEntryPath', () => {
  it('resolves directory to index.ts for named imports', async () => {
    const resolved = await resolveEntryPath('/dir', {
      kind: 'named',
      stat: async () => ({ isDirectory: () => true }),
      exists: async p => p === '/dir/index.ts',
    })
    expect(resolved).toBe('/dir/index.ts')
  })

  it('resolves extensionless to .vue for default imports', async () => {
    const resolved = await resolveEntryPath('/comp/Button', {
      kind: 'default',
      stat: async () => ({ isDirectory: () => false }),
      exists: async p => p === '/comp/Button.vue',
    })
    expect(resolved).toBe('/comp/Button.vue')
  })
})
