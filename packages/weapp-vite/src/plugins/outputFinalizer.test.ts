import type { OutputBundle } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createOutputFinalizerPlugin, normalizePreprocessorStyleAssets } from './outputFinalizer'

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

    normalizePreprocessorStyleAssets(bundle, 'wxss')

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

    normalizePreprocessorStyleAssets(bundle, 'acss')

    expect(bundle['pages/index/index.scss']).toBeUndefined()
    expect(bundle['pages/index/index.acss']).toMatchObject({
      type: 'asset',
      fileName: 'pages/index/index.acss',
      source: '.page{color:red}',
    })
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

    plugin.generateBundle?.call({} as any, {} as any, bundle, false)

    expect(plugin.enforce).toBe('post')
    expect(bundle['app.scss']).toBeUndefined()
    expect(bundle['app.wxss']).toMatchObject({
      type: 'asset',
      fileName: 'app.wxss',
    })
  })
})
