import type { Plugin } from 'rolldown'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { REQUEST_GLOBAL_NATIVE_OWNER_KEY, REQUEST_GLOBAL_PLACEHOLDER_KEY, WEB_RUNTIME_GLOBAL_TARGETS } from '@weapp-core/constants'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { resolveRequestRuntimeOptions } from '../injectRequestGlobals'
import {
  createNativeWebRuntimeModuleMatcher,
  createWebRuntimeGlobalBridgeCode,
  createWebRuntimeNativeGlobalImports,
  createWebRuntimeNativeInject,
  getWebRuntimeGlobalResolvedId,
  getWebRuntimeGlobalVirtualId,
  mergeWebRuntimeNativeInject,
  resolveWebRuntimeGlobalTarget,
  WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX,
  WEB_RUNTIME_INJECT_RESOLVED_ID,
  WEB_RUNTIME_INJECT_VIRTUAL_ID,
} from './nativeInject'

function createNativeInjectPlugin(plan: NonNullable<ReturnType<typeof createWebRuntimeNativeInject>>, sources: Record<string, string>): Plugin {
  return {
    name: 'test-web-runtime-native-inject',
    resolveId(id) {
      if (id === WEB_RUNTIME_INJECT_VIRTUAL_ID) {
        return { id: WEB_RUNTIME_INJECT_RESOLVED_ID, moduleSideEffects: true }
      }
      if (id.startsWith('virtual:weapp-vite-web-runtime:global:')) {
        return { id: id.replace('virtual:weapp-vite-web-runtime:global:', 'weapp-vite:web-runtime:global:'), moduleSideEffects: true }
      }
      if (id === 'weapp-vite/web-apis/runtime') {
        return { id: 'virtual:runtime', moduleSideEffects: true }
      }
      if (id === 'weapp-vite/web-apis/runtime-global') {
        return { id: 'virtual:runtime-global', moduleSideEffects: true }
      }
      if (id === 'weapp-vite/web-apis/runtime-ensure') {
        return { id: 'virtual:runtime-ensure', moduleSideEffects: true }
      }
      if (id in sources) {
        return { id, moduleSideEffects: true }
      }
      return null
    },
    load(id) {
      if (id === WEB_RUNTIME_INJECT_RESOLVED_ID) {
        return { code: plan.code, moduleSideEffects: true }
      }
      const target = resolveWebRuntimeGlobalTarget(id)
      if (target) {
        return { code: createWebRuntimeGlobalBridgeCode(plan, target), moduleSideEffects: true }
      }
      if (id === 'virtual:runtime') {
        return { code: sources['virtual:runtime']!, moduleSideEffects: true }
      }
      if (id === 'virtual:runtime-global') {
        return { code: sources['virtual:runtime-global']!, moduleSideEffects: true }
      }
      if (id === 'virtual:runtime-ensure') {
        return { code: sources['virtual:runtime-ensure']!, moduleSideEffects: true }
      }
      return id in sources ? { code: sources[id]!, moduleSideEffects: true } : null
    },
  }
}

const runtimeSource = `
globalThis.__webRuntimeImportCount = (globalThis.__webRuntimeImportCount ?? 0) + 1
if (Reflect.get(globalThis, 'FormData') !== undefined) {
  throw new Error('runtime module must not consume its own injected binding')
}
export const fetch = () => 'polyfilled fetch'
export class HeadersPolyfill {}
export class RequestPolyfill { kind = 'default request' }
export class ResponsePolyfill { kind = 'default response' }
export class TextEncoderPolyfill {}
export class TextDecoderPolyfill {}
export class AbortControllerPolyfill {}
export class AbortSignalPolyfill {}
export class XMLHttpRequestPolyfill {}
export class WebSocketPolyfill {}
export const atobPolyfill = value => value
export const btoaPolyfill = value => value
export const queueMicrotaskPolyfill = callback => callback()
export const performancePolyfill = { now: () => 0 }
export const cryptoPolyfill = { getRandomValues: value => value }
export class EventPolyfill {}
export class CustomEventPolyfill {}
export class ReadableStream {}
export class WritableStream {}
export class TransformStream {}
export class TextDecoderStreamPolyfill {}
export class EventSourcePolyfill {}
export class URLPolyfill {
  constructor(input) {
    this.href = input
  }
}
export class URLSearchParamsPolyfill {}
export class BlobPolyfill {}
export class FilePolyfill {}
export class FormDataPolyfill {}
export const usesNativeStreams = true
export function setMiniProgramNetworkDefaults(defaults) {
  globalThis.__webRuntimeNetworkDefaults = defaults
}
`

