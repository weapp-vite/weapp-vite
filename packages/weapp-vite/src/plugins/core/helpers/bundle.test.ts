import { describe, expect, it } from 'vitest'
import { filterPluginBundleOutputs, rewriteWevuInternalRuntimeImports, stabilizeWevuRuntimeChunkAccess, syncChunkImportsFromRequireCalls } from './bundle'

describe('core helper bundle', () => {
  it('keeps plugin assets intact in pluginOnly mode', () => {
    const bundle = {
      'index.js': {
        type: 'chunk',
        fileName: 'index.js',
        facadeModuleId: '/project/plugin/index.ts',
      },
      'plugin.json': {
        type: 'asset',
        fileName: 'plugin.json',
        source: '{}',
      },
      'pages/hello-page.wxml': {
        type: 'asset',
        fileName: 'pages/hello-page.wxml',
        source: '<view />',
      },
    } as any

    filterPluginBundleOutputs(bundle, {
      pluginOnly: true,
      absolutePluginOutputRoot: '/project/dist-plugin',
      absolutePluginRoot: '/project/plugin',
      outDir: '/project/dist-plugin',
    } as any)

    expect(Object.keys(bundle).sort()).toEqual([
      'index.js',
      'pages/hello-page.wxml',
      'plugin.json',
    ])
  })

  it('syncs relative require calls back into chunk imports', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'require("./app.prelude.js")',
          'const runtime = require("./weapp-vendors/request-globals-runtime.js")',
          'const shared = require("./weapp-vendors/web-apis-shared.js")',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/request-globals-runtime.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/request-globals-runtime.js',
        code: 'const shared = require("./web-apis-shared.js")',
        imports: [],
      },
      'app.prelude.js': {
        type: 'chunk',
        fileName: 'app.prelude.js',
        code: '',
        imports: [],
      },
      'weapp-vendors/web-apis-shared.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/web-apis-shared.js',
        code: '',
        imports: [],
      },
    } as any

    syncChunkImportsFromRequireCalls(bundle)

    expect(bundle['app.js'].imports).toEqual([
      'app.prelude.js',
      'weapp-vendors/request-globals-runtime.js',
      'weapp-vendors/web-apis-shared.js',
    ])
    expect(bundle['weapp-vendors/request-globals-runtime.js'].imports).toEqual([
      'weapp-vendors/web-apis-shared.js',
    ])
  })

  it('rewrites bare wevu internal runtime imports to emitted vendor requires', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'import { setWevuDefaults, createApp as createRuntimeApp } from "wevu/internal-runtime";',
          'setWevuDefaults({});',
          'createRuntimeApp({});',
        ].join('\n'),
        imports: [],
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
    } as any

    rewriteWevuInternalRuntimeImports(bundle)

    expect(bundle['app.js'].code).not.toContain('from "wevu/internal-runtime"')
    expect(bundle['app.js'].code).toContain('const { setWevuDefaults, createApp: createRuntimeApp } = require("./weapp-vendors/wevu-watch.js");')
    expect(bundle['app.js'].imports).toEqual(['weapp-vendors/wevu-watch.js'])
  })

  it('rewrites partial hmr wevu runtime imports with a previously resolved vendor file', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'import { setWevuDefaults, createApp } from "wevu/internal-runtime";',
          'setWevuDefaults({});',
          'createApp({});',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileName: 'weapp-vendors/wevu-watch.js',
    })

    expect(bundle['app.js'].code).not.toContain('from "wevu/internal-runtime"')
    expect(bundle['app.js'].code).toContain('const { setWevuDefaults, createApp } = require("./weapp-vendors/wevu-watch.js");')
    expect(bundle['app.js'].imports).toEqual(['weapp-vendors/wevu-watch.js'])
  })

  it('records emitted wevu internal runtime chunks even when no bare import is rewritten', () => {
    let runtimeFileName: string | undefined
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'const runtime = require("./weapp-vendors/wevu-watch.js");runtime.createApp({});',
        imports: ['weapp-vendors/wevu-watch.js'],
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
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      onRuntimeFileName(fileName) {
        runtimeFileName = fileName
      },
    })

    expect(runtimeFileName).toBe('weapp-vendors/wevu-watch.js')
    expect(bundle['app.js'].code).toBe('const runtime = require("./weapp-vendors/wevu-watch.js");runtime.createApp({});')
  })

  it('adds stable wevu runtime exports and rewrites page chunk access with old-alias fallback', () => {
    const bundle = {
      'pages/hmr/index.js': {
        type: 'chunk',
        fileName: 'pages/hmr/index.js',
        code: [
          'const require_src_ABC = require("../../weapp-vendors/wevu-src.js");',
          'var page = require_src_ABC.eo({});',
          'require("../../weapp-vendors/wevu-src.js").to({});',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-src.js'],
      },
      'weapp-vendors/wevu-src.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-src.js',
        code: [
          'function eo(e) { return e }',
          'function to(e) { return eo(e) }',
          'Object.defineProperty(exports, "eo", { enumerable: true, get: function() { return eo; } });',
          'Object.defineProperty(exports, "to", { enumerable: true, get: function() { return to; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    stabilizeWevuRuntimeChunkAccess(bundle)

    expect(bundle['weapp-vendors/wevu-src.js'].code).toContain('"__wevuDefineComponent"')
    expect(bundle['weapp-vendors/wevu-src.js'].code).toContain('"__wevuCreateWevuComponent"')
    expect(bundle['pages/hmr/index.js'].code).toContain('(require_src_ABC.__wevuDefineComponent || require_src_ABC.eo)({})')
    expect(bundle['pages/hmr/index.js'].code).toContain('(require("../../weapp-vendors/wevu-src.js").__wevuCreateWevuComponent || require("../../weapp-vendors/wevu-src.js").to)({})')
  })

  it('resolves semantic wevu exports from ESM export lists before rewriting access', () => {
    const bundle = {
      'pages/hmr/index.js': {
        type: 'chunk',
        fileName: 'pages/hmr/index.js',
        code: 'require("../../weapp-vendors/wevu-src.js").pt({});',
        imports: ['weapp-vendors/wevu-src.js'],
      },
      'weapp-vendors/wevu-src.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-src.js',
        code: 'function pt(e) { return e } function Ce(e) { return pt(e) } export { Ce as createWevuComponent, pt as defineComponent };',
        imports: [],
      },
    } as any

    stabilizeWevuRuntimeChunkAccess(bundle)

    expect(bundle['weapp-vendors/wevu-src.js'].code).toContain('"__wevuDefineComponent"')
    expect(bundle['pages/hmr/index.js'].code).toContain('(require("../../weapp-vendors/wevu-src.js").__wevuDefineComponent || require("../../weapp-vendors/wevu-src.js").pt)({})')
  })

  it('exports actually consumed wevu runtime members when rolldown only preserves partial exports', () => {
    const bundle = {
      'pages/runtime/index.js': {
        type: 'chunk',
        fileName: 'pages/runtime/index.js',
        code: [
          'const require_src_ABC = require("../../weapp-vendors/wevu-src.js");',
          'var page = require_src_ABC.eo({});',
          'require_src_ABC.Ot(() => state.count, () => {});',
          'require_src_ABC.Mo([{ fontSize: "24rpx" }]);',
          'require("../../weapp-vendors/wevu-src.js").to({});',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-src.js'],
      },
      'weapp-vendors/wevu-src.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-src.js',
        code: [
          'function eo(e) { return e }',
          'function to(e) { return eo(e) }',
          'function Ot(source, cb) { return cb(source()) }',
          'function Mo(value) { return value }',
          'function unused() { return null }',
          'Object.defineProperty(exports, "u", { enumerable: true, get: function() { return unused; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    stabilizeWevuRuntimeChunkAccess(bundle)

    const wevuCode = bundle['weapp-vendors/wevu-src.js'].code
    expect(wevuCode).toContain('"__wevuDefineComponent"')
    expect(wevuCode).toContain('"__wevuCreateWevuComponent"')
    expect(wevuCode).toContain('"eo"')
    expect(wevuCode).toContain('"to"')
    expect(wevuCode).toContain('"Ot"')
    expect(wevuCode).toContain('"Mo"')
    expect(wevuCode).not.toContain('"unused"')
  })
})
