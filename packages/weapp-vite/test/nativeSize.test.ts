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
    const performanceFree = await measure(['performance'], false, 'globalThis.__nativeSizeProbe = typeof performance')
    const performanceForcedGlobal = await measure(['performance'], false, 'globalThis.__nativeSizeProbe = true', ['performance'])
    const full = await measure([...WEB_RUNTIME_GLOBAL_TARGETS], false, 'globalThis.__nativeSizeProbe = typeof fetch')
    const fullMinified = await measure([...WEB_RUNTIME_GLOBAL_TARGETS], true, 'globalThis.__nativeSizeProbe = typeof fetch')

    for (const measurement of [atobFree, fetchFree, fetchDottedGlobal, fetchGlobal, fetchForcedGlobal, performanceFree, performanceForcedGlobal, full, fullMinified]) {
      expect(measurement.runtimeCode).not.toMatch(/installWebRuntime|installRequestGlobals|installRequestGlobalBinding|createWebRuntimeInstallContext|finalizeWebRuntimeInstall|axiosEnv|eagerBindings|__wvAXFE__/u)
    }
    expect(atobFree.runtimeCode).not.toContain('XMLHttpRequestPolyfill')
    expect(atobFree.runtimeCode).not.toContain('EventSourcePolyfill')
    expect(atobFree.runtimeModuleIds.some(id => /[\\/]xhr\.ts$/.test(id))).toBe(false)
    expect(atobFree.runtimeModuleIds.some(id => /[\\/]eventsource\.ts$/.test(id))).toBe(false)
    expect(fetchFree.runtimeCode).not.toContain('globalThis["fetch"] =')
    expect(fetchFree.runtimeModuleIds).not.toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchDottedGlobal.runtimeCode).not.toContain('globalThis["fetch"] =')
    expect(fetchDottedGlobal.runtimeModuleIds).not.toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchGlobal.runtimeModuleIds).toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchForcedGlobal.runtimeModuleIds).toContain(getWebRuntimeGlobalResolvedId('fetch'))
    expect(fetchGlobal.runtimeCode).not.toContain('XMLHttpRequestPolyfill')
    expect(fetchGlobal.runtimeCode).not.toContain('EventSourcePolyfill')
    expect(performanceForcedGlobal.runtimeModuleIds).toContain(getWebRuntimeGlobalResolvedId('performance'))
    expect(performanceForcedGlobal.runtimeCode).not.toContain('getSetCookie')
    expect(performanceForcedGlobal.runtimeCode).not.toContain('ResponsePolyfill')
    expect(performanceForcedGlobal.runtimeCode).not.toContain('XMLHttpRequestPolyfill')
    expect(performanceForcedGlobal.runtimeCode).not.toContain('Reflect.get')
    // 显式全局桥接只在同目标纯绑定基础上增加安装、能力修补与 HMR 所有权逻辑。
    expect(performanceForcedGlobal.startupClosureBytes).toBeLessThan(performanceFree.startupClosureBytes + 3_000)
    expect(full.startupClosureBytes).toBeLessThan(fetchFree.startupClosureBytes + 5_000)
    expect(full.totalBytes).toBeLessThan(fetchFree.totalBytes + 5_000)
    expect(fullMinified.startupClosureBytes).toBeLessThan(full.startupClosureBytes * 0.7)
    expect(fullMinified.totalBytes).toBeLessThan(full.totalBytes * 0.7)
  }, 600_000)
})
