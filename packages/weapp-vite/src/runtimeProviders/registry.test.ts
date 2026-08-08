import type { RuntimeProvider } from './types'
import { WEAPP_VITE_RUNTIME_CONTRACT_VERSION } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { resolveRuntimeProvider, runtimeProviderRegistry, RuntimeProviderRegistry } from '.'

function createProvider(id: string, compilation: 'native' | 'vue'): RuntimeProvider {
  return {
    descriptor: {
      id,
      backend: 'miniprogram',
      compilation,
      injection: 'none',
      entries: {},
      capabilities: {
        framework: false,
        hmr: false,
        nativeHost: true,
        webHost: false,
      },
      hmr: { mode: 'none' },
      contractVersion: WEAPP_VITE_RUNTIME_CONTRACT_VERSION,
    },
  }
}

describe('runtime provider registry', () => {
  it('rejects duplicate ids and backend compilation selections', () => {
    const registry = new RuntimeProviderRegistry()
    registry.register(createProvider('native', 'native'))

    expect(() => registry.register(createProvider('native', 'vue'))).toThrow('运行时 provider id "native" 已注册。')
    expect(() => registry.register(createProvider('other', 'native'))).toThrow('运行时 provider 选择 "miniprogram:native" 已由 "native" 注册。')
  })

  it('selects native, wevu and web providers declaratively', () => {
    expect(resolveRuntimeProvider('miniprogram', 'native').descriptor.id).toBe('native-miniprogram')
    expect(resolveRuntimeProvider('miniprogram', 'vue').descriptor.id).toBe('wevu-miniprogram')
    expect(resolveRuntimeProvider('web', 'web').descriptor.id).toBe('web-runtime')
    expect(runtimeProviderRegistry.getAll().map(provider => provider.descriptor.id)).toEqual([
      'native-miniprogram',
      'wevu-miniprogram',
      'web-runtime',
    ])
  })

  it('fails instead of silently selecting a different runtime', () => {
    expect(() => resolveRuntimeProvider('web', 'vue')).toThrow('没有可用于 web/vue 的运行时 provider。')
  })
})
