import { describe, expect, it, vi } from 'vitest'
import { createReactPlugin, resolveReactConfigValue } from './index'

describe('react plugin', () => {
  it('resolves project-level defaults', () => {
    expect(resolveReactConfigValue(true)).toEqual({
      compiler: false,
      renderMode: 'auto',
      devWarnings: true,
    })
    expect(resolveReactConfigValue(false)).toBeUndefined()
  })

  it('transforms TSX with the automatic React runtime', async () => {
    const plugin = createReactPlugin({
      configService: { weappViteConfig: { react: true } },
    } as any)[0]
    const result = await plugin.transform!.call({
      warn: vi.fn(),
    } as any, 'export const view = () => <view>hello</view>', '/project/src/pages/index/view.tsx')
    expect(result).toMatchObject({ code: expect.stringContaining('jsx') })
  })

  it('emits a page view template as the page index WXML', async () => {
    const plugin = createReactPlugin({
      configService: {
        cwd: '/project',
        weappViteConfig: { react: true },
      },
    } as any)[0]
    await plugin.transform!.call({ warn: vi.fn() } as any, 'export function View() { return <view>hello</view> }', '/project/src/pages/home/view.tsx')

    const emitted: Array<Record<string, unknown>> = []
    plugin.generateBundle!.call({
      emitFile(asset: Record<string, unknown>) {
        emitted.push(asset)
      },
    } as any, {} as any, {})

    expect(emitted).toContainEqual(expect.objectContaining({
      fileName: 'pages/home/index.wxml',
      source: '<view>hello</view>',
    }))
  })
})
