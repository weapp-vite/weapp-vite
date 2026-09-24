import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../context'
import type { WxmlRemoveOptions } from '../types'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSidecarModuleId } from '../moduleGraph/protocol'
import { createRuntimeState } from '../runtime/runtimeState'
import { createManagedCompilerEntryMarker, registerManagedCompilerEntries } from './compilerPluginRegistry'
import { recordPendingOwnerStyleSource } from './css'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin, mayNeedTemplateNormalization, normalizeGraphOnlyAssets, normalizePreprocessorStyleAssets, normalizeTemplateAssets, pruneUnchangedDevHmrOutputs } from './outputFinalizer'
import { createManagedTailwindcssOutputMarker, registerManagedTailwindcssEntries } from './tailwindcssMarker'

function createBundleAssetEmitter(bundle: OutputBundle) {
  return (asset: any) => {
    bundle[asset.fileName] = {
      ...asset,
      fileName: asset.fileName,
    }
  }
}

function createOutputPlugins(ctx: Parameters<typeof createOutputFinalizerPlugin>[0]) {
  return [createOutputFinalizerPlugin(ctx), createOutputPublicationPlugin(ctx)]
}

async function runGenerateBundle(plugins: ReturnType<typeof createOutputPlugins>, bundle: OutputBundle) {
  for (const plugin of plugins) {
    const hook = plugin.generateBundle
    const handler = typeof hook === 'function' ? hook : hook?.handler
    await handler?.call({
      emitFile: createBundleAssetEmitter(bundle),
    } as any, {} as any, bundle, false)
  }
}

