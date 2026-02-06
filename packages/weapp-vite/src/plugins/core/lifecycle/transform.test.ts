import { describe, expect, it } from 'vitest'
import { createTransformHook } from './transform'

describe('core lifecycle transform hook injectWeapi', () => {
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
})
