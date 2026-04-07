import type { OutputBundle } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { collectAssetModuleSourcePaths, collectBundledAssetSourcePaths } from './asset'

describe('asset plugin bundled source collection', () => {
  it('collects normalized original asset source paths from emitted bundle assets', () => {
    const bundle: OutputBundle = {
      'goods-1-abc123.png': {
        type: 'asset',
        fileName: 'goods-1-abc123.png',
        name: 'goods-1.png',
        names: ['goods-1.png'],
        needsCodeReference: false,
        originalFileName: '/project/src/assets/images/home/goods-1.png',
        originalFileNames: [
          '/project/src/assets/images/home/goods-1.png',
          'C:\\project\\src\\assets\\images\\home\\banner-1.jpg',
        ],
        source: new Uint8Array(),
      },
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: '',
        map: null,
        imports: [],
        dynamicImports: [],
        referencedFiles: [],
        moduleIds: [],
        exports: [],
        modules: {},
      },
    } as unknown as OutputBundle

    expect(collectBundledAssetSourcePaths(bundle)).toEqual(new Set([
      '/project/src/assets/images/home/goods-1.png',
      'C:/project/src/assets/images/home/banner-1.jpg',
    ]))
  })

  it('ignores bundle entries without original source file metadata', () => {
    const bundle: OutputBundle = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        name: 'app.wxss',
        names: ['app.wxss'],
        needsCodeReference: false,
        originalFileName: undefined,
        originalFileNames: [],
        source: '.root{}',
      },
    } as unknown as OutputBundle

    expect(collectBundledAssetSourcePaths(bundle)).toEqual(new Set())
  })

  it('normalizes module ids and strips resource query suffixes', () => {
    expect(collectAssetModuleSourcePaths([
      '/project/src/assets/images/home/goods-1.png?import',
      'C:\\project\\src\\assets\\images\\home\\banner-1.jpg#hash',
    ])).toEqual(new Set([
      '/project/src/assets/images/home/goods-1.png',
      'C:/project/src/assets/images/home/banner-1.jpg',
    ]))
  })
})