describe('weapp-vite output finalizer', () => {
  it.each([true, false])('applies an explicit preset independently of isDev=%s', async (isDev) => {
    const bundle = {
      'pages/index.wxml': {
        type: 'asset',
        fileName: 'pages/index.wxml',
        source: '<!-- note --><view data-testid="probe" aria-label="accessible">kept</view>',
      },
    } as unknown as OutputBundle
    // 此路径只读取配置，不需要构造其他编译服务。
    const ctx = {
      configService: { isDev, weappViteConfig: { wxml: { remove: true } } },
    } as unknown as CompilerContext
    await normalizeTemplateAssets(ctx, bundle)
    expect(bundle['pages/index.wxml']).toMatchObject({
      source: expect.stringContaining('aria-label="accessible">kept</view>'),
    })
    expect(bundle['pages/index.wxml']).toMatchObject({
      source: expect.not.stringContaining('data-testid'),
    })
    expect(bundle['pages/index.wxml']).toMatchObject({
      source: expect.not.stringContaining('<!--'),
    })
  })

  const legacyCommentCases: Array<{ remove: boolean | WxmlRemoveOptions | undefined, expected: string }> = [
    { remove: undefined, expected: '<view data-testid="probe">kept</view>' },
    { remove: false, expected: '<!-- note --><view data-testid="probe">kept</view>' },
    { remove: true, expected: '<view >kept</view>' },
    { remove: { attr: [{ tag: 'view', name: 'data-testid' }] }, expected: '<!-- note --><view >kept</view>' },
  ]
  it.each(legacyCommentCases.flatMap(({ remove, expected }) =>
    [true, false].flatMap(removeComment => [true, false].map(removeComments => ({ remove, expected, removeComment, removeComments }))),
  ))('ignores legacy wxml=$removeComment and vue=$removeComments flags with remove=$remove', async ({ remove, expected, removeComment, removeComments }) => {
    const bundle = {
      'pages/index.wxml': {
        type: 'asset',
        fileName: 'pages/index.wxml',
        source: '<!-- note --><view data-testid="probe">kept</view>',
      },
    } as unknown as OutputBundle
    // 旧字段仅保留类型兼容；最终清理只消费 remove。
    const ctx = {
      configService: {
        weappViteConfig: {
          wxml: { removeComment, remove },
          vue: { template: { removeComments } },
        },
      },
    } as unknown as CompilerContext
    await normalizeTemplateAssets(ctx, bundle)
    expect(bundle['pages/index.wxml']).toMatchObject({ source: expected })
  })

  it('cleans buffer-backed templates without normalization markers and preserves custom comments', async () => {
    const bundle = {
      'components/card.wxml': {
        type: 'asset',
        fileName: 'components/card.wxml',
        source: Buffer.from('<!-- note --><view data-qa="keep" data-debug="remove">kept</view>'),
      },
    } as unknown as OutputBundle
    // 此路径只读取配置，不需要构造其他编译服务。
    const ctx = {
      configService: { weappViteConfig: { wxml: { remove: { attr: ['data-debug'] } } } },
    } as unknown as CompilerContext
    await normalizeTemplateAssets(ctx, bundle)
    const first = { ...bundle['components/card.wxml'] }
    await normalizeTemplateAssets(ctx, bundle)
    expect(bundle['components/card.wxml']).toEqual(first)
    expect(bundle['components/card.wxml']).toMatchObject({
      source: expect.stringContaining('<!-- note --><view data-qa="keep"'),
    })
    expect(bundle['components/card.wxml']).toMatchObject({
      source: expect.not.stringContaining('data-debug'),
    })
  })

  it('uses XML attribute boundaries for non-WeChat output', async () => {
    const bundle = {
      'pages/index.wxml': {
        type: 'asset',
        fileName: 'pages/index.wxml',
        source: String.raw`<view title="slash\" data-testid="drop"/><!-- ordinary -->`,
      },
    } as unknown as OutputBundle
    const ctx = {
      configService: {
        platform: 'alipay',
        weappViteConfig: { wxml: { remove: true } },
      },
    } as unknown as CompilerContext
    await normalizeTemplateAssets(ctx, bundle)
    expect(bundle['pages/index.wxml']).toMatchObject({ source: String.raw`<view title="slash\" />` })
  })

  it('keeps current WeChat escaping when a component framework is configured', async () => {
    const bundle = {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"componentFramework":"glass-easel"}',
      },
      'pages/index.wxml': {
        type: 'asset',
        fileName: 'pages/index.wxml',
        source: String.raw`<view title="{{ value === \"legacy\" }}" data-testid="drop"/><!-- ordinary -->`,
      },
    } as unknown as OutputBundle
    const ctx = {
      configService: { platform: 'weapp', weappViteConfig: { wxml: { remove: true } } },
    } as unknown as CompilerContext
    await normalizeTemplateAssets(ctx, bundle)
    expect(bundle['pages/index.wxml']).toMatchObject({
      source: String.raw`<view title="{{ value === \"legacy\" }}" />`,
    })
  })

  it('cleans the current UTF-8 template when full output transitions to partial HMR', async () => {
    const runtimeState = createRuntimeState()
    const ctx = {
      configService: { platform: 'weapp', isDev: true, weappViteConfig: { wxml: { remove: true } } },
      runtimeState,
    } as unknown as CompilerContext
    const plugins = [createOutputFinalizerPlugin(ctx)]
    const first = {
      'pages/index.wxml': {
        type: 'asset',
        fileName: 'pages/index.wxml',
        source: Buffer.from(String.raw`<view title="{{ value === \"初始\" }}" data-testid="drop"/><!-- ordinary -->`),
      },
    } as unknown as OutputBundle
    await runGenerateBundle(plugins, first)
    expect(first['pages/index.wxml']).toMatchObject({
      source: String.raw`<view title="{{ value === \"初始\" }}" />`,
    })

    runtimeState.build.hmr.profile.event = 'change'
    const updated = {
      'pages/index.wxml': {
        type: 'asset',
        fileName: 'pages/index.wxml',
        source: new Uint8Array(Buffer.from(String.raw`<view title="{{ value === \"更新\" }}" data-testid="drop"/><!-- ordinary -->`)),
      },
    } as unknown as OutputBundle
    await runGenerateBundle(plugins, updated)
    expect(updated['pages/index.wxml']).toMatchObject({
      source: String.raw`<view title="{{ value === \"更新\" }}" />`,
    })
  })

  it('still applies conditional compilation when optional cleanup is disabled', async () => {
    const bundle = {
      'pages/index.wxml': {
        type: 'asset',
        fileName: 'pages/index.wxml',
        source: '<!-- keep --><!-- #ifdef alipay --><view id="foreign"/><!-- #endif --><view id="keep"/>',
      },
    } as unknown as OutputBundle
    // 此路径只读取配置，不需要构造其他编译服务。
    const ctx = {
      configService: { platform: 'weapp', weappViteConfig: { wxml: { remove: false } } },
    } as unknown as CompilerContext
    await normalizeTemplateAssets(ctx, bundle)
    expect(bundle['pages/index.wxml']).toMatchObject({ source: '<!-- keep --><view id="keep"/>' })
  })

  it('merges user CSS remembered from a Tailwind Vite asset into the final owner output', async () => {
    const ctx = {
      configService: {
        outputExtensions: { wxss: 'wxss' },
      },
      runtimeState: {
        build: {
          output: { emittedSource: new Map() },
        },
      },
    } as any
    recordPendingOwnerStyleSource(
      ctx,
      'app.wxss',
      '.author{color:#893a6d}\n/*! weapp-tailwindcss generator-placeholder */\n@plugin "@iconify/tailwind4" { prefixes: mdi; }\n@source "./**/*.{vue}";\npage{background:#f6f7fb}',
    )
    const bundle = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: '.flex{display:flex}',
      },
    } as unknown as OutputBundle

    await runGenerateBundle(createOutputPlugins(ctx), bundle)

    expect((bundle['app.wxss'] as any).source).toContain('.flex{display:flex}')
    expect((bundle['app.wxss'] as any).source).toContain('.author{color:#893a6d}')
    expect((bundle['app.wxss'] as any).source).not.toContain('generator-placeholder')
    expect((bundle['app.wxss'] as any).source).not.toMatch(/@(plugin|source)\b/)
    expect((bundle['app.wxss'] as any).source).not.toContain('page{background:#f6f7fb}')
  })

  it('maps graph-only virtual assets back to physical owner outputs', () => {
    const logicalAsset = 'weapp_vite_external/graph/weapp-vite:logical-entry:layout:D%3A%2Fproject%2Fsrc%2Flayouts%2Fdefault%2Findex.vue:module.wxss'
    const sidecarAsset = 'weapp_vite_external/graph/weapp-vite:sidecar:style:D%3A%2Fproject%2Fsrc%2Fapp.ts:D%3A%2Fproject%2Fsrc%2Fapp.css:module.wxss'
    const bundle = {
      [logicalAsset]: {
        type: 'asset',
        fileName: logicalAsset,
        source: '.layout{}',
      },
      [sidecarAsset]: {
        type: 'asset',
        fileName: sidecarAsset,
        source: '.app{}',
      },
      'layouts/default/index.wxss': {
        type: 'asset',
        fileName: 'layouts/default/index.wxss',
        source: '.old-layout{}',
      },
    } as unknown as OutputBundle

    const emitted: any[] = []
    normalizeGraphOnlyAssets({
      configService: {
        outputExtensions: { wxss: 'wxss' },
        relativeOutputPath: (id: string) => id
          .replace('D:/project/src/', '')
          .replace('D:/project/', ''),
      },
    } as any, bundle, asset => emitted.push(asset))

    expect(bundle[logicalAsset]).toBeUndefined()
    expect(bundle[sidecarAsset]).toBeUndefined()
    expect(bundle['layouts/default/index.wxss']).toMatchObject({
      source: '.layout{}',
    })
    expect(emitted).toEqual([
      expect.objectContaining({
        fileName: 'app.wxss',
        source: '.app{}',
      }),
    ])
  })

  it('drops managed Tailwind graph-only style shadows', () => {
    const entry = '/project/src/app.css'
    const bundle = {
      'weapp_vite_external/graph/weapp-vite:sidecar:style:%2Fproject%2Fsrc%2Fapp.ts:%2Fproject%2Fsrc%2Fapp.css:module.wxss': {
        type: 'asset',
        fileName: 'weapp_vite_external/graph/weapp-vite:sidecar:style:%2Fproject%2Fsrc%2Fapp.ts:%2Fproject%2Fsrc%2Fapp.css:module.wxss',
        source: '@plugin "@iconify/tailwind4";',
      },
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: '.flex{display:flex}',
      },
    } as unknown as OutputBundle
    const finalizerCtx = {
      configService: { outputExtensions: { wxss: 'wxss' } },
    } as any
    registerManagedTailwindcssEntries(finalizerCtx, [entry])

    finalizerCtx.configService.relativeOutputPath = (id: string) => id.replace('/project/src/', '')
    normalizeGraphOnlyAssets(
      finalizerCtx,
      bundle,
      createBundleAssetEmitter(bundle),
    )

    expect(bundle['app.wxss']).toMatchObject({ source: '.flex{display:flex}' })
    expect(bundle['weapp_vite_external/graph/weapp-vite:sidecar:style:%2Fproject%2Fsrc%2Fapp.ts:%2Fproject%2Fsrc%2Fapp.css:module.wxss']).toBeUndefined()
  })

  it('drops graph-only style shadows for a generic compiler owner', () => {
    const entry = '/project/src/app.css'
    const graphAsset = 'weapp_vite_external/graph/weapp-vite:sidecar:style:%2Fproject%2Fsrc%2Fapp.ts:%2Fproject%2Fsrc%2Fapp.css:module.wxss'
    const bundle = {
      [graphAsset]: {
        type: 'asset',
        fileName: graphAsset,
        source: '.generated{}',
      },
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: `${createManagedCompilerEntryMarker()}\n.compiler{display:block}`,
      },
    } as unknown as OutputBundle
    const finalizerCtx = {
      configService: {
        outputExtensions: { wxss: 'wxss' },
        relativeOutputPath: (id: string) => id.replace('/project/src/', ''),
      },
    } as any
    registerManagedCompilerEntries(finalizerCtx, 'fake-compiler', [entry])

    normalizeGraphOnlyAssets(finalizerCtx, bundle, createBundleAssetEmitter(bundle))

    expect(bundle[graphAsset]).toBeUndefined()
    expect(bundle['app.wxss']).toMatchObject({ source: expect.stringContaining('.compiler{display:block}') })
  })

  it('preserves a marked generic compiler sidecar while mapping it to its owner', () => {
    const entry = '/project/src/app.css'
    const graphAsset = 'weapp_vite_external/graph/weapp-vite:sidecar:style:%2Fproject%2Fsrc%2Fapp.ts:%2Fproject%2Fsrc%2Fapp.css:module.wxss'
    const pending = `${createManagedCompilerEntryMarker()}\n.compiler{display:block}`
    const bundle = {
      [graphAsset]: { type: 'asset', fileName: graphAsset, source: pending },
    } as unknown as OutputBundle
    const finalizerCtx = {
      configService: {
        outputExtensions: { wxss: 'wxss' },
        relativeOutputPath: (id: string) => id.replace('/project/src/', ''),
      },
    } as any
    registerManagedCompilerEntries(finalizerCtx, 'fake-compiler', [entry])

    normalizeGraphOnlyAssets(finalizerCtx, bundle, createBundleAssetEmitter(bundle))

    expect(bundle[graphAsset]).toBeUndefined()
    expect(bundle['app.wxss']).toMatchObject({ source: pending })
  })

  it('preserves a pending Tailwind entry when reemitting its graph-only owner', () => {
    const srcRoot = path.resolve('tailwind-owner-fixture/src')
    const entry = path.join(srcRoot, 'app.css')
    const moduleId = createSidecarModuleId(path.join(srcRoot, 'app.ts'), entry, 'style')
    const graphAsset = `weapp_vite_external/graph/${moduleId.replace(/\.js$/, '.wxss')}`
    const pending = createManagedTailwindcssOutputMarker(0)
    const bundle = {
      [graphAsset]: { type: 'asset', fileName: graphAsset, source: pending },
    } as unknown as OutputBundle
    const ctx = {
      configService: {
        outputExtensions: { wxss: 'wxss' },
        relativeOutputPath: (file: string) => path.relative(srcRoot, file),
      },
    } as any
    registerManagedTailwindcssEntries(ctx, [entry])

    normalizeGraphOnlyAssets(ctx, bundle, createBundleAssetEmitter(bundle))

    expect(bundle[graphAsset]).toBeUndefined()
    expect(bundle['app.wxss']).toMatchObject({ source: pending })
  })

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

  it('normalizes template event shorthand left by post-process plugins', async () => {
    const bundle = {
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: '<van-button type="default" @tap="showDialog">Vant 按钮</van-button>',
      },
    } as unknown as OutputBundle

    await normalizeTemplateAssets({
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

  it('normalizes binary template assets emitted by post-process plugins', async () => {
    const bundle = {
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: Buffer.from('<button @tap="handleTap">Tap</button>'),
      },
    } as unknown as OutputBundle

    await normalizeTemplateAssets({
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

  it('preserves the Alipay import-sjs tag during final template normalization', async () => {
    const bundle = {
      'pages/index/index.axml': {
        type: 'asset',
        fileName: 'pages/index/index.axml',
        source: '<import-sjs from="./utils.sjs" name="util" /><view onTap="handleTap">{{util.value}}</view>',
      },
    } as unknown as OutputBundle

    await normalizeTemplateAssets({
      configService: {
        platform: 'alipay',
        outputExtensions: {
          wxml: 'axml',
          wxs: 'sjs',
        },
      },
    } as any, bundle)

    expect((bundle['pages/index/index.axml'] as any).source).toContain('<import-sjs from="./utils.sjs" name="util"')
    expect((bundle['pages/index/index.axml'] as any).source).not.toContain('<sjs ')
  })

  it('skips template parser for assets without normalization markers', () => {
    expect(mayNeedTemplateNormalization('<view class="page"><text>Hello</text></view>', 'weapp')).toBe(false)
    expect(mayNeedTemplateNormalization('<view @tap="handleTap" />', 'weapp')).toBe(true)
    expect(mayNeedTemplateNormalization('<view><!-- comment --></view>', 'weapp')).toBe(false)
    expect(mayNeedTemplateNormalization('<!-- #ifdef alipay --><view /><!-- #endif -->', 'weapp')).toBe(true)
    expect(mayNeedTemplateNormalization('<view a:if="{{ready}}" />', 'weapp')).toBe(true)
    expect(mayNeedTemplateNormalization('<IMPORT src="./SHARED.WXML" />', 'weapp')).toBe(true)
    expect(mayNeedTemplateNormalization('<import src="./shared.wxml" />', 'alipay')).toBe(true)
    expect(mayNeedTemplateNormalization('<button bind:tap="handleTap" />', 'alipay')).toBe(true)
    expect(mayNeedTemplateNormalization('<HelloWorld />', 'alipay')).toBe(true)
    expect(mayNeedTemplateNormalization('<view wx-if="{{ready}}" />', 'weapp')).toBe(true)
  })

  it('normalizes legacy glass-easel directives in final template assets', async () => {
    const bundle = {
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: '<view wx-if="{{ready}}"><block wx-for="{{list}}" /></view>',
      },
    } as unknown as OutputBundle

    await normalizeTemplateAssets({
      configService: {
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxs: 'wxs' },
      },
    } as any, bundle)

    expect((bundle['pages/index/index.wxml'] as any).source).toContain('wx:if="{{ready}}"')
    expect((bundle['pages/index/index.wxml'] as any).source).toContain('wx:for="{{list}}"')
  })

  it('runs as a post generateBundle plugin', async () => {
    const plugin = createOutputPlugins({
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

    await runGenerateBundle(plugin, bundle)

    for (const outputPlugin of plugin) {
      expect(outputPlugin.enforce).toBe('post')
      expect(typeof outputPlugin.generateBundle === 'object' && outputPlugin.generateBundle.order).toBe('post')
    }
    expect(bundle['app.scss']).toBeUndefined()
    expect(bundle['app.wxss']).toMatchObject({
      type: 'asset',
      fileName: 'app.wxss',
    })
  })

  it('merges completed independent outputs after finalizing the main bundle', async () => {
    const plugin = createOutputPlugins({
      configService: {
        outputExtensions: {
          wxss: 'wxss',
        },
      },
      runtimeState: {
        build: {
          independent: {
            outputs: new Map(),
            pendingOutputs: [Promise.resolve({
              output: [{
                type: 'asset',
                fileName: 'pkg/index.wxss',
                names: ['index.wxss'],
                originalFileNames: ['/project/src/pkg/index.css'],
                source: '.child{}',
                needsCodeReference: false,
              }],
            })],
          },
          output: {
            emittedSource: new Map(),
          },
        },
      },
    } as any)
    const bundle = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: '.app{}',
      },
    } as unknown as OutputBundle

    await runGenerateBundle(plugin, bundle)

    expect(bundle['pkg/index.wxss']).toMatchObject({
      type: 'asset',
      fileName: 'pkg/index.wxss',
      originalFileName: '/project/src/pkg/index.css',
      source: '.child{}',
    })
  })

  it('rewrites app vue hmr bare wevu runtime imports after late script replacement', async () => {
    const plugin = createOutputPlugins({
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

    await runGenerateBundle(plugin, bundle)

    expect((bundle['app.js'] as any).source).toContain('require("./weapp-vendors/wevu-watch.js")')
    expect((bundle['app.js'] as any).source).not.toContain('wevu/internal-runtime')
  })

  it('rewrites app vue partial hmr runtime imports with the remembered vendor chunk', async () => {
    const plugin = createOutputPlugins({
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

    await runGenerateBundle(plugin, fullBundle)

    const hmrBundle = {
      'app.js': {
        type: 'asset',
        fileName: 'app.js',
        source: 'import { setWevuDefaults, createApp } from "wevu/internal-runtime";setWevuDefaults({});createApp({ hmr: true });',
      },
    } as unknown as OutputBundle

    await runGenerateBundle(plugin, hmrBundle)

    expect((hmrBundle['app.js'] as any).source).toContain('require("./weapp-vendors/wevu-watch.js")')
    expect((hmrBundle['app.js'] as any).source).not.toContain('wevu/internal-runtime')
  })

  it('prunes unchanged dev hmr outputs after the plugin runtime rewrite pass only once', async () => {
    const emittedSource = new Map<string, string>()
    const plugin = createOutputPlugins({
      configService: {
        isDev: true,
        outputExtensions: {
          wxss: 'wxss',
        },
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
    } as any)
    const bundle = {
      'app.js': {
        type: 'asset',
        fileName: 'app.js',
        source: 'import { setWevuDefaults, createApp } from "wevu/internal-runtime";setWevuDefaults({});createApp({ hmr: true });',
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

    await runGenerateBundle(plugin, bundle)

    const finalSource = (bundle['app.js'] as any).source
    expect(finalSource).toContain('require("./weapp-vendors/wevu-watch.js")')
    expect(finalSource).not.toContain('wevu/internal-runtime')
    expect(emittedSource.get('app.js')).toBe(finalSource)
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

  it('skips source snapshotting for chunk outputs outside the current hmr event', () => {
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
    expect(emittedSource.get('pages/index/index.js')).toBe('Page({})')
    expect(emittedSource.has('common.js')).toBe(false)
  })
})
