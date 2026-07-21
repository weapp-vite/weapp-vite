import { describe, expect, it, vi } from 'vitest'
import {
  resolveNativeLayoutOutputOptions,
  resolveNativeLayoutStaticAssetEntries,
} from './nativeLayout'

describe('native layout helpers', () => {
  it('resolves native layout output names from compiler extensions', () => {
    expect(resolveNativeLayoutOutputOptions({
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      layoutBasePath: 'layouts/default/index',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'mjs',
        wxs: 'sjs',
      },
    })).toEqual({
      relativeBase: 'dist/layouts/default/index',
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json',
      scriptExtension: 'mjs',
      scriptModuleExtension: 'sjs',
    })
  })

  it('resolves native layout template and style asset entries', async () => {
    const readFile = vi.fn(async (file: string) => `${file}:content`)

    expect(await resolveNativeLayoutStaticAssetEntries({
      assets: {
        template: '/project/src/layouts/default/index.wxml',
        style: '/project/src/layouts/default/index.wxss',
      },
      resolvedOptions: {
        relativeBase: 'layouts/default/index',
        templateExtension: 'axml',
        styleExtension: 'acss',
        jsonExtension: 'json',
        scriptExtension: 'js',
        scriptModuleExtension: 'sjs',
      },
      readFile,
    })).toEqual([
      {
        kind: 'template',
        fileName: 'layouts/default/index.axml',
        source: '/project/src/layouts/default/index.wxml:content',
      },
      {
        kind: 'style',
        fileName: 'layouts/default/index.acss',
        source: '/project/src/layouts/default/index.wxss:content',
      },
    ])
  })
})
