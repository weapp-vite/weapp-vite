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

  it('injects regex builtin aliases idempotently across repeated config injection', () => {
    const manager = createAliasManager(
      { find: /^~oxc\//, replacement: '/project/.oxc' },
      [],
    )
    const builtin = { find: /^@weapp-core\/shared$/u, replacement: '/shared/index.js' }
    const config: any = { resolve: { alias: [] } }

    manager.injectBuiltinAliases(config, [builtin])
    manager.injectBuiltinAliases(config, [builtin])

    expect(config.resolve.alias.filter((entry: { find: string | RegExp }) => entry.find instanceof RegExp && entry.find.source === builtin.find.source)).toHaveLength(1)
  })
})
