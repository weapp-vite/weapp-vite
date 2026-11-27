import type { NativeChunk } from '../../../../../../test/utils/nativeFixture'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { createTestCompilerContext } from '../../../../../../test/utils'
import { buildFixture, execute, hasNativeBindingDependency, isNativeBindingChunk, readEmittedJavaScript, streamPageSource, writeFixture } from '../../../../../../test/utils/nativeFixture'
import { getWebRuntimeGlobalResolvedId, WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID, WEB_RUNTIME_INJECT_RESOLVED_ID } from '../../../../../runtime/config/internal/injectRequestGlobals/nativeInject'

describe('stream globals in native Vite output', () => {
  it.each([false, true])('supplies precise stream bindings before a third-party top-level subclass and instance, minify=%s', async (minify) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-global-order-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, minify, chunks))
      const { context, Page } = execute(files)
      // 精确行为：根入口不引用目标则不依赖绑定集合（懒加载）；页面引用 stream 才在页面 chunk 精确绑定，
      // 第三方顶层 subclass 仍拿到同一份绑定。
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(true)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(typeof context.autoStreamProbe.readable.getReader).toBe('function')
      expect(typeof context.autoStreamProbe.writable.getWriter).toBe('function')
      expect([...files.values()].join('\n')).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('evaluates precise Web Runtime bindings before a custom app prelude in native mode', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-prelude-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        appPreludeMode: 'native',
        appPreludeSource: `globalThis.__nativePreludeFetchType = typeof fetch
          globalThis.__nativePreludeGlobalThisFetchType = typeof globalThis.fetch
          globalThis.__nativePreludeUrl = new URL('https://example.com/a/../b').pathname`,
      }))
      const { context, Page } = execute(files)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(context.__nativePreludeFetchType).toBe('function')
      expect(context.__nativePreludeGlobalThisFetchType).toBe('function')
      expect(context.__nativePreludeUrl).toBe('/b')
      expect(files.has('app.prelude.js')).toBe(false)
      // 自定义 Prelude 的 globalThis.fetch 点号访问由 inject 精确绑定，不写全局；自由标识符 new URL 同样不写全局。
      expect(context.fetch).toBeUndefined()
      expect(context.URL).toBeUndefined()
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(true)
      expect(hasNativeBindingDependency(chunks, 'app.js', WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID)).toBe(true)
      const preludeChunk = chunks.find(chunk => chunk.moduleIds.includes(WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID))
      expect(preludeChunk).toBeDefined()
      expect(preludeChunk!.imports).not.toContain('app.js')
      expect([...files.values()].join('\n')).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('loads precise Web Runtime bindings only when a referencing page loads', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-lazy-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks))
      const { context, Page, load } = execute(files, [])
      expect(chunks.some(chunk => isNativeBindingChunk(chunk))).toBe(true)
      expect(chunks.find(chunk => chunk.fileName === 'app.js')?.moduleIds).not.toContain(WEB_RUNTIME_INJECT_RESOLVED_ID)
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
      expect(context.fetch).toBeUndefined()
      expect(Page).not.toHaveBeenCalled()

      load('pages/index/index.js')
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(true)
      expect(context.fetch).toBeUndefined()
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(typeof context.autoStreamProbe.readable.getReader).toBe('function')
      expect(typeof context.autoStreamProbe.writable.getWriter).toBe('function')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('installs declared globalTargets bridges precisely without unused targets', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-global-targets-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        pageSource: `globalThis.__nativeFetchType = typeof globalThis.fetch
          Page({ data: { ready: true } })`,
        globalTargets: ['fetch'],
      }))
      // 精确行为不强制 shim vendor：桥接由打包器自然分组，全局写入只覆盖声明/引用的目标。
      expect(files.has('weapp-vendors/shim.js')).toBe(false)
      const allCode = [...files.values()].join('\n')
      expect(allCode).toMatch(/Reflect\.set\(\s*globalThis,\s*["']fetch["']/u)
      // 未声明且未引用的目标不安装。
      expect(allCode).not.toMatch(/Reflect\.set\(\s*globalThis,\s*["']WebSocket["']/u)
      const { context, Page } = execute(files)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(context.__nativeFetchType).toBe('function')
      expect(typeof context.fetch).toBe('function')
      expect(context.WebSocket).toBeUndefined()
      expect(allCode).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('installs globalTargets declared outside the narrowed targets scope at startup', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-global-targets-decoupled-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        targets: ['fetch'],
        globalTargets: ['WebSocket'],
        pageSource: 'Page({ data: { ready: true } })',
      }))
      const allCode = [...files.values()].join('\n')
      // 声明的 WebSocket 不在 targets 绑定资格内，仍由根入口桥接安装（修复前被静默丢弃）。
      expect(allCode).toMatch(/Reflect\.set\(\s*globalThis,\s*["']WebSocket["']/u)
      const { context, Page } = execute(files)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(typeof context.WebSocket).toBe('function')
      expect(allCode).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps native dotted global access module-local without a forced shim vendor', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-shim-chunk-off-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        pageSource: `globalThis.__nativeFetchType = typeof globalThis.fetch
          Page({ data: { ready: true } })`,
      }))
      // 精确行为不强制拆分：点号全局访问由 inject 绑定，不生成全局桥接或 shim vendor。
      expect(files.has('weapp-vendors/shim.js')).toBe(false)
      expect(files.get('pages/index/index.js') ?? '').not.toMatch(/Reflect\.set\(\s*globalThis/u)
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(true)
      const { context, Page } = execute(files)
      expect(context.__nativeFetchType).toBe('function')
      expect(context.fetch).toBeUndefined()
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('defaults appPrelude.webRuntime to reference-driven binding evaluation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-nested-lazy-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, { webRuntimeScope: 'app-prelude' }))
      const { context, Page, load } = execute(files, [])
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
      expect(context.fetch).toBeUndefined()
      expect(Page).not.toHaveBeenCalled()

      load('pages/index/index.js')
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(true)
      expect(context.fetch).toBeUndefined()
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('installs declared globalTargets at app startup via the root entry', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-nested-global-targets-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        webRuntimeScope: 'app-prelude',
        globalTargets: ['fetch'],
      }))
      const { context, Page } = execute(files, [])
      // 嵌套 `appPrelude.webRuntime` 与顶层配置共用同一解析结果：globalTargets 声明的目标由根入口静态依赖桥接，
      // 启动期安装；未声明且未引用的目标不安装，用户覆盖也不会被凭空求值。
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(true)
      expect(typeof context.fetch).toBe('function')
      expect(context.__nativeUserOverrideEvaluations).toBeUndefined()
      expect(Page).not.toHaveBeenCalled()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each([false, true])('keeps unused user overrides lazy unless declared in globalTargets (declared=%s)', async (declared) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-user-override-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        appSource: 'App({})',
        inject: { atob: 'virtual:user-atob' },
        pageSource: 'Page({ data: { ready: true } })',
        targets: ['atob'],
        ...(declared ? { globalTargets: ['atob' as const] } : {}),
      }))
      const { context } = execute(files)
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(false)
      if (declared) {
        // globalTargets 声明后根入口启动期求值用户覆盖并写入全局。
        expect(context.__nativeUserOverrideEvaluations).toEqual(['atob'])
        expect(typeof context.atob).toBe('function')
      }
      else {
        expect(context.__nativeUserOverrideEvaluations).toBeUndefined()
        expect(context.atob).toBeUndefined()
      }
      expect([...files.values()].join('\n')).not.toMatch(/installWebRuntime|installRequestGlobals|installRequestGlobalBinding|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('evaluates bindings at app startup when the app itself references a target', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-app-reference-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        appSource: `globalThis.__nativeAppFetchType = typeof fetch; App({})`,
      }))
      const { context } = execute(files, [])
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(true)
      expect(context.__nativeAppFetchType).toBe('function')
      expect(context.fetch).toBeUndefined()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('runs an independent custom app prelude at startup with lazy native binding evaluation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-independent-prelude-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        appPreludeMode: 'native',
        appPreludeSource: `globalThis.__nativeIndependentPrelude = 'ready'`,
      }))
      const { context } = execute(files, [])
      expect(context.__nativeIndependentPrelude).toBe('ready')
      expect(context.fetch).toBeUndefined()
      expect(files.has('app.prelude.js')).toBe(false)
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps native custom prelude modular when Web Runtime is disabled', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-prelude-only-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        appPreludeMode: 'native',
        appPreludeSource: `globalThis.__nativePreludeOnly = typeof fetch`,
        webRuntimeEnabled: false,
      }))
      const { context } = execute(files, [])
      expect(context.__nativePreludeOnly).toBeUndefined()
      expect(context.fetch).toBeUndefined()
      expect(files.has('app.prelude.js')).toBe(false)
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('runs a lazy custom prelude once before an app entry that references a target', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-app-prelude-order-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        appPreludeMode: 'native',
        appPreludeSource: `globalThis.__nativePreludeRuns = (globalThis.__nativePreludeRuns ?? 0) + 1`,
        appSource: `globalThis.__nativeAppOrder = [typeof fetch, globalThis.__nativePreludeRuns]; App({})`,
      }))
      const { context } = execute(files, [])
      expect(context.__nativeAppOrder).toEqual(['function', 1])
      expect(context.__nativePreludeRuns).toBe(1)
      expect(files.has('app.prelude.js')).toBe(false)
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(true)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not load Web Runtime for axios when only unrelated targets are configured', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-axios-narrow-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        axios: true,
        pageSource: `import axios from 'axios';
          globalThis.__axios = axios;
          Page({ data: { ready: true } });`,
        targets: ['AbortController'],
      }))
      const { Page } = execute(files)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(false)
      expect(chunks.some(chunk => chunk.moduleIds.some(id => id.includes('web-runtime:axios-env')))).toBe(false)
      expect([...files.values()].join('\n')).not.toMatch(/axiosEnv|eagerBindings|__wvAXFE__/u)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('loads default axios environment bindings lazily without installing host globals', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-axios-lazy-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        axios: true,
        pageSource: `import axios from 'axios';
          globalThis.__axios = axios;
          Page({ data: { ready: true } });`,
      }))
      const { context, Page, load } = execute(files, [])
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
      expect(hasNativeBindingDependency(chunks, 'app.js', getWebRuntimeGlobalResolvedId('fetch'))).toBe(false)
      expect(context.fetch).toBeUndefined()
      expect(Page).not.toHaveBeenCalled()

      load('pages/index/index.js')
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(true)
      for (const target of ['fetch', 'Request', 'Response']) {
        expect(hasNativeBindingDependency(chunks, 'pages/index/index.js', getWebRuntimeGlobalResolvedId(target))).toBe(true)
      }
      expect(typeof context.fetch).toBe('function')
      expect(typeof context.__axios.defaults.env.fetch).toBe('function')
      expect(typeof context.__axios.defaults.env.Request).toBe('function')
      expect(typeof context.__axios.defaults.env.Response).toBe('function')
      expect([...files.values()].join('\n')).not.toMatch(/axiosEnv|eagerBindings|__wvAXFE__/u)
      expect([...files.values()].join('\n')).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('replaces placeholder-marked host globals while preserving real host implementations', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-placeholder-global-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, { globalTargets: ['fetch'] }))

      const placeholder = Object.assign(() => 'placeholder fetch', { [REQUEST_GLOBAL_PLACEHOLDER_KEY]: true })
      const placeholderRun = execute(files, ['pages/index/index.js'], { fetch: placeholder })
      expect(placeholderRun.context.fetch).not.toBe(placeholder)
      expect(typeof placeholderRun.context.fetch).toBe('function')

      const hostFetch = () => 'host fetch'
      const hostRun = execute(files, ['pages/index/index.js'], { fetch: hostFetch })
      expect(hostRun.context.fetch).toBe(hostFetch)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('feeds user-overridden native bindings into axios defaults env', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-axios-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        axios: true,
        inject: {
          fetch: 'virtual:user-fetch',
          Request: ['virtual:user-request', 'UserRequest'],
          Response: ['virtual:user-response', 'UserResponse'],
        },
        pageSource: `import axios, { probe } from 'axios';
          globalThis.__axios = axios;
          globalThis.__axiosProbe = probe()
          Page({ data: { ready: true } });`,
      }))
      const { context, Page } = execute(files)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(context.__axiosProbe).toBe('user fetch')
      expect(context.fetch()).toBe('user fetch')
      expect(new context.Request().kind).toBe('user request')
      expect(new context.Response().kind).toBe('user response')
      expect(context.__axios.defaults.env.fetch()).toBe('user fetch')
      expect(new context.__axios.defaults.env.Request().kind).toBe('user request')
      expect(new context.__axios.defaults.env.Response().kind).toBe('user response')
      expect([...files.values()].join('\n')).not.toMatch(/axiosEnv|eagerBindings|__wvAXFE__/u)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('retains executable native bindings after a watch rebuild', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-watch-'))
    const chunkBatches: NativeChunk[][] = []
    const pageCodes: string[] = []
    let watcher: { close: () => Promise<void> } | undefined
    let dispose: (() => Promise<void>) | undefined
    try {
      await writeFixture(root)
      const fixture = await createTestCompilerContext({
        cwd: root,
        isDev: true,
        mode: 'development',
        inlineConfig: {
          configFile: false,
          publicDir: false,
          logLevel: 'silent',
          build: {
            minify: false,
            watch: { chokidar: { usePolling: true, interval: 100 } },
          },
          weapp: {
            srcRoot: 'src',
            autoRoutes: false,
            vue: { enable: false },
            npm: { enable: false },
            appPrelude: { mode: 'native' },
            injectWebRuntimeGlobals: { enabled: true },
          },
          plugins: [{
            name: 'capture-native-web-runtime-watch-output',
            generateBundle(_options, bundle) {
              const batch: NativeChunk[] = []
              for (const output of Object.values(bundle)) {
                if (output.type === 'chunk') {
                  const chunk = { fileName: output.fileName, moduleIds: output.moduleIds, imports: output.imports }
                  batch.push(chunk)
                  if (output.fileName === 'pages/index/index.js') {
                    pageCodes.push(output.code)
                  }
                }
              }
              chunkBatches.push(batch)
            },
          }],
        },
      })
      dispose = fixture.dispose
      watcher = await fixture.ctx.buildService.build({ skipNpm: true }) as { close: () => Promise<void> }
      await expect.poll(() => pageCodes.length, { timeout: 10_000 }).toBeGreaterThan(0)
      const previousCount = pageCodes.length
      await writeFile(path.join(root, 'src/pages/index/index.ts'), `${streamPageSource}\nglobalThis.nativeWatchEdit = 'ready'`)
      await expect.poll(async () => (await readEmittedJavaScript(root)).get('pages/index/index.js')?.includes('nativeWatchEdit'), { timeout: 10_000 }).toBe(true)
      const latestChunks = chunkBatches.at(-1)!
      const latestFiles = await readEmittedJavaScript(root)
      const { context, Page } = execute(latestFiles)
      expect(pageCodes.length).toBeGreaterThan(previousCount)
      expect(context.nativeWatchEdit).toBe('ready')
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      // 精确行为：根入口不引用目标则每轮构建后仍懒加载；引用 stream 的页面 chunk 保留可执行绑定。
      expect(hasNativeBindingDependency(latestChunks, 'app.js')).toBe(false)
      expect(hasNativeBindingDependency(latestChunks, 'pages/index/index.js')).toBe(true)
      expect(typeof context.autoStreamProbe.readable.getReader).toBe('function')
      expect(typeof context.autoStreamProbe.writable.getWriter).toBe('function')
      for (const code of pageCodes) {
        expect(code).not.toContain('__weappViteInstallRequestGlobals')
        expect(code).not.toContain('__weappViteInstallWebRuntime')
      }
      expect(chunkBatches.length).toBeGreaterThanOrEqual(2)
    }
    finally {
      try {
        await watcher?.close()
      }
      finally {
        await dispose?.()
        await rm(root, { recursive: true, force: true })
      }
    }
  }, 60_000)

  it('keeps native bindings inside an independent subpackage build', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-stream-independent-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, { independent: true }))
      const { context, Page } = execute(files, ['pkg/pages/index/index.js'])
      expect(hasNativeBindingDependency(chunks, 'pkg/pages/index/index.js')).toBe(true)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(typeof context.autoStreamProbe.readable.getReader).toBe('function')
      expect(typeof context.autoStreamProbe.writable.getWriter).toBe('function')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
