import { describe, expect, it } from 'vitest'
import { resolveVueLayoutAssetOptions } from './layoutAssets'

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
})
