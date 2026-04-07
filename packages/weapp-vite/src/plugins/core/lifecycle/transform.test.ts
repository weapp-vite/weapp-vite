import { parseSync } from 'oxc-parser'
import { describe, expect, it, vi } from 'vitest'
import { createTransformHook } from './transform'

describe('core lifecycle transform hook injectWeapi', () => {
  it('injects request globals for declared page entries as transform fallback', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
          relativeAbsoluteSrcRoot(id: string) {
            return id.replace('/project/src/', '')
          },
        },
      },
      entriesMap: new Map([
        ['pages/request-globals/fetch', { type: 'page', path: 'pages/request-globals/fetch' }],
      ]),
    } as any)

    const result = await transform('export const value = 1', '/project/src/pages/request-globals/fetch.vue')
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('"fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"')
    expect(code).toContain('export const value = 1')
  })

  it('injects request globals for loaded page entries even before entriesMap is populated', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
          relativeAbsoluteSrcRoot(id: string) {
            return id.replace('/project/src/', '')
          },
        },
      },
      loadedEntrySet: new Set(['/project/src/pages/request-globals/fetch.vue']),
      entriesMap: new Map(),
    } as any)

    const result = await transform('export const value = 1', '/project/src/pages/request-globals/fetch.vue')
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('"fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"')
    expect(code).toContain('export const value = 1')
  })

  it('injects request globals into existing vue script blocks when transform fallback receives raw sfc code', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
          relativeAbsoluteSrcRoot(id: string) {
            return id.replace('/project/src/', '')
          },
        },
      },
      loadedEntrySet: new Set(['/project/src/pages/request-globals/fetch.vue']),
      entriesMap: new Map(),
    } as any)

    const result = await transform(
      [
        '<script setup lang="ts">',
        'const value = 1',
        '</script>',
        '<script lang="ts">',
        'export default {}',
        '</script>',
      ].join('\n'),
      '/project/src/pages/request-globals/fetch.vue',
    )
    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''

    expect(code.match(/<script\b/g)?.length).toBe(2)
    expect(code).toContain('<script lang="ts">import { installRequestGlobals')
    expect(code).toContain('export default {}')
  })

  it('rewrites wx/my member access to configured global api', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    } as any)

    const result = await transform('export const a = wx.showToast({ title: "ok" }); export const b = my.setClipboardData({ data: "x" })', '/project/src/a.ts')

    const code = result && typeof result === 'object' && 'code' in result ? result.code : ''
    expect(code).toContain('showToast')
    expect(code).toContain('setClipboardData')
    expect(code).toContain('typeof globalThis')
    expect(code).not.toContain('wx.showToast')
    expect(code).not.toContain('my.setClipboardData')
  })

  it('does not rewrite when replaceWx is disabled', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
            },
          },
        },
      },
    } as any)

    const result = await transform('export const a = wx.showToast({ title: "ok" })', '/project/src/a.ts')
    expect(result).toBeNull()
  })

  it('does not rewrite files outside src root', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    } as any)

    const result = await transform('export const a = wx.showToast({ title: "ok" })', '/project/node_modules/pkg/index.js')
    expect(result).toBeNull()
  })

  it('skips style requests under src root', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          weappViteConfig: {},
          relativeAbsoluteSrcRoot(id: string) {
            return id.replace('/project/src/', '')
          },
        },
      },
      entriesMap: new Map([
        ['pages/request-globals/fetch', { type: 'page', path: 'pages/request-globals/fetch' }],
      ]),
    } as any)

    const result = await transform('.page {}', '/project/src/pages/request-globals/fetch.vue?weapp-vite-vue&type=style&index=0')
    expect(result).toBeNull()
  })

  it('respects local bindings and avoids unsafe replacements', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    } as any)

    const result = await transform('const wx = createMock(); export const a = wx.showToast({ title: "ok" })', '/project/src/a.ts')
    expect(result).toBeNull()
  })

  it('keeps babel as default ast engine', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    } as any)

    const parseSpy = {
      parse: vi.fn((code: string) => parseSync('/project/src/a.ts', code).program),
    }

    const result = await transform.call(parseSpy, 'export const value = foo.bar({ title: "ok" })', '/project/src/a.ts')
    expect(result).toBeNull()
    expect(parseSpy.parse).not.toHaveBeenCalled()
  })

  it('fast rejects without rolldown parse when ast engine is oxc and source has no platform api access', async () => {
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          weappViteConfig: {
            ast: {
              engine: 'oxc',
            },
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    } as any)

    const parseSpy = {
      parse: vi.fn((code: string) => parseSync('/project/src/a.ts', code).program),
    }

    const result = await transform.call(parseSpy, 'export const value = foo.bar({ title: "ok" })', '/project/src/a.ts')
    expect(result).toBeNull()
    expect(parseSpy.parse).not.toHaveBeenCalled()
  })
})