const runtimeEnsureSource = `
export function shouldInstallWebRuntimeGlobal(current) {
  return current == null
    || Boolean(current && (typeof current === 'object' || typeof current === 'function') && current[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}] === true)
    || Boolean(current && (typeof current === 'object' || typeof current === 'function') && current[${JSON.stringify(REQUEST_GLOBAL_NATIVE_OWNER_KEY)}] === true)
}
export function markWebRuntimeGlobalInstalled(value) {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    try {
      Object.defineProperty(value, ${JSON.stringify(REQUEST_GLOBAL_NATIVE_OWNER_KEY)}, { value: true, configurable: true })
    }
    catch {}
  }
  return value
}
export function ensureWebRuntimeHeaders(current, fallback) {
  if (shouldInstallWebRuntimeGlobal(current)) {
    return fallback
  }
  if (typeof current !== 'function') {
    return fallback
  }
  try {
    if (typeof current.prototype?.getSetCookie !== 'function') {
      current.prototype.getSetCookie = () => []
    }
    return current
  }
  catch {
    return fallback
  }
}
export function ensureWebRuntimeResponse(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeTextDecoder(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimePerformance(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeCrypto(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeURL(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeURLSearchParams(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeBlob(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeFile(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeFormData(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeTextDecoderStream(current, fallback, usesNativeStreams) {
  if (shouldInstallWebRuntimeGlobal(current) || !usesNativeStreams) {
    return fallback
  }
  try {
    const stream = new current('utf-8')
    return typeof stream.readable?.getReader === 'function' && typeof stream.writable?.getWriter === 'function'
      ? current
      : fallback
  }
  catch {
    return fallback
  }
}
`

const runtimeGlobalSource = `
export function shouldInstallWebRuntimeGlobal(current) {
  return current == null
    || Boolean(current && (typeof current === 'object' || typeof current === 'function') && current[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}] === true)
    || Boolean(current && (typeof current === 'object' || typeof current === 'function') && current[${JSON.stringify(REQUEST_GLOBAL_NATIVE_OWNER_KEY)}] === true)
}
export function markWebRuntimeGlobalInstalled(value) {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    try {
      Object.defineProperty(value, ${JSON.stringify(REQUEST_GLOBAL_NATIVE_OWNER_KEY)}, { value: true, configurable: true })
    }
    catch {}
  }
  return value
}
export function ensureWebRuntimePerformance(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
export function ensureWebRuntimeCrypto(current, fallback) { return shouldInstallWebRuntimeGlobal(current) ? fallback : current }
`

async function generateCjs(plan: NonNullable<ReturnType<typeof createWebRuntimeNativeInject>>, entry: string, sources: Record<string, string> = {}) {
  const bundle = await rolldown({
    input: 'virtual:entry',
    plugins: [createNativeInjectPlugin(plan, {
      'virtual:entry': entry,
      'virtual:runtime': runtimeSource,
      'virtual:runtime-global': runtimeGlobalSource,
      'virtual:runtime-ensure': runtimeEnsureSource,
      ...sources,
    })],
    transform: { inject: plan.inject },
    output: { format: 'cjs', codeSplitting: false },
  })
  const generated = await bundle.generate({ format: 'cjs', codeSplitting: false })
  await bundle.close()
  const output = generated.output.find(chunk => chunk.type === 'chunk' && chunk.isEntry)
  if (!output || output.type !== 'chunk') {
    throw new Error('missing entry chunk')
  }
  return output.code
}

