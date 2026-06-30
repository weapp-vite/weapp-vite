import type { OutputBundle } from 'rolldown'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createOutputFinalizerPlugin, normalizePreprocessorStyleAssets, normalizeTemplateAssets, pruneUnchangedDevHmrOutputs } from './outputFinalizer'

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

  it('updates existing final style asset from a newer preprocessor asset', () => {
    const bundle = {
      'pages/index/index.scss': {
        type: 'asset',
        fileName: 'pages/index/index.scss',
        source: '.page{color:green}',
      },
      'pages/index/index.acss': {
        type: 'asset',
        fileName: 'pages/index/index.acss',
        source: '.page{color:red}',
      },
    } as unknown as OutputBundle

    normalizePreprocessorStyleAssets(bundle, 'acss', createBundleAssetEmitter(bundle))

    expect(bundle['pages/index/index.scss']).toBeUndefined()
    expect(bundle['pages/index/index.acss']).toMatchObject({
      type: 'asset',
      fileName: 'pages/index/index.acss',
      source: '.page{color:green}',
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

  it('normalizes template event shorthand left by post-process plugins', () => {
    const bundle = {
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: '<van-button type="default" @tap="showDialog">Vant 按钮</van-button>',
      },
    } as unknown as OutputBundle

    normalizeTemplateAssets({
      configService: {
        platform: 'weapp',
        outputExtensions: {
          wxml: 'wxml',
          wxs: 'wxs',
        },
      },
    } as any, bundle)

    expect((bundle['pages/index/index.wxml'] as any).source).toContain('bind:tap="showDialog"')
    expect((bundle['pages/index/index.wxml'] as any).source).not.toContain('@tap=')
  })

  it('normalizes binary template assets emitted by post-process plugins', () => {
    const bundle = {
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: Buffer.from('<button @tap="handleTap">Tap</button>'),
      },
    } as unknown as OutputBundle

    normalizeTemplateAssets({
      configService: {
        platform: 'weapp',
        outputExtensions: {
          wxml: 'wxml',
          wxs: 'wxs',
        },
      },
    } as any, bundle)

    expect((bundle['pages/index/index.wxml'] as any).source).toContain('bind:tap="handleTap"')
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

  it('rewrites app vue hmr bare wevu runtime imports after late script replacement', () => {
    const plugin = createOutputFinalizerPlugin({
      configService: {
        outputExtensions: {
          wxss: 'wxss',
        },
      },
      runtimeState: {
        build: {
          output: {
            emittedSource: new Map(),
          },
          hmr: {
            profile: {
              event: 'update',
            },
          },
        },
      },
    } as any)
    const bundle = {
      'app.js': {
        type: 'asset',
        fileName: 'app.js',
        source: 'const runtime = require("./weapp-vendors/wevu-watch.js");runtime.setWevuDefaults({});runtime.createApp({});',
      },
      'weapp-vendors/wevu-watch.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-watch.js',
        code: [
          'Object.defineProperty(exports, "createApp", { enumerable: true, get: function() { return createApp; } });',
          'Object.defineProperty(exports, "setWevuDefaults", { enumerable: true, get: function() { return setWevuDefaults; } });',
        ].join('\n'),
        imports: [],
      },
    } as unknown as OutputBundle

    plugin.generateBundle?.call({
      emitFile: createBundleAssetEmitter(bundle),
    } as any, {} as any, bundle, false)

    expect((bundle['app.js'] as any).source).toContain('require("./weapp-vendors/wevu-watch.js")')
    expect((bundle['app.js'] as any).source).not.toContain('wevu/internal-runtime')
  })

  it('rewrites app vue partial hmr runtime imports with the remembered vendor chunk', () => {
    const plugin = createOutputFinalizerPlugin({
      configService: {
        isDev: true,
        outputExtensions: {
          wxss: 'wxss',
        },
      },
      runtimeState: {
        build: {
          output: {
            emittedSource: new Map(),
          },
          hmr: {
            profile: {
              event: 'update',
            },
          },
        },
      },
    } as any)
    const fullBundle = {
      'app.js': {
        type: 'asset',
        fileName: 'app.js',
        source: 'import { setWevuDefaults, createApp } from "wevu/internal-runtime";setWevuDefaults({});createApp({});',
      },
      'weapp-vendors/wevu-watch.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-watch.js',
        code: [
          'Object.defineProperty(exports, "createApp", { enumerable: true, get: function() { return createApp; } });',
          'Object.defineProperty(exports, "setWevuDefaults", { enumerable: true, get: function() { return setWevuDefaults; } });',
        ].join('\n'),
        imports: [],
      },
    } as unknown as OutputBundle

    plugin.generateBundle?.call({
      emitFile: createBundleAssetEmitter(fullBundle),
    } as any, {} as any, fullBundle, false)

    const hmrBundle = {
      'app.js': {
        type: 'asset',
        fileName: 'app.js',
        source: 'import { setWevuDefaults, createApp } from "wevu/internal-runtime";setWevuDefaults({});createApp({ hmr: true });',
      },
    } as unknown as OutputBundle

    plugin.generateBundle?.call({
      emitFile: createBundleAssetEmitter(hmrBundle),
    } as any, {} as any, hmrBundle, false)

    expect((hmrBundle['app.js'] as any).source).toContain('require("./weapp-vendors/wevu-watch.js")')
    expect((hmrBundle['app.js'] as any).source).not.toContain('wevu/internal-runtime')
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

  it('keeps unchanged chunks explicitly emitted for the current dev hmr event', () => {
    const emittedSource = new Map([
      ['pages/index/index.js', 'const runtime = require("../../weapp-vendors/weapp-vite-runtime.js");Page({})'],
      ['weapp-vendors/weapp-vite-runtime.js', 'exports.setPageLayout = function setPageLayout() {}'],
      ['pages/index/index.wxml', '<view />'],
    ])
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: 'const runtime = require("../../weapp-vendors/weapp-vite-runtime.js");Page({})',
      },
      'weapp-vendors/weapp-vite-runtime.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/weapp-vite-runtime.js',
        code: 'exports.setPageLayout = function setPageLayout() {}',
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
            lastEmittedChunkFileNames: new Set([
              'pages/index/index.js',
              'weapp-vendors/weapp-vite-runtime.js',
            ]),
            profile: {
              event: 'update',
            },
          },
        },
      },
    } as any, bundle)

    expect(bundle['pages/index/index.js']).toBeDefined()
    expect(bundle['weapp-vendors/weapp-vite-runtime.js']).toBeDefined()
    expect(bundle['pages/index/index.wxml']).toBeUndefined()
  })

  it('drops chunk outputs that were not emitted for the current hmr event', () => {
    const emittedSource = new Map<string, string>()
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: 'Page({})',
      },
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'exports.shared = true',
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
            lastEmittedChunkFileNames: new Set(['pages/index/index.js']),
            profile: {
              event: 'update',
            },
          },
        },
      },
    } as any, bundle)

    expect(bundle['pages/index/index.js']).toBeDefined()
    expect(bundle['common.js']).toBeUndefined()
    expect(bundle['pages/index/index.wxml']).toBeDefined()
    expect(emittedSource.has('common.js')).toBe(false)
  })
})
