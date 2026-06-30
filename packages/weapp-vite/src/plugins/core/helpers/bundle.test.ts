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

  it('skips chunks without wevu runtime imports during bundle runtime rewrite', () => {
    const bundle = {
      'pages/plain.js': {
        type: 'chunk',
        fileName: 'pages/plain.js',
        code: [
          'const value = require("./dep.js");',
          'console.log(value);',
        ].join('\n'),
        imports: ['pages/dep.js'],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileName: 'weapp-vendors/wevu-watch.js',
    })

    expect(bundle['pages/plain.js'].code).toBe([
      'const value = require("./dep.js");',
      'console.log(value);',
    ].join('\n'))
    expect(bundle['pages/plain.js'].imports).toEqual(['pages/dep.js'])
  })

  it('rewrites partial hmr wevu internal reactivity imports with remembered vendor files', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'import { ref, computed as useComputed } from "wevu/internal-reactivity";',
          'const count = ref(0);',
          'useComputed(() => count.value);',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileNames: new Map([
        ['wevu/internal-reactivity', 'weapp-vendors/wevu-ref.js'],
      ]),
    })

    expect(bundle['app.js'].code).not.toContain('from "wevu/internal-reactivity"')
    expect(bundle['app.js'].code).toContain('const { ref, computed: useComputed } = require("./weapp-vendors/wevu-ref.js");')
    expect(bundle['app.js'].imports).toEqual(['weapp-vendors/wevu-ref.js'])
  })

  it('rewrites bare wevu page hooks to the internal runtime vendor chunk', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: [
          'import { onShareAppMessage } from "wevu";',
          'onShareAppMessage(() => ({ title: "share" }));',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/wevu-router.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-router.js',
        code: [
          'Object.defineProperty(exports, "createRouter", { enumerable: true, get: function() { return createRouter; } });',
          'Object.defineProperty(exports, "useRouter", { enumerable: true, get: function() { return useRouter; } });',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/wevu-watch.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-watch.js',
        code: [
          'Object.defineProperty(exports, "createApp", { enumerable: true, get: function() { return createApp; } });',
          'Object.defineProperty(exports, "onShareAppMessage", { enumerable: true, get: function() { return onShareAppMessage; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle)

    expect(bundle['pages/index/index.js'].code).not.toContain('from "wevu"')
    expect(bundle['pages/index/index.js'].code).toContain('const { onShareAppMessage } = require("../../weapp-vendors/wevu-watch.js");')
    expect(bundle['pages/index/index.js'].code).not.toContain('wevu-router.js')
    expect(bundle['pages/index/index.js'].imports).toEqual(['weapp-vendors/wevu-watch.js'])
  })

  it('splits bare wevu internal imports by runtime module', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: [
          'import { ref, unref, onShareAppMessage } from "wevu";',
          'const count = ref(0);',
          'unref(count);',
          'onShareAppMessage(() => ({}));',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/wevu-ref.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-ref.js',
        code: [
          'Object.defineProperty(exports, "ref", { enumerable: true, get: function() { return ref; } });',
          'Object.defineProperty(exports, "unref", { enumerable: true, get: function() { return unref; } });',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/wevu-watch.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-watch.js',
        code: [
          'Object.defineProperty(exports, "createApp", { enumerable: true, get: function() { return createApp; } });',
          'Object.defineProperty(exports, "onShareAppMessage", { enumerable: true, get: function() { return onShareAppMessage; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle)

    expect(bundle['pages/index/index.js'].code).not.toContain('from "wevu"')
    expect(bundle['pages/index/index.js'].code).toContain('const { ref, unref } = require("../../weapp-vendors/wevu-ref.js");')
    expect(bundle['pages/index/index.js'].code).toContain('const { onShareAppMessage } = require("../../weapp-vendors/wevu-watch.js");')
    expect(bundle['pages/index/index.js'].imports).toEqual([
      'weapp-vendors/wevu-ref.js',
      'weapp-vendors/wevu-watch.js',
    ])
  })

  it('rewrites partial hmr bare wevu internal imports with remembered module vendor files', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: [
          'import { ref, onShareAppMessage } from "wevu";',
          'const count = ref(0);',
          'onShareAppMessage(() => ({}));',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileNames: new Map([
        ['wevu/internal-reactivity', 'weapp-vendors/wevu-ref.js'],
        ['wevu/internal-runtime', 'weapp-vendors/wevu-watch.js'],
      ]),
    })

    expect(bundle['pages/index/index.js'].code).not.toContain('from "wevu"')
    expect(bundle['pages/index/index.js'].code).toContain('const { ref } = require("../../weapp-vendors/wevu-ref.js");')
    expect(bundle['pages/index/index.js'].code).toContain('const { onShareAppMessage } = require("../../weapp-vendors/wevu-watch.js");')
    expect(bundle['pages/index/index.js'].imports).toEqual([
      'weapp-vendors/wevu-ref.js',
      'weapp-vendors/wevu-watch.js',
    ])
  })

  it('does not reuse the legacy runtime vendor file for bare wevu reactivity imports', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: [
          'import { unref } from "wevu";',
          'unref(count);',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileName: 'weapp-vendors/wevu-watch.js',
      runtimeFileNames: new Map([
        ['wevu/internal-reactivity', 'weapp-vendors/wevu-ref.js'],
      ]),
    })

    expect(bundle['pages/index/index.js'].code).not.toContain('wevu-watch.js')
    expect(bundle['pages/index/index.js'].code).toContain('const { unref } = require("../../weapp-vendors/wevu-ref.js");')
    expect(bundle['pages/index/index.js'].imports).toEqual(['weapp-vendors/wevu-ref.js'])
  })

  it('keeps unknown bare wevu imports while splitting known runtime imports', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: [
          'import { ref, experimentalApi as useExperimentalApi } from "wevu";',
          'const count = ref(0);',
          'useExperimentalApi(count);',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/wevu-ref.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-ref.js',
        code: 'Object.defineProperty(exports, "ref", { enumerable: true, get: function() { return ref; } });',
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle)

    expect(bundle['pages/index/index.js'].code).toContain('const { ref } = require("../../weapp-vendors/wevu-ref.js");')
    expect(bundle['pages/index/index.js'].code).toContain('import { experimentalApi as useExperimentalApi } from "wevu";')
    expect(bundle['pages/index/index.js'].imports).toEqual(['weapp-vendors/wevu-ref.js'])
  })

  it('rewrites bare wevu router imports to emitted vendor requires', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'import { createRouter, useRouter as useWevuRouter } from "wevu/router";',
          'const router = createRouter({ routes: [] });',
          'useWevuRouter();',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/wevu-router.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-router.js',
        code: [
          'Object.defineProperty(exports, "createRouter", { enumerable: true, get: function() { return createRouter; } });',
          'Object.defineProperty(exports, "useRouter", { enumerable: true, get: function() { return useRouter; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle)

    expect(bundle['app.js'].code).not.toContain('from "wevu/router"')
    expect(bundle['app.js'].code).toContain('const { createRouter, useRouter: useWevuRouter } = require("./weapp-vendors/wevu-router.js");')
    expect(bundle['app.js'].imports).toEqual(['weapp-vendors/wevu-router.js'])
  })

  it('rewrites partial hmr wevu router imports with a remembered vendor file', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'import { createRouter } from "wevu/router";',
          'const router = createRouter({ routes: [] });',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileNames: new Map([
        ['wevu/router', 'weapp-vendors/wevu-router.js'],
      ]),
    })

    expect(bundle['app.js'].code).not.toContain('from "wevu/router"')
    expect(bundle['app.js'].code).toContain('const { createRouter } = require("./weapp-vendors/wevu-router.js");')
    expect(bundle['app.js'].imports).toEqual(['weapp-vendors/wevu-router.js'])
  })

  it('rewrites partial hmr bare wevu require calls used by app runtime bootstrap', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'const { setWevuDefaults, createApp } = require("wevu");',
          'setWevuDefaults({});',
          'createApp({ hmr: true });',
        ].join('\n'),
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileName: 'weapp-vendors/wevu-watch.js',
    })

    expect(bundle['app.js'].code).not.toContain('require("wevu")')
    expect(bundle['app.js'].code).toContain('const { setWevuDefaults, createApp } = require("./weapp-vendors/wevu-watch.js");')
    expect(bundle['app.js'].imports).toEqual(['weapp-vendors/wevu-watch.js'])
  })

  it('does not rewrite generic bare wevu require calls to app runtime chunks', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: 'const { ref } = require("wevu");const count = ref(0);',
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      runtimeFileName: 'weapp-vendors/wevu-watch.js',
    })

    expect(bundle['pages/index/index.js'].code).toBe('const { ref } = require("wevu");const count = ref(0);')
    expect(bundle['pages/index/index.js'].imports).toEqual([])
  })

  it('records emitted wevu internal runtime chunks even when no bare import is rewritten', () => {
    let runtimeFileName: string | undefined
    const runtimeFileNames = new Map<string, string>()
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
      onRuntimeModuleFileName(moduleId, fileName) {
        runtimeFileNames.set(moduleId, fileName)
      },
    })

    expect(runtimeFileName).toBe('weapp-vendors/wevu-watch.js')
    expect(runtimeFileNames.get('wevu/internal-runtime')).toBe('weapp-vendors/wevu-watch.js')
    expect(bundle['app.js'].code).toBe('const runtime = require("./weapp-vendors/wevu-watch.js");runtime.createApp({});')
  })

  it('records emitted wevu reactivity and template chunks for later partial hmr rewrites', () => {
    const runtimeFileNames = new Map<string, string>()
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
      'weapp-vendors/wevu-ref.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-ref.js',
        code: 'Object.defineProperty(exports, "ref", { enumerable: true, get: function() { return ref; } });',
        imports: [],
      },
      'weapp-vendors/wevu-template.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-template.js',
        code: 'Object.defineProperty(exports, "normalizeClass", { enumerable: true, get: function() { return normalizeClass; } });',
        imports: [],
      },
    } as any

    rewriteWevuInternalRuntimeImports(bundle, {
      onRuntimeModuleFileName(moduleId, fileName) {
        runtimeFileNames.set(moduleId, fileName)
      },
    })

    expect(runtimeFileNames.get('wevu/internal-runtime')).toBe('weapp-vendors/wevu-watch.js')
    expect(runtimeFileNames.get('wevu/internal-reactivity')).toBe('weapp-vendors/wevu-ref.js')
    expect(runtimeFileNames.get('wevu/internal-template')).toBe('weapp-vendors/wevu-template.js')
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

  it('indexes runtime chunk usage without rewriting unrelated wevu chunks', () => {
    const bundle = {
      'pages/runtime/index.js': {
        type: 'chunk',
        fileName: 'pages/runtime/index.js',
        code: [
          'const require_src_ABC = require("../../weapp-vendors/wevu-src.js");',
          'var page = require_src_ABC.eo({});',
          'const require_watch_ABC = require("../../weapp-vendors/wevu-watch.js");',
          'require_watch_ABC.onShareTimeline(() => ({}));',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-src.js', 'weapp-vendors/wevu-watch.js'],
      },
      'weapp-vendors/wevu-src.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-src.js',
        code: [
          'function eo(e) { return e }',
          'Object.defineProperty(exports, "eo", { enumerable: true, get: function() { return eo; } });',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/wevu-watch.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-watch.js',
        code: [
          'const require_weapp_vendors_wevu_base = require("./wevu-ref.js");',
          'function onLoad(handler) { require_weapp_vendors_wevu_base.pushHook(require_weapp_vendors_wevu_base.assertInSetup("onLoad"), "onLoad", handler); }',
          'Object.defineProperty(exports, "onLoad", { enumerable: true, get: function() { return onLoad; } });',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-ref.js'],
      },
      'weapp-vendors/wevu-ref.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-ref.js',
        code: [
          'function assertInSetup(name) { return {}; }',
          'function pushHook() {}',
          'Object.defineProperty(exports, "assertInSetup", { enumerable: true, get: function() { return assertInSetup; } });',
          'Object.defineProperty(exports, "pushHook", { enumerable: true, get: function() { return pushHook; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    stabilizeWevuRuntimeChunkAccess(bundle)

    const pageCode = bundle['pages/runtime/index.js'].code
    expect(pageCode).toContain('(require_src_ABC.__wevuDefineComponent || require_src_ABC.eo)({})')
    expect(pageCode).toContain('require_watch_ABC.onShareTimeline || function(handler)')
    expect(bundle['weapp-vendors/wevu-src.js'].code).toContain('"__wevuDefineComponent"')
    expect(bundle['weapp-vendors/wevu-src.js'].code).not.toContain('"onShareTimeline"')
    expect(bundle['weapp-vendors/wevu-watch.js'].code).toContain('"onShareTimeline"')
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

  it('adds synthetic single page hook exports when hmr preserves only router hook helpers', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: [
          'const require_weapp_vendors_wevu_router = require("../../weapp-vendors/wevu-src.js");',
          'require_weapp_vendors_wevu_router.onShareAppMessage(() => ({}));',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-src.js'],
      },
      'weapp-vendors/wevu-src.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-src.js',
        code: [
          'const require_weapp_vendors_wevu_base = require("./wevu-ref.js");',
          'function onLoad(handler) { require_weapp_vendors_wevu_base.pushHook(require_weapp_vendors_wevu_base.assertInSetup("onLoad"), "onLoad", handler); }',
          'Object.defineProperty(exports, "onLoad", { enumerable: true, get: function() { return onLoad; } });',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-ref.js'],
      },
      'weapp-vendors/wevu-ref.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-ref.js',
        code: [
          'function assertInSetup(name) { return {}; }',
          'function pushHook() {}',
          'Object.defineProperty(exports, "assertInSetup", { enumerable: true, get: function() { return assertInSetup; } });',
          'Object.defineProperty(exports, "pushHook", { enumerable: true, get: function() { return pushHook; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    stabilizeWevuRuntimeChunkAccess(bundle)

    const wevuCode = bundle['weapp-vendors/wevu-src.js'].code
    const pageCode = bundle['pages/index/index.js'].code
    expect(wevuCode).toContain('function onShareAppMessage(handler)')
    expect(wevuCode).toContain('assertInSetup("onShareAppMessage")')
    expect(wevuCode).toContain('pushHook(instance, "onShareAppMessage", handler, { single: true })')
    expect(wevuCode).toContain('Object.defineProperty(exports, "onShareAppMessage"')
    expect(pageCode).toContain('require_weapp_vendors_wevu_router.onShareAppMessage || function(handler)')
    expect(pageCode).toContain('require("../../weapp-vendors/wevu-ref.js").assertInSetup("onShareAppMessage")')
    expect(bundle['pages/index/index.js'].imports).toEqual([
      'weapp-vendors/wevu-src.js',
      'weapp-vendors/wevu-ref.js',
    ])
  })

  it('stabilizes single page hook member access for split wevu vendor chunks', () => {
    const bundle = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: [
          'const require_weapp_vendors_wevu_watch = require("../../weapp-vendors/wevu-watch.js");',
          'require_weapp_vendors_wevu_watch.onShareTimeline(() => ({}));',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-watch.js'],
      },
      'weapp-vendors/wevu-watch.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-watch.js',
        code: [
          'const require_weapp_vendors_wevu_base = require("./wevu-ref.js");',
          'function onLoad(handler) { require_weapp_vendors_wevu_base.pushHook(require_weapp_vendors_wevu_base.assertInSetup("onLoad"), "onLoad", handler); }',
          'Object.defineProperty(exports, "onLoad", { enumerable: true, get: function() { return onLoad; } });',
        ].join('\n'),
        imports: ['weapp-vendors/wevu-ref.js'],
      },
      'weapp-vendors/wevu-ref.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/wevu-ref.js',
        code: [
          'function assertInSetup(name) { return {}; }',
          'function pushHook() {}',
          'Object.defineProperty(exports, "assertInSetup", { enumerable: true, get: function() { return assertInSetup; } });',
          'Object.defineProperty(exports, "pushHook", { enumerable: true, get: function() { return pushHook; } });',
        ].join('\n'),
        imports: [],
      },
    } as any

    stabilizeWevuRuntimeChunkAccess(bundle)

    const wevuCode = bundle['weapp-vendors/wevu-watch.js'].code
    const pageCode = bundle['pages/index/index.js'].code
    expect(wevuCode).toContain('function onShareTimeline(handler)')
    expect(wevuCode).toContain('assertInSetup("onShareTimeline")')
    expect(pageCode).toContain('require_weapp_vendors_wevu_watch.onShareTimeline || function(handler)')
    expect(pageCode).toContain('require("../../weapp-vendors/wevu-ref.js").pushHook')
    expect(bundle['pages/index/index.js'].imports).toEqual([
      'weapp-vendors/wevu-watch.js',
      'weapp-vendors/wevu-ref.js',
    ])
  })
})