describe('native WebRuntime inject', () => {
  it('creates precise free and dotted global bindings and preserves network defaults', () => {
    const plan = createWebRuntimeNativeInject(['fetch'], {
      request: { timeout: 1234 },
    })!

    expect(plan.inject.fetch).toEqual([WEB_RUNTIME_INJECT_VIRTUAL_ID, 'fetch'])
    expect(plan.inject['globalThis.fetch']).toEqual([WEB_RUNTIME_INJECT_VIRTUAL_ID, 'fetch'])
    expect(plan.inject['window.fetch']).toEqual([WEB_RUNTIME_INJECT_VIRTUAL_ID, 'fetch'])
    expect(plan.inject['self.fetch']).toEqual([WEB_RUNTIME_INJECT_VIRTUAL_ID, 'fetch'])
    expect(plan.inject['global.fetch']).toEqual([WEB_RUNTIME_INJECT_VIRTUAL_ID, 'fetch'])
    expect(plan.inject.URL).toEqual([WEB_RUNTIME_INJECT_VIRTUAL_ID, 'URL'])
    expect(plan.inject.FormData).toEqual([WEB_RUNTIME_INJECT_VIRTUAL_ID, 'FormData'])
    expect(plan.code).toContain('setMiniProgramNetworkDefaults({"request":{"timeout":1234}})')
    expect(plan.code).toContain('import { fetch } from "weapp-vite/web-apis/runtime"')
    expect(plan.code).toContain('export { fetch,')
    expect(plan.code).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall|axiosEnv|eagerBindings/u)
  })

  it('keeps free and dotted global injection pure and respects lexical shadowing', async () => {
    const plan = createWebRuntimeNativeInject(['fetch'])!
    const code = await generateCjs(plan, `
export function run() { return fetch() }
export function globalRun() { return [globalThis.fetch, globalThis.URL, globalThis.FormData, window.fetch, self.fetch, global.fetch] }
export function shadowed() { const fetch = () => 'local'; return fetch() }
export function shadowedGlobal(globalThis) { return globalThis.fetch() }
`)
    const module = { exports: {} as Record<string, (...args: any[]) => unknown> }
    const context = { module, exports: module.exports, globalThis: {} as Record<string, unknown> }
    runInNewContext(code, context)

    expect(module.exports.run()).toBe('polyfilled fetch')
    expect(module.exports.globalRun()).toEqual([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ])
    expect(module.exports.shadowed()).toBe('local')
    expect(module.exports.shadowedGlobal({ fetch: () => 'shadowed global' })).toBe('shadowed global')
    expect(context.globalThis.__webRuntimeImportCount).toBe(1)
    expect(context.globalThis.fetch).toBeUndefined()
    expect(context.globalThis.URL).toBeUndefined()
  })

  it('installs explicit global targets idempotently without replacing host capabilities', async () => {
    const plan = createWebRuntimeNativeInject(['fetch', 'URL'])!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:fetch";
import "virtual:weapp-vite-web-runtime:global:fetch";
import "virtual:weapp-vite-web-runtime:global:URL";
export const ready = true
`)
    const hostFetch = () => 'host fetch'
    const module = { exports: {} as Record<string, unknown> }
    const hostGlobal = { fetch: hostFetch }
    runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })

    expect(hostGlobal.fetch).toBe(hostFetch)
    expect(hostGlobal.URL).toBeTypeOf('function')
    expect(hostGlobal.FormData).toBeUndefined()
  })

  it('keeps booting when a placeholder host global is frozen and cannot be written', async () => {
    const plan = createWebRuntimeNativeInject(['fetch'], undefined, undefined, ['fetch'])!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:fetch";
export const ready = true
`)
    const placeholder = { [REQUEST_GLOBAL_PLACEHOLDER_KEY]: true }
    const hostGlobal: Record<string, unknown> = {}
    Object.defineProperty(hostGlobal, 'fetch', { value: placeholder, writable: false, configurable: false })
    const module = { exports: {} as Record<string, unknown> }

    // 判定认为占位值可写，但宿主拒绝写入；try/catch 隔离后入口仍正常启动，宿主原值保留。
    expect(() => runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })).not.toThrow()
    expect(hostGlobal.fetch).toBe(placeholder)
    expect(module.exports.ready).toBe(true)
  })

  it('repairs an incomplete host Headers implementation instead of replacing it', async () => {
    const plan = createWebRuntimeNativeInject(['fetch'], undefined, undefined, ['Headers'])!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:Headers";
export const ready = true
`)
    class HostHeaders {}
    const hostGlobal = { Headers: HostHeaders } as Record<string, unknown>
    const module = { exports: {} as Record<string, unknown> }
    runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })

    expect(hostGlobal.Headers).toBe(HostHeaders)
    expect(typeof (HostHeaders.prototype as unknown as Record<string, unknown>).getSetCookie).toBe('function')
    expect(module.exports.ready).toBe(true)
  })

  it('replaces its own previous native bridge installation on the next generation', async () => {
    const plan = createWebRuntimeNativeInject(['fetch'], undefined, undefined, ['fetch'])!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:fetch";
export const ready = true
`)
    const hostGlobal: Record<string, unknown> = {}
    runInNewContext(code, { module: { exports: {} }, exports: {}, globalThis: hostGlobal })
    const firstFetch = hostGlobal.fetch
    expect((firstFetch as Record<string, unknown>)[REQUEST_GLOBAL_NATIVE_OWNER_KEY]).toBe(true)

    runInNewContext(code, { module: { exports: {} }, exports: {}, globalThis: hostGlobal })
    expect(hostGlobal.fetch).not.toBe(firstFetch)
    expect((hostGlobal.fetch as Record<string, unknown>)[REQUEST_GLOBAL_NATIVE_OWNER_KEY]).toBe(true)
  })

  it('keeps booting when reading or writing a bridged global throws', async () => {
    const plan = createWebRuntimeNativeInject(['fetch'], undefined, undefined, ['fetch'])!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:fetch";
export const ready = true
`)
    const hostGlobal: Record<string, unknown> = {}
    Object.defineProperty(hostGlobal, 'fetch', {
      configurable: true,
      get() {
        throw new Error('blocked getter')
      },
      set() {
        throw new Error('blocked setter')
      },
    })
    const module = { exports: {} as Record<string, unknown> }

    expect(() => runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })).not.toThrow()
    expect(module.exports.ready).toBe(true)
  })

  it('emits direct guarded global access without Reflect in bridge code', () => {
    const plan = createWebRuntimeNativeInject(['fetch'], undefined, undefined, ['fetch'])!
    const bridge = createWebRuntimeGlobalBridgeCode(plan, 'fetch')

    expect(bridge).not.toMatch(/Reflect\.(?:get|set)/u)
    expect(bridge).toContain('globalThis["fetch"]')
    expect(bridge).toContain('markWebRuntimeGlobalInstalled')
  })

  it('installs declared globalTargets precisely without installing unused bindings', async () => {
    const options = resolveRequestRuntimeOptions({
      appPrelude: {
        mode: 'native',
        webRuntime: { targets: ['fetch', 'XMLHttpRequest'], globalTargets: ['fetch'] },
      },
    }, { dependencies: {} })!
    const plan = createWebRuntimeNativeInject(options.targets, options.networkDefaults, undefined, options.globalTargets)!

    // 精确：globalTargets 只含声明目标及其依赖展开，不含其他启用目标（XMLHttpRequest）。
    expect(plan.globalTargets).toContain('fetch')
    expect(plan.globalTargets).not.toContain('XMLHttpRequest')
    expect(plan.bindingTargets).toContain('XMLHttpRequest')

    const code = await generateCjs(plan, `${createWebRuntimeNativeGlobalImports(plan.globalTargets)}
export const ready = true
`)
    const hostFetch = () => 'host fetch'
    const hostGlobal: Record<string, unknown> = { fetch: hostFetch }
    runInNewContext(code, { module: { exports: {} }, exports: {}, globalThis: hostGlobal })

    // 宿主已有能力优先保留；声明目标安装，未声明的 XMLHttpRequest 不写全局。
    expect(hostGlobal.fetch).toBe(hostFetch)
    expect(hostGlobal.XMLHttpRequest).toBeUndefined()
    expect(hostGlobal.__webRuntimeImportCount).toBe(1)
    expect(code).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
  })

  it('installs globalTargets declared outside the narrowed targets scope', async () => {
    const options = resolveRequestRuntimeOptions({
      appPrelude: {
        mode: 'native',
        webRuntime: { targets: ['fetch'], globalTargets: ['Request'] },
      },
    }, { dependencies: {} })!
    const plan = createWebRuntimeNativeInject(options.targets, options.networkDefaults, undefined, options.globalTargets)!

    // globalTargets 独立于 targets 绑定资格：Request 不在 targets 闭包内仍生成桥接，自由标识符资格不变。
    expect(plan.globalTargets).toContain('Request')
    expect(plan.bindingTargets).not.toContain('Request')

    const code = await generateCjs(plan, `${createWebRuntimeNativeGlobalImports(plan.globalTargets)}
export const ready = true
`)
    const hostGlobal: Record<string, unknown> = {}
    runInNewContext(code, { module: { exports: {} }, exports: {}, globalThis: hostGlobal })

    // 声明的 Request 被安装（修复前会被 targets 闭包静默丢弃）。
    expect(typeof hostGlobal.Request).toBe('function')
    expect(code).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall/u)
  })

  it('uses explicit dotted overrides before free overrides for global bridges', async () => {
    const plan = createWebRuntimeNativeInject(['fetch'], undefined, {
      'fetch': 'virtual:user-fetch',
      'globalThis.fetch': 'virtual:user-global-fetch',
    })!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:fetch";
export const read = () => fetch()
`, {
      'virtual:user-fetch': 'export default () => "free fetch"',
      'virtual:user-global-fetch': 'export default () => "global fetch"',
    })
    const module = { exports: {} as { read: () => string } }
    const hostGlobal = { fetch: () => 'host fetch' } as Record<string, unknown>
    runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })

    expect(module.exports.read()).toBe('free fetch')
    expect(hostGlobal.fetch).toBeTypeOf('function')
    expect((hostGlobal.fetch as () => string)()).toBe('global fetch')
    expect(plan.code).not.toContain('virtual:user-fetch')
  })

  it('resolves dotted overrides from every global alias with a stable precedence', async () => {
    for (const [dottedKey, label] of [
      ['window.fetch', 'window'],
      ['self.fetch', 'self'],
      ['global.fetch', 'global'],
    ] as const) {
      const plan = createWebRuntimeNativeInject(['fetch'], undefined, {
        [dottedKey]: `virtual:user-${label}-fetch`,
      })!
      const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:fetch";
export const read = () => globalThis["fetch"]()
`, {
        [`virtual:user-${label}-fetch`]: `export default () => "${label} fetch"`,
      })
      const module = { exports: {} as { read: () => string } }
      const hostGlobal = {} as Record<string, unknown>
      runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })

      expect(module.exports.read()).toBe(`${label} fetch`)
      expect((hostGlobal.fetch as () => string)()).toBe(`${label} fetch`)
    }

    const plan = createWebRuntimeNativeInject(['fetch'], undefined, {
      'window.fetch': 'virtual:user-window-fetch',
      'globalThis.fetch': 'virtual:user-global-fetch',
    })!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:fetch";
export const read = () => globalThis["fetch"]()
`, {
      'virtual:user-window-fetch': 'export default () => "window fetch"',
      'virtual:user-global-fetch': 'export default () => "global fetch"',
    })
    const module = { exports: {} as { read: () => string } }
    const hostGlobal = {} as Record<string, unknown>
    runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })

    expect(module.exports.read()).toBe('global fetch')
  })

  it('preserves a usable host TextDecoderStream through the bridge', async () => {
    const plan = createWebRuntimeNativeInject(['TextDecoderStream'])!
    const code = await generateCjs(plan, `
import "virtual:weapp-vite-web-runtime:global:TextDecoderStream";
export const read = () => globalThis["TextDecoderStream"]
`)
    class HostTextDecoderStream {
      readable = {
        getReader() {
          return {}
        },
      }

      writable = {
        getWriter() {
          return {}
        },
      }
    }
    const module = { exports: {} as { read: () => unknown } }
    const hostGlobal = { TextDecoderStream: HostTextDecoderStream } as Record<string, unknown>
    runInNewContext(code, { module, exports: module.exports, globalThis: hostGlobal })

    expect(module.exports.read()).toBe(HostTextDecoderStream)
  })

  it('propagates free overrides to dotted inject keys unless explicitly overridden', () => {
    const plan = createWebRuntimeNativeInject(['fetch'])!
    expect(mergeWebRuntimeNativeInject(plan.inject, {
      fetch: ['virtual:user-fetch', 'default'],
      userGlobal: 'virtual:unrelated-user-global',
    })).toMatchObject({
      'fetch': ['virtual:user-fetch', 'default'],
      'globalThis.fetch': ['virtual:user-fetch', 'default'],
      'window.fetch': ['virtual:user-fetch', 'default'],
      'self.fetch': ['virtual:user-fetch', 'default'],
      'global.fetch': ['virtual:user-fetch', 'default'],
      'userGlobal': 'virtual:unrelated-user-global',
    })
    expect(mergeWebRuntimeNativeInject(plan.inject, {
      'fetch': ['virtual:user-fetch', 'default'],
      'globalThis.fetch': ['virtual:explicit-global-fetch', 'default'],
    })).toMatchObject({
      'fetch': ['virtual:user-fetch', 'default'],
      'globalThis.fetch': ['virtual:explicit-global-fetch', 'default'],
      'window.fetch': ['virtual:user-fetch', 'default'],
    })
  })

  it('emits stable per-target bridge ids and imports', () => {
    expect(getWebRuntimeGlobalVirtualId('fetch')).toBe('virtual:weapp-vite-web-runtime:global:fetch')
    expect(getWebRuntimeGlobalResolvedId('fetch')).toBe('weapp-vite:web-runtime:global:fetch')
    expect(resolveWebRuntimeGlobalTarget(`${WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX}fetch`)).toBe('fetch')
    expect(createWebRuntimeNativeGlobalImports(['fetch', 'URL', 'fetch'])).toBe([
      'import "virtual:weapp-vite-web-runtime:global:fetch";',
      'import "virtual:weapp-vite-web-runtime:global:URL";',
    ].join('\n'))
  })

  it('shares one bundler-owned binding module across dynamic chunks', async () => {
    const plan = createWebRuntimeNativeInject(['fetch'])!
    const bundle = await rolldown({
      input: 'virtual:entry',
      plugins: [createNativeInjectPlugin(plan, {
        'virtual:entry': `export const read = () => fetch(); export const load = () => import('./lazy.js')`,
        './lazy.js': `export const read = () => fetch()`,
        'virtual:runtime': runtimeSource,
      })],
      transform: { inject: plan.inject },
    })
    const generated = await bundle.generate({
      format: 'esm',
      chunkFileNames: 'chunks/[name].js',
      entryFileNames: 'entry.js',
    })
    await bundle.close()

    const chunks = generated.output.filter((output): output is Extract<typeof output, { type: 'chunk' }> => output.type === 'chunk')
    const entry = chunks.find(chunk => chunk.isEntry)
    const lazy = chunks.find(chunk => chunk.moduleIds.includes('./lazy.js'))
    const shared = chunks.find(chunk => chunk.moduleIds.includes(WEB_RUNTIME_INJECT_RESOLVED_ID))
    expect(entry).toBeDefined()
    expect(lazy).toBeDefined()
    expect(shared).toBeDefined()
    expect(entry!.imports).toContain(shared!.fileName)
    expect(lazy!.imports).toContain(shared!.fileName)
  })

  it('boots the published WebRuntime through precise imports without first-party runtime injection cycles', async () => {
    const plan = createWebRuntimeNativeInject([...WEB_RUNTIME_GLOBAL_TARGETS])!
    const publishedRuntimeEntry = fileURLToPath(import.meta.resolve('@wevu/web-apis/runtime'))
    const publishedRuntimeRoot = path.dirname(publishedRuntimeEntry)
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'weapp-native-runtime-'))
    const runtimeRoot = path.join(temporaryRoot, 'runtime')
    let bundle: Awaited<ReturnType<typeof rolldown>> | undefined
    try {
      // 隔离快照的深层绝对路径会触发 Rolldown 注入解析的 Windows 路径边界；
      // 复制真实 published dist 到短路径，仍验证同一发布产物及其相对依赖图。
      await cp(publishedRuntimeRoot, runtimeRoot, { recursive: true })
      const runtimeEntry = path.join(runtimeRoot, path.basename(publishedRuntimeEntry))
      bundle = await rolldown({
        input: 'virtual:entry',
        plugins: [{
          name: 'test-published-web-runtime',
          resolveId(id) {
            if (id === WEB_RUNTIME_INJECT_VIRTUAL_ID) {
              return { id: WEB_RUNTIME_INJECT_RESOLVED_ID, moduleSideEffects: true }
            }
            if ([
              'weapp-vite/web-apis/runtime',
              '@wevu/web-apis/runtime',
              '@wevu/api',
              '@weapp-core/api',
              '@weapp-core/constants',
              '@weapp-core/shared/platforms/runtime',
              '@weapp-core/shared/platforms/runtime/global-keys',
              'web-streams-polyfill',
            ].includes(id)) {
              return {
                id: id === 'weapp-vite/web-apis/runtime' || id === '@wevu/web-apis/runtime'
                  ? runtimeEntry
                  : fileURLToPath(import.meta.resolve(id)),
                moduleSideEffects: true,
              }
            }
            return id === 'virtual:entry' ? { id, moduleSideEffects: true } : null
          },
          load(id) {
            if (id === WEB_RUNTIME_INJECT_RESOLVED_ID) {
              return { code: plan.code, moduleSideEffects: true }
            }
            if (id === 'virtual:entry') {
              return {
                code: `export function probe() {
  return [typeof fetch, new URL('https://example.com').href, typeof FormData, typeof XMLHttpRequest, typeof WebSocket]
}`,
                moduleSideEffects: true,
              }
            }
            return null
          },
        }],
        transform: { inject: plan.inject },
      })
      const generated = await bundle.generate({ format: 'cjs', codeSplitting: false })
      const preserved = await bundle.generate({ format: 'esm', preserveModules: true })

      const output = generated.output.find(chunk => chunk.type === 'chunk' && chunk.isEntry)
      expect(output?.type).toBe('chunk')
      if (!output || output.type !== 'chunk') {
        throw new Error('missing entry chunk')
      }

      const module = { exports: {} as Record<string, () => unknown> }
      runInNewContext(output.code, { module, exports: module.exports, console, globalThis: {} })
      expect(module.exports.probe()).toEqual([
        'function',
        'https://example.com/',
        'function',
        'function',
        'function',
      ])

      const chunks = preserved.output.filter((chunk): chunk is Extract<typeof chunk, { type: 'chunk' }> => chunk.type === 'chunk')
      const binding = chunks.find(chunk => chunk.moduleIds.includes(WEB_RUNTIME_INJECT_RESOLVED_ID))
      const runtimeRootPrefix = runtimeRoot.replace(/\\/gu, '/')
      const runtimeChunks = chunks.filter(chunk => chunk.moduleIds.some(moduleId => moduleId.replace(/\\/gu, '/').startsWith(runtimeRootPrefix)))
      expect(runtimeChunks.length).toBeGreaterThan(0)
      if (binding) {
        for (const chunk of runtimeChunks) {
          expect(chunk.imports, `${chunk.fileName} must not import the native binding module back`).not.toContain(binding.fileName)
        }
      }
    }
    finally {
      try {
        await bundle?.close()
      }
      finally {
        await rm(temporaryRoot, { recursive: true, force: true })
      }
    }
  })

  it('does not create an inject plan without targets', () => {
    expect(createWebRuntimeNativeInject([])).toBeNull()
  })
})

