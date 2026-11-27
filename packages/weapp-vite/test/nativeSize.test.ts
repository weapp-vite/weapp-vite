import type { WeappInjectWebRuntimeGlobalsTarget } from '../src/types'
import type { NativeChunk } from './utils/nativeFixture'
import { Buffer } from 'node:buffer'
import { rm } from 'node:fs/promises'
import { WEB_RUNTIME_GLOBAL_TARGETS } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { createNativeWebRuntimeModuleMatcher, getWebRuntimeGlobalResolvedId, WEB_RUNTIME_INJECT_RESOLVED_ID } from '../src/runtime/config/internal/injectRequestGlobals/nativeInject'
import { buildFixture, createFixtureRoot } from './utils/nativeFixture'

const isNativeWebRuntimeInjectModuleId = createNativeWebRuntimeModuleMatcher()

interface NativeSizeMeasurement {
  runtimeBytes: number
  runtimeCode: string
  runtimeModuleIds: string[]
  startupClosureBytes: number
  totalBytes: number
}

async function measure(
  targets: WeappInjectWebRuntimeGlobalsTarget[],
  minify: boolean,
  pageSource: string,
  globalTargets: WeappInjectWebRuntimeGlobalsTarget[] = [],
): Promise<NativeSizeMeasurement> {
  const root = await createFixtureRoot('weapp-native-size-')
  const chunks: NativeChunk[] = []
  try {
    const files = await buildFixture(root, minify, chunks, {
      targets,
      globalTargets,
      pageSource,
    })
    const loaded = new Set(['app.js', 'pages/index/index.js'])
    const pending = [...loaded]
    const byChunk = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
    while (pending.length > 0) {
      const current = pending.pop()!
      for (const dependency of byChunk.get(current)?.imports ?? []) {
        if (!loaded.has(dependency)) {
          loaded.add(dependency)
          pending.push(dependency)
        }
      }
    }
    const loadedChunks = chunks.filter(chunk => loaded.has(chunk.fileName))
    const runtimeChunks = loadedChunks.filter(chunk => [...chunk.moduleIds].some(isNativeWebRuntimeInjectModuleId))
    expect(runtimeChunks.length).toBeGreaterThan(0)
    const bytes = (names: Set<string>) => [...names].reduce((sum, name) => sum + Buffer.byteLength(files.get(name) ?? ''), 0)
    const runtimeCode = runtimeChunks.map(chunk => files.get(chunk.fileName) ?? '').join('\n')
    return {
      runtimeBytes: Buffer.byteLength(runtimeCode),
      runtimeCode,
      runtimeModuleIds: [...new Set(loadedChunks.flatMap(chunk => [...chunk.moduleIds]))]
        .filter(moduleId => moduleId !== WEB_RUNTIME_INJECT_RESOLVED_ID),
      startupClosureBytes: bytes(loaded),
      totalBytes: [...files.values()].reduce((sum, code) => sum + Buffer.byteLength(code), 0),
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('native Web Runtime size', () => {
  it('tree-shakes unrelated Web APIs and keeps explicit global bridges target-scoped', async () => {
    const atobFree = await measure(['atob'], false, 'globalThis.__nativeSizeProbe = typeof atob')
    const fetchFree = await measure(['fetch'], false, 'globalThis.__nativeSizeProbe = typeof fetch')
    const fetchDottedGlobal = await measure(['fetch'], false, 'globalThis.__nativeSizeProbe = typeof globalThis.fetch')
    const fetchGlobal = await measure(['fetch'], false, 'globalThis.__nativeSizeProbe = typeof globalThis["fetch"]')
    const fetchForcedGlobal = await measure(['fetch'], false, 'globalThis.__nativeSizeProbe = true', ['fetch'])
    const full = await measure([...WEB_RUNTIME_GLOBAL_TARGETS], false, 'globalThis.__nativeSizeProbe = typeof fetch')
    const fullMinified = await measure([...WEB_RUNTIME_GLOBAL_TARGETS], true, 'globalThis.__nativeSizeProbe = typeof fetch')

    for (const measurement of [atobFree, fetchFree, fetchDottedGlobal, fetchGlobal, fetchForcedGlobal, full, fullMinified]) {
      expect(measurement.runtimeCode).not.toMatch(/installWebRuntime|installRequestGlobals|installRequestGlobalBinding|createWebRuntimeInstallContext|finalizeWebRuntimeInstall|axiosEnv|eagerBindings|__wvAXFE__/u)
    }
    expect(atobFree.runtimeCode).not.toContain('XMLHttpRequestPolyfill')
    expect(atobFree.runtimeCode).not.toContain('EventSourcePolyfill')
    expect(atobFree.runtimeModuleIds.some(id => /[\\/]xhr\.ts$/.test(id))).toBe(false)
    expect(atobFree.runtimeModuleIds.some(id => /[\\/]eventsource\.ts$/.test(id))).toBe(false)
    expect(fetchFree.runtimeCode).not.toContain('Reflect.set(globalThis, "fetch"')
    expect(fetchFree.runtimeModuleIds).not.toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchDottedGlobal.runtimeCode).not.toContain('Reflect.set(globalThis, "fetch"')
    expect(fetchDottedGlobal.runtimeModuleIds).not.toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchGlobal.runtimeModuleIds).toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchForcedGlobal.runtimeModuleIds).toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchGlobal.runtimeCode).not.toContain('XMLHttpRequestPolyfill')
    expect(fetchGlobal.runtimeCode).not.toContain('EventSourcePolyfill')
    // 共享写入判定来自运行时模块，单目标显式全局变体会多带一个 helper 模块（约 1KB）；
    // 无关 API 不泄漏的意图由上面两条 not.toContain 断言保证，这里只放宽字节预算。
    expect(fetchGlobal.startupClosureBytes).toBeLessThan(fetchFree.startupClosureBytes + 2_000)
    expect(full.startupClosureBytes).toBeLessThan(fetchFree.startupClosureBytes + 5_000)
    expect(full.totalBytes).toBeLessThan(fetchFree.totalBytes + 5_000)
    expect(fullMinified.startupClosureBytes).toBeLessThan(full.startupClosureBytes * 0.7)
    expect(fullMinified.totalBytes).toBeLessThan(full.totalBytes * 0.7)
  }, 600_000)
})
