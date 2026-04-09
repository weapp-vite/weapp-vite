import type { MutableCompilerContext } from '../../../context'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileVueFile } from 'wevu/compiler'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createWxmlServicePlugin } from '../../../runtime/wxmlPlugin'
import { emitJsonAsset, emitWxmlAssetFile, emitWxmlAssetsWithCache, resolveWxmlEmitContext, resolveWxmlEmitTargets } from '../wxmlEmit'

function createMockCompiler(options?: { outputExtensions?: Record<string, string>, platform?: string, defineImportMetaEnv?: Record<string, any> }): MutableCompilerContext {
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
  } as MutableCompilerContext

  const absoluteSrcRoot = '/project/src'
  ctx.configService = {
    absoluteSrcRoot,
    relativeAbsoluteSrcRoot: (p: string) => path.relative(absoluteSrcRoot, p) || '.',
    relativeCwd: (p: string) => p,
    platform: options?.platform ?? 'weapp',
    weappViteConfig: {},
    outputExtensions: options?.outputExtensions,
    relativeOutputPath(p: string) {
      const relative = path.relative(absoluteSrcRoot, p)
      return relative || '.'
    },
    defineImportMetaEnv: options?.defineImportMetaEnv ?? {},
  } as unknown as MutableCompilerContext['configService']

  ctx.scanService = {
    isMainPackageFileName: () => true,
  } as unknown as MutableCompilerContext['scanService']

  createWxmlServicePlugin(ctx)
  return ctx
}

