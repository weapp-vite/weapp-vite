import { describe, expect, it, vi } from 'vitest'
import { emitResolvedBundleLayouts, resolveVueLayoutAssetOptions } from './layoutAssets'

describe('resolveVueLayoutAssetOptions', () => {
  it('resolves layout asset output names from platform extensions', () => {
    expect(resolveVueLayoutAssetOptions({
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      layoutBasePath: 'layouts/default/index',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'js',
        wxs: 'sjs',
      },
    })).toEqual({
      relativeBase: 'dist/layouts/default/index',
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'sjs',
    })
  })

  it('returns undefined when relative output path is unavailable', () => {
    expect(resolveVueLayoutAssetOptions({
      configService: {
        relativeOutputPath: () => '',
      } as any,
      layoutBasePath: 'layouts/default/index',
      outputExtensions: undefined,
    })).toBeUndefined()
  })

  it('dispatches resolved bundle layouts by layout kind', async () => {
    const emitNativeLayout = vi.fn(async () => {})
    const emitVueLayout = vi.fn(async () => {})

    await emitResolvedBundleLayouts({
      layouts: [
        { kind: 'native', file: '/layouts/native-default' },
        { kind: 'vue', file: '/layouts/vue-default.vue' },
        { kind: 'native', file: '/layouts/native-second' },
      ],
      emitNativeLayout,
      emitVueLayout,
    })

    expect(emitNativeLayout).toHaveBeenCalledTimes(2)
    expect(emitNativeLayout).toHaveBeenNthCalledWith(1, '/layouts/native-default')
    expect(emitNativeLayout).toHaveBeenNthCalledWith(2, '/layouts/native-second')
    expect(emitVueLayout).toHaveBeenCalledTimes(1)
    expect(emitVueLayout).toHaveBeenCalledWith('/layouts/vue-default.vue')
  })
})
