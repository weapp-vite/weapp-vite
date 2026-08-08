import type { RuntimeProviderDescriptorContract } from './runtimeProviders'
import { describe, expect, expectTypeOf, it } from 'vitest'

describe('runtime provider contracts', () => {
  it('describes backend, compilation, variants and capabilities', () => {
    const descriptor = {
      id: 'wevu-miniprogram',
      backend: 'miniprogram',
      compilation: 'vue',
      injection: 'virtual-module',
      entries: {
        runtime: {
          development: 'wevu/internal-runtime',
          production: 'wevu/internal-runtime',
        },
      },
      capabilities: {
        framework: true,
        hmr: true,
        nativeHost: true,
        webHost: false,
      },
      hmr: {
        mode: 'host-reload',
      },
      contractVersion: 1,
    } as const satisfies RuntimeProviderDescriptorContract

    expect(descriptor.entries.runtime.development).toBe('wevu/internal-runtime')
    expect(descriptor.capabilities.framework).toBe(true)
    expectTypeOf(descriptor).toMatchTypeOf<RuntimeProviderDescriptorContract>()
  })
})