describe('emitWxmlAssetsWithCache', () => {
  let ctx: MutableCompilerContext
  const filePath = '/project/src/pages/index/index.wxml'

  beforeEach(() => {
    ctx = createMockCompiler()
    const token = ctx.wxmlService!.analyze('<view />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())
  })

  it('emits assets only when content changes', () => {
    const emittedCodeCache = ctx.runtimeState.wxml.emittedCode
    const addWatchFile = vi.fn()
    const emitFile = vi.fn()

    const result = emitWxmlAssetsWithCache({
      runtime: { addWatchFile, emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(result).toEqual(['pages/index/index.wxml'])
    expect(emitFile).toHaveBeenCalledTimes(1)

    const second = emitWxmlAssetsWithCache({
      runtime: { addWatchFile, emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(second).toEqual(['pages/index/index.wxml'])
    expect(emitFile).toHaveBeenCalledTimes(1)

    const updatedToken = ctx.wxmlService!.analyze('<view wx:if="true" />')
    ctx.wxmlService!.tokenMap.set(filePath, updatedToken)

    emitWxmlAssetsWithCache({
      runtime: { addWatchFile, emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(emitFile).toHaveBeenCalledTimes(2)
  })

  it('resolves emit context and throws when required services are missing', () => {
    expect(resolveWxmlEmitContext(ctx as any)).toEqual(expect.objectContaining({
      wxmlService: ctx.wxmlService,
      configService: ctx.configService,
      scanService: ctx.scanService,
      templateExtension: 'wxml',
      scriptModuleExtension: 'wxs',
      scriptModuleTag: 'wxs',
    }))

    expect(() => resolveWxmlEmitContext({} as any)).toThrow('emitWxmlAssets 需要先初始化 wxmlService、configService 和 scanService。')
  })

  it('resolves emit targets for main package, subpackage, and plugin builds', () => {
    const subPackageFile = '/project/src/pkg/pages/detail/index.wxml'
    const pluginFile = '/project/plugin/pages/demo/index.wxml'
    const wxsFile = '/project/src/pages/index/index.wxs.ts'
    ctx.wxmlService!.tokenMap.set(subPackageFile, ctx.wxmlService!.analyze('<view />'))
    ctx.wxmlService!.tokenMap.set(pluginFile, ctx.wxmlService!.analyze('<view />'))
    ctx.wxmlService!.tokenMap.set(wxsFile, ctx.wxmlService!.analyze('module.exports = {}'))
    ctx.scanService = {
      isMainPackageFileName: (fileName: string) => fileName === 'pages/index/index.wxml',
    } as any
    ctx.configService = {
      ...ctx.configService,
      absolutePluginRoot: '/project/plugin',
    } as any

    expect(resolveWxmlEmitTargets({
      compiler: ctx as any,
    }).map(item => item.fileName)).toEqual(['pages/index/index.wxml'])

    expect(resolveWxmlEmitTargets({
      compiler: ctx as any,
      subPackageMeta: {
        subPackage: {
          root: 'pkg',
        },
      } as any,
    }).map(item => item.fileName)).toEqual(['pkg/pages/detail/index.wxml'])

    expect(resolveWxmlEmitTargets({
      compiler: ctx as any,
      buildTarget: 'plugin',
    }).map(item => item.fileName)).toEqual(['../plugin/pages/demo/index.wxml'])
  })

  it('emits a single wxml asset file with cache-aware skip and watch deps', () => {
    const emitFile = vi.fn()
    const addWatchFile = vi.fn()
    const token = ctx.wxmlService!.analyze('<view />')
    const emittedCodeCache = new Map<string, string>()
    const deps = new Set(['/project/src/shared/helper.wxml'])

    expect(emitWxmlAssetFile({
      runtime: { emitFile, addWatchFile },
      id: filePath,
      fileName: 'pages/index/index.wxml',
      token,
      deps,
      emittedCodeCache,
      defineImportMetaEnv: {},
      scriptModuleExtension: 'wxs',
      scriptModuleTag: 'wxs',
      templateExtension: 'wxml',
    })).toBe(true)

    expect(addWatchFile).toHaveBeenNthCalledWith(1, filePath)
    expect(addWatchFile).toHaveBeenNthCalledWith(2, '/project/src/shared/helper.wxml')
    expect(emitFile).toHaveBeenCalledTimes(1)

    expect(emitWxmlAssetFile({
      runtime: { emitFile, addWatchFile },
      id: filePath,
      fileName: 'pages/index/index.wxml',
      token,
      deps,
      emittedCodeCache,
      defineImportMetaEnv: {},
      scriptModuleExtension: 'wxs',
      scriptModuleTag: 'wxs',
      templateExtension: 'wxml',
    })).toBe(false)

    expect(emitFile).toHaveBeenCalledTimes(1)
  })

  it('replaces import.meta.env expressions before emitting asset source', () => {
    ctx = createMockCompiler({
      defineImportMetaEnv: {
        'import.meta.env': '{"VITE_CDN":"https://cdn.example.com"}',
        'import.meta.env.VITE_CDN': '"https://cdn.example.com"',
      },
    })
    const token = ctx.wxmlService!.analyze('<image src="{{import.meta.env.VITE_CDN}}/logo.png" />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emitFile = vi.fn()

    emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
    })

    const payload = emitFile.mock.calls[0]?.[0]
    expect(payload.source).toContain('{{\'https://cdn.example.com\'}}/logo.png')
  })

  it('chooses inner double quotes when outer attribute uses single quotes before emitting asset source', () => {
    ctx = createMockCompiler({
      defineImportMetaEnv: {
        'import.meta.env.VITE_CDN': '"https://cdn.example.com"',
      },
    })
    const token = ctx.wxmlService!.analyze('<image src=\'{{import.meta.env.VITE_CDN}}/logo.png\' />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emitFile = vi.fn()

    emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
    })

    const payload = emitFile.mock.calls[0]?.[0]
    expect(payload.source).toContain('{{"https://cdn.example.com"}}/logo.png')
  })

  it('replaces import.meta.url, import.meta.dirname and bare import.meta before emitting asset source', () => {
    ctx = createMockCompiler({
      defineImportMetaEnv: {
        'import.meta.env': '{"MODE":"production"}',
      },
    })
    const token = ctx.wxmlService!.analyze('<view data-url="{{import.meta.url}}" data-dir="{{import.meta.dirname}}" data-meta="{{import.meta}}" />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emitFile = vi.fn()

    emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
    })

    const payload = emitFile.mock.calls[0]?.[0]
    expect(payload.source).toContain('{{\'/pages/index/index.wxml\'}}')
    expect(payload.source).toContain('{{\'/pages/index\'}}')
    expect(payload.source).toContain('{{{"url":"/pages/index/index.wxml","dirname":"/pages/index","env":{"MODE":"production"}}}}')
  })

  it('emits compiled vue template with safe import.meta.env quoting in final wxml', async () => {
    ctx = createMockCompiler({
      defineImportMetaEnv: {
        'import.meta.env': '{"VITE_CDN":"https://cdn.example.com"}',
        'import.meta.env.VITE_CDN': '"https://cdn.example.com"',
      },
    })
    const result = await compileVueFile(
      `
<template>
  <image src="{{import.meta.env.VITE_CDN}}/logo.png" />
</template>
<script setup lang="ts">
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
    )
    const token = ctx.wxmlService!.analyze(result.template!)
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emitFile = vi.fn()

    emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
    })

    const payload = emitFile.mock.calls[0]?.[0]
    expect(result.template).toContain('src="{{import.meta.env.VITE_CDN}}/logo.png"')
    expect(payload.source).toContain('src="{{\'https://cdn.example.com\'}}/logo.png"')
  })

  it('emits compiled vue bound attributes with import.meta.env replacements in final wxml', async () => {
    ctx = createMockCompiler({
      defineImportMetaEnv: {
        'import.meta.env.VITE_CDN': '"https://cdn.example.com"',
        'import.meta.env.VITE_NAME': '"banner"',
      },
    })
    const result = await compileVueFile(
      `
<template>
  <image :src="import.meta.env.VITE_CDN + '/logo.png'" />
  <view>{{ import.meta.env.VITE_NAME }}</view>
</template>
<script setup lang="ts">
</script>
      `.trim(),
      '/project/src/pages/index/index.vue',
    )
    const token = ctx.wxmlService!.analyze(result.template!)
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emitFile = vi.fn()

    emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
    })

    const payload = emitFile.mock.calls[0]?.[0]
    expect(result.template).toContain('src="{{import.meta.env.VITE_CDN + \'/logo.png\'}}"')
    expect(payload.source).toContain('src="{{\'https://cdn.example.com\' + \'/logo.png\'}}"')
    expect(payload.source).toContain('<view>{{\'banner\'}}</view>')
  })

  it('emits platform template extension and rewrites script module tags', () => {
    ctx = createMockCompiler({
      outputExtensions: { wxml: 'axml', wxs: 'sjs' },
      platform: 'alipay',
    })
    const token = ctx.wxmlService!.analyze('<wxs src="./helper.wxs" />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emittedCodeCache = ctx.runtimeState.wxml.emittedCode
    const emitFile = vi.fn()

    const result = emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(result).toEqual(['pages/index/index.axml'])
    expect(emitFile).toHaveBeenCalledTimes(1)
    const payload = emitFile.mock.calls[0]?.[0]
    expect(payload.fileName).toBe('pages/index/index.axml')
    expect(payload.source).toContain('<import-sjs')
    expect(payload.source).toContain('from="./helper.sjs"')
  })

  it('falls back to extension-derived script module tag when adapter does not override it', () => {
    ctx = createMockCompiler({
      outputExtensions: { wxml: 'swan', wxs: 'sjs' },
      platform: 'swan',
    })
    const token = ctx.wxmlService!.analyze('<wxs src="./helper.wxs" />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emitFile = vi.fn()

    emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
    })

    const payload = emitFile.mock.calls[0]?.[0]
    expect(payload.fileName).toBe('pages/index/index.swan')
    expect(payload.source).toContain('<sjs')
    expect(payload.source).toContain('src="./helper.sjs"')
  })

  it('rewrites wx directives and pascal-case tags for alipay output', () => {
    ctx = createMockCompiler({
      outputExtensions: { wxml: 'axml', wxs: 'sjs' },
      platform: 'alipay',
    })
    const token = ctx.wxmlService!.analyze('<HelloWorld wx:if="ok" />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emittedCodeCache = ctx.runtimeState.wxml.emittedCode
    const emitFile = vi.fn()

    const result = emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    expect(result).toEqual(['pages/index/index.axml'])
    const payload = emitFile.mock.calls[0]?.[0]
    expect(payload.source).toContain('<hello-world')
    expect(payload.source).toContain('a:if="ok"')
  })

  it('rewrites wechat event bindings for alipay output', () => {
    ctx = createMockCompiler({
      outputExtensions: { wxml: 'axml', wxs: 'sjs' },
      platform: 'alipay',
    })
    const token = ctx.wxmlService!.analyze('<view bindtap="onTap" bind:tap="onTap" catchtap="onTap" />')
    ctx.wxmlService!.tokenMap.set(filePath, token)
    ctx.wxmlService!.depsMap.set(filePath, new Set())

    const emittedCodeCache = ctx.runtimeState.wxml.emittedCode
    const emitFile = vi.fn()

    emitWxmlAssetsWithCache({
      runtime: { emitFile },
      compiler: ctx as any,
      emittedCodeCache,
    })

    const payload = emitFile.mock.calls[0]?.[0]
    expect(payload.source).toContain('onTap="onTap"')
    expect(payload.source).toContain('catchTap="onTap"')
    expect(payload.source).not.toContain('bindtap=')
    expect(payload.source).not.toContain('bind:tap=')
    expect(payload.source).not.toContain('catchtap=')
  })

  it('respects custom json extension', () => {
    const emitFile = vi.fn()
    emitJsonAsset({ emitFile }, 'pages/index/index.wxml', '{}', 'json5')
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'pages/index/index.json5',
      source: '{}',
    })
  })
})