describe('native WebRuntime module ownership', () => {
  const matcher = createNativeWebRuntimeModuleMatcher({
    resolveImplementationRoot: () => '/repo/packages-runtime/web-apis',
    platform: 'linux',
  })

  it('matches virtual ids and files under the resolved implementation package root', () => {
    expect(matcher(WEB_RUNTIME_INJECT_VIRTUAL_ID)).toBe(true)
    expect(matcher(getWebRuntimeGlobalResolvedId('fetch'))).toBe(true)
    expect(matcher('/repo/packages-runtime/web-apis/src/fetch.ts')).toBe(true)
  })

  it('does not adopt lookalike directories or a differently rooted package', () => {
    expect(matcher('/repo/packages-runtime/web-apis-copy/src/fetch.ts')).toBe(false)
    expect(matcher('/repo/node_modules/@wevu/web-apis/dist/runtime.mjs')).toBe(false)
    expect(matcher('/repo/src/pages/home/index.ts')).toBe(false)
  })

  it('folds Windows separators and path case', () => {
    const windows = createNativeWebRuntimeModuleMatcher({
      resolveImplementationRoot: () => 'C:/repo/packages-runtime/web-apis',
      platform: 'win32',
    })
    expect(windows('c:\\REPO\\packages-runtime\\web-apis\\src\\fetch.ts')).toBe(true)
    expect(windows('C:/repo/packages-runtime/web-apis-2/src/fetch.ts')).toBe(false)
  })

  it('prefers the bundler-resolved implementation root over Node resolution', () => {
    // alias/自定义 resolver 下模块图 id 来自打包器解析；matcher 必须用同一基准，否则漏收实现模块。
    let bundlerRoot: string | undefined
    const bundlerMatcher = createNativeWebRuntimeModuleMatcher({
      platform: 'linux',
      resolveImplementationRoot: () => bundlerRoot,
    })
    bundlerRoot = '/alias-root/packages-runtime/web-apis'
    expect(bundlerMatcher('/alias-root/packages-runtime/web-apis/src/fetch.ts')).toBe(true)
    expect(bundlerMatcher('/alias-root/packages-runtime/web-apis-copy/src/fetch.ts')).toBe(false)
  })

  it('keeps implementation roots isolated between concurrent build matchers', () => {
    let firstRoot: string | undefined
    let secondRoot: string | undefined
    const first = createNativeWebRuntimeModuleMatcher({
      platform: 'linux',
      resolveImplementationRoot: () => firstRoot,
    })
    const second = createNativeWebRuntimeModuleMatcher({
      platform: 'linux',
      resolveImplementationRoot: () => secondRoot,
    })
    firstRoot = '/first/packages-runtime/web-apis'
    secondRoot = '/second/packages-runtime/web-apis'

    expect(first('/first/packages-runtime/web-apis/src/fetch.ts')).toBe(true)
    expect(first('/second/packages-runtime/web-apis/src/fetch.ts')).toBe(false)
    expect(second('/second/packages-runtime/web-apis/src/fetch.ts')).toBe(true)
    expect(second('/first/packages-runtime/web-apis/src/fetch.ts')).toBe(false)
  })
})

describe('native declared global targets', () => {
  it('accepts dependency-expanded targets declared explicitly', () => {
    const plan = createWebRuntimeNativeInject(['fetch'], undefined, undefined, ['URL'])
    expect(plan).not.toBeNull()
    expect(plan!.globalTargets).toContain('URL')
  })
})
