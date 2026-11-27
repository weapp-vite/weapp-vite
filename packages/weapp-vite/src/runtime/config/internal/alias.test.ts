import { describe, expect, it } from 'vitest'
import { createAliasManager, normalizeAliasOptions } from './alias'

describe('runtime config alias', () => {
  it('normalizes alias options from object and array forms', () => {
    expect(normalizeAliasOptions({
      '@': '/project/src',
      '~': '/project/shared',
    } as any)).toEqual([
      { find: '@', replacement: '/project/src' },
      { find: '~', replacement: '/project/shared' },
    ])

    expect(normalizeAliasOptions([
      { find: '@', replacement: '/project/src' },
      null,
      false,
    ] as any)).toEqual([
      { find: '@', replacement: '/project/src' },
    ])
  })

  it('injects oxc and builtin aliases once while preserving existing user aliases', () => {
    const manager = createAliasManager(
      { find: /^~oxc\//, replacement: '/project/.oxc' },
      [
        { find: '@', replacement: '/project/src' },
        { find: '~', replacement: '/project/shared' },
      ],
    )

    const config: any = {
      resolve: {
        alias: [
          { find: '@', replacement: '/user/override' },
          { find: /^~oxc\//, replacement: '/user/oxc' },
          { find: '#', replacement: '/project/hash' },
        ],
      },
    }

    manager.injectBuiltinAliases(config)

    expect(config.resolve.alias).toEqual([
      { find: '~', replacement: '/project/shared' },
      { find: '@', replacement: '/user/override' },
      { find: /^~oxc\//, replacement: '/user/oxc' },
      { find: '#', replacement: '/project/hash' },
    ])
  })
})
