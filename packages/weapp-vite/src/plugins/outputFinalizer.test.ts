import type { OutputBundle } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createOutputFinalizerPlugin, normalizePreprocessorStyleAssets, pruneUnchangedDevHmrOutputs } from './outputFinalizer'

function createBundleAssetEmitter(bundle: OutputBundle) {
  return (asset: any) => {
    bundle[asset.fileName] = {
      ...asset,
      fileName: asset.fileName,
    }
  }
}

describe('weapp-vite output finalizer', () => {
  it('drops duplicate preprocessor style assets', () => {
    const bundle = {
      'app.scss': {
        type: 'asset',
        fileName: 'app.scss',
        source: '.app{color:red}',
      },
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: '.app{color:red}',
      },
    } as unknown as OutputBundle

    normalizePreprocessorStyleAssets(bundle, 'wxss', createBundleAssetEmitter(bundle))

    expect(bundle['app.scss']).toBeUndefined()
    expect(bundle['app.wxss']).toMatchObject({
      type: 'asset',
      fileName: 'app.wxss',
      source: '.app{color:red}',
    })
  })

  it('renames preprocessor style assets to the current platform style extension', () => {
    const bundle = {
      'pages/index/index.scss': {
        type: 'asset',
        fileName: 'pages/index/index.scss',
        source: '.page{color:red}',
      },
    } as unknown as OutputBundle

    normalizePreprocessorStyleAssets(bundle, 'acss', createBundleAssetEmitter(bundle))

    expect(bundle['pages/index/index.scss']).toBeUndefined()
    expect(bundle['pages/index/index.acss']).toMatchObject({
      type: 'asset',
      fileName: 'pages/index/index.acss',
      source: '.page{color:red}',
    })
  })

  it('emits renamed preprocessor style assets without assigning to bundle', () => {
    const emitted: any[] = []
    const bundle = {
      'pages/index/index.scss': {
        type: 'asset',
        fileName: 'pages/index/index.scss',
        names: ['index.scss'],
        originalFileNames: ['/project/src/pages/index/index.scss'],
        source: '.page{color:red}',
      },
    } as unknown as OutputBundle

    normalizePreprocessorStyleAssets(bundle, 'wxss', asset => emitted.push(asset))

    expect(bundle['pages/index/index.scss']).toBeUndefined()
    expect(bundle['pages/index/index.wxss']).toBeUndefined()
    expect(emitted).toEqual([
      {
        type: 'asset',
        fileName: 'pages/index/index.wxss',
        name: 'index.scss',
        originalFileName: '/project/src/pages/index/index.scss',
        source: '.page{color:red}',
      },
    ])
  })

  it('runs as a post generateBundle plugin', () => {
    const plugin = createOutputFinalizerPlugin({
      configService: {
        outputExtensions: {
          wxss: 'wxss',
        },
      },
    } as any)
    const bundle = {
      'app.scss': {
        type: 'asset',
        fileName: 'app.scss',
        source: '.app{color:red}',
      },
    } as unknown as OutputBundle

    plugin.generateBundle?.call({
      emitFile: createBundleAssetEmitter(bundle),
    } as any, {} as any, bundle, false)

    expect(plugin.enforce).toBe('post')
    expect(bundle['app.scss']).toBeUndefined()
    expect(bundle['app.wxss']).toMatchObject({
      type: 'asset',
      fileName: 'app.wxss',
    })
  })

  it('drops unchanged outputs during dev hmr writes', () => {
    const emittedSource = new Map([
      ['app.js', 'App({})'],
      ['pages/index/index.wxml', '<view />'],
    ])
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({})',
      },
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: 'Page({})',
      },
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: '<view />',
      },
    } as unknown as OutputBundle

    pruneUnchangedDevHmrOutputs({
      configService: {
        isDev: true,
      },
      runtimeState: {
        build: {
          output: {
            emittedSource,
          },
          hmr: {
            profile: {
              event: 'update',
            },
          },
        },
      },
    } as any, bundle)

    expect(bundle['app.js']).toBeUndefined()
    expect(bundle['pages/index/index.wxml']).toBeUndefined()
    expect(bundle['pages/index/index.js']).toMatchObject({
      type: 'chunk',
      fileName: 'pages/index/index.js',
      code: 'Page({})',
    })
    expect(emittedSource.get('pages/index/index.js')).toBe('Page({})')
  })
})
