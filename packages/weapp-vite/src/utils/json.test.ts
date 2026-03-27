import { describe, expect, it } from 'vitest'
import {
  getAliasEntries,
  jsonFileRemoveJsExtension,
  matches,
  parseCommentJson,
  resolveImportee,
  resolveJson,
} from './json'

describe('utils/json resolveJson', () => {
  it('supports helper utilities for parsing and alias matching', () => {
    expect(parseCommentJson('{/*c*/"a":1}')).toEqual({ a: 1 })
    expect(jsonFileRemoveJsExtension('pages/home/index.ts')).toBe('pages/home/index')
    expect(jsonFileRemoveJsExtension('pages/home/index.js')).toBe('pages/home/index')
    expect(matches('foo', 'foo')).toBe(true)
    expect(matches('foo', 'foo/bar')).toBe(true)
    expect(matches(/^foo\//, 'foo/bar')).toBe(true)
    expect(matches('foobar', 'foo')).toBe(false)
  })

  it('normalizes alias entries and resolves importee with and without matches', () => {
    expect(getAliasEntries()).toEqual([])
    expect(getAliasEntries({
      entries: {
        '@': '/project/src',
      },
    })).toEqual([{ find: '@', replacement: '/project/src' }])
    expect(getAliasEntries({
      entries: [
        { find: /^~\//, replacement: '/project/src/' },
      ],
    })).toEqual([{ find: /^~\//, replacement: '/project/src/' }])

    expect(resolveImportee('@/components/card', '')).toBe('@/components/card')
    expect(
      resolveImportee(
        '@/components/card',
        '',
        [{ find: '@', replacement: '/project/src' }],
      ),
    ).toBe('@/components/card')
    expect(
      resolveImportee(
        '@/components/card',
        '/project/src/pages/index/index.json',
        [{ find: '@', replacement: '/project/src' }],
      ),
    ).toBe('../../components/card')
    expect(
      resolveImportee(
        'plain/id',
        '/project/src/pages/index/index.json',
        [{ find: '@', replacement: '/project/src' }],
      ),
    ).toBe('plain/id')
  })

  it('normalizes usingComponents keys for alipay platform', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            HelloWorld: '/components/HelloWorld/HelloWorld',
          },
        },
      },
      undefined,
      'alipay',
    )

    expect(source).toContain('"hello-world": "/components/HelloWorld/HelloWorld"')
    expect(source).not.toContain('"HelloWorld"')
  })

  it('keeps usingComponents keys for non-alipay platform', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            HelloWorld: '/components/HelloWorld/HelloWorld',
          },
        },
      },
      undefined,
      'weapp',
    )

    expect(source).toContain('"HelloWorld": "/components/HelloWorld/HelloWorld"')
  })

  it('rewrites dependency usingComponents paths for alipay with node_modules mode by default', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/button',
            'LocalCard': '/components/LocalCard/index',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          'tdesign-miniprogram': '^1.12.3',
        },
      },
    )

    expect(source).toContain('"t-button": "/node_modules/tdesign-miniprogram/button/button"')
    expect(source).toContain('"local-card": "/components/LocalCard/index"')
  })

  it('supports miniprogram_npm mode for alipay dependency paths', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/button',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          'tdesign-miniprogram': '^1.12.3',
        },
        alipayNpmMode: 'miniprogram_npm',
      },
    )

    expect(source).toContain('"t-button": "/miniprogram_npm/tdesign-miniprogram/button/button"')
  })

  it('adds alipay default placeholder for boolean componentGenerics', () => {
    const source = resolveJson(
      {
        json: {
          componentGenerics: {
            'scoped-slots-items': true,
          },
        },
      },
      undefined,
      'alipay',
    )

    expect(source).toContain('"componentGenerics"')
    expect(source).toContain('"default": "./__weapp_vite_generic_component"')
  })

  it('fills missing default in object componentGenerics for alipay', () => {
    const source = resolveJson(
      {
        json: {
          componentGenerics: {
            list: {
              default: '   ',
            },
            item: {
              default: './custom-item',
            },
          },
        },
      },
      undefined,
      'alipay',
    )!

    const normalized = JSON.parse(source)
    expect(normalized.componentGenerics.list.default).toBe('./__weapp_vite_generic_component')
    expect(normalized.componentGenerics.item.default).toBe('./custom-item')
  })

  it('keeps componentGenerics untouched on non-alipay platforms', () => {
    const source = resolveJson(
      {
        json: {
          componentGenerics: {
            list: true,
          },
        },
      },
      undefined,
      'weapp',
    )!

    const normalized = JSON.parse(source)
    expect(normalized.componentGenerics.list).toBe(true)
  })

  it('keeps non-object componentGenerics values on alipay platform', () => {
    const source = resolveJson(
      {
        json: {
          componentGenerics: {
            list: 'literal',
          },
        },
      },
      undefined,
      'alipay',
    )!

    const normalized = JSON.parse(source)
    expect(normalized.componentGenerics.list).toBe('literal')
  })

  it('keeps plugin and blank usingComponents paths untouched for alipay', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            pluginComp: 'plugin://foo/bar',
            blankComp: '   ',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          foo: '1.0.0',
        },
      },
    )!

    const normalized = JSON.parse(source)
    expect(normalized.usingComponents['plugin-comp']).toBe('plugin://foo/bar')
    expect(normalized.usingComponents['blank-comp']).toBe('   ')
  })

  it('normalizes explicit node_modules paths with miniprogram_npm mode', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            't-button': '/node_modules/tdesign-miniprogram/button/button',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          'tdesign-miniprogram': '^1.12.3',
        },
        alipayNpmMode: 'miniprogram_npm',
      },
    )!

    const normalized = JSON.parse(source)
    expect(normalized.usingComponents['t-button']).toBe('/miniprogram_npm/tdesign-miniprogram/button/button')
  })

  it('returns undefined when json payload is missing', () => {
    expect(resolveJson({})).toBeUndefined()
  })

  it('resolves aliases before platform normalization for app json and removes schema', () => {
    const source = resolveJson(
      {
        json: {
          $schema: 'https://example.com/schema.json',
          usingComponents: {
            TButton: '@/components/TButton',
          },
          subPackages: [
            { root: 'pkg-a', entry: 'workers/task.ts' },
          ],
          subpackages: [
            { root: 'pkg-b', entry: 'workers/legacy.mts' },
          ],
        },
        jsonPath: '/project/src/app.json',
        type: 'app',
      },
      [{ find: '@', replacement: '/project/src' }],
      'alipay',
      {
        dependencies: {},
      },
    )!

    const normalized = JSON.parse(source)
    expect(normalized.$schema).toBeUndefined()
    expect(normalized.usingComponents['t-button']).toBe('components/TButton')
    expect(normalized.subPackages[0].entry).toBe('workers/task.js')
    expect(normalized.subpackages[0].entry).toBe('workers/legacy.js')
  })

  it('keeps already-normalized npm prefix and ignores unmatched dependencies', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            't-button': '/node_modules/tdesign-miniprogram/button/button',
            'x-card': 'custom-lib/card/index',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          'tdesign-miniprogram': '^1.12.3',
        },
      },
    )!

    const normalized = JSON.parse(source)
    expect(normalized.usingComponents['t-button']).toBe('/node_modules/tdesign-miniprogram/button/button')
    expect(normalized.usingComponents['x-card']).toBe('custom-lib/card/index')
  })

  it('keeps blank and already-prefixed npm-like component ids stable', () => {
    const source = resolveJson(
      {
        json: {
          usingComponents: {
            'empty': 'npm:',
            't-button': '/node_modules/tdesign-miniprogram/button/button',
          },
        },
      },
      undefined,
      'alipay',
      {
        dependencies: {
          '': '0.0.0',
          'tdesign-miniprogram/button/button/extra': '^1.0.0',
          'tdesign-miniprogram': '^1.12.3',
        },
      },
    )!

    const normalized = JSON.parse(source)
    expect(normalized.usingComponents.empty).toBe('npm:')
    expect(normalized.usingComponents['t-button']).toBe('/node_modules/tdesign-miniprogram/button/button')
  })
})
