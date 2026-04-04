import { describe, expect, it, vi } from 'vitest'
import {
  createCachedEntryResolveOptions,
  resolveEntryExtensions,
  resolveEntryPath,
} from './entryResolve'

const pathExistsCachedMock = vi.hoisted(() => vi.fn(async () => true))
const statMock = vi.hoisted(() => vi.fn(async () => ({ isDirectory: () => false })))

vi.mock('./cachePolicy', () => ({
  getPathExistsTtlMs: vi.fn(() => 123),
}))

vi.mock('../plugins/utils/cache', () => ({
  pathExists: pathExistsCachedMock,
}))

vi.mock('@weapp-core/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      stat: statMock,
      pathExists: vi.fn(),
    },
  }
})

describe('resolveEntryPath', () => {
  it('resolves entry extension priority by import kind and directory state', () => {
    expect(resolveEntryExtensions('default', false)[0]).toBe('vue')
    expect(resolveEntryExtensions('named', false)[0]).toBe('ts')
    expect(resolveEntryExtensions('default', true)[0]).toBe('ts')
  })

  it('creates cached entry resolve options with shared ttl exists adapter', async () => {
    const options = createCachedEntryResolveOptions({
      isDev: true,
    }, {
      kind: 'named',
    })

    expect(options.kind).toBe('named')
    expect(await options.exists?.('/dir/index.ts')).toBe(true)
    expect(pathExistsCachedMock).toHaveBeenCalledWith('/dir/index.ts', { ttlMs: 123 })
    expect(await options.stat?.('/dir')).toEqual({ isDirectory: expect.any(Function) })
    expect(statMock).toHaveBeenCalledWith('/dir')
  })

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
