import type { Plugin } from 'vite'
import type { RuntimeProvider } from './types'
import { WEAPP_VITE_RUNTIME_CONTRACT_VERSION, WEAPP_VITE_RUNTIME_VIRTUAL_ID } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import {
  createRuntimeProviderPlugin,
  nativeMiniprogramRuntimeProvider,
  resolveRuntimeProviderEntry,
  resolveRuntimeProviderHmrFooter,
  webRuntimeProvider,
  wevuMiniprogramRuntimeProvider,
} from '.'

describe('runtime provider plugin', () => {
  it('resolves the selected development entry through Vite', async () => {
    const plugin = createRuntimeProviderPlugin(wevuMiniprogramRuntimeProvider, 'development') as Plugin
    const resolve = vi.fn(async () => ({ id: '/resolved/wevu/internal-runtime.mjs' }))

    await expect((plugin.resolveId as any).call(
      { resolve },
      WEAPP_VITE_RUNTIME_VIRTUAL_ID,
      '/project/src/app.vue',
    )).resolves.toEqual({ id: '/resolved/wevu/internal-runtime.mjs' })
    expect(resolve).toHaveBeenCalledWith('wevu/internal-runtime', '/project/src/app.vue', { skipSelf: true })
  })

  it('reports missing entries without falling back to another runtime', async () => {
    const plugin = createRuntimeProviderPlugin(wevuMiniprogramRuntimeProvider, 'production') as Plugin

    await expect((plugin.resolveId as any).call(
      { resolve: vi.fn(async () => null) },
      WEAPP_VITE_RUNTIME_VIRTUAL_ID,
      '/project/src/app.vue',
    )).rejects.toThrow('运行时 provider "wevu-miniprogram" 无法解析 production runtime 入口 "wevu/internal-runtime"。')
  })

  it('selects development and production entries without compiler-specific paths', async () => {
    const provider: RuntimeProvider = {
      descriptor: {
        ...wevuMiniprogramRuntimeProvider.descriptor,
        id: 'variant-provider',
        entries: {
          runtime: {
            development: 'runtime/development',
            production: 'runtime/production',
          },
        },
      },
    }
    const resolve = vi.fn(async (id: string) => ({ id: `/resolved/${id}` }))

    for (const variant of ['development', 'production'] as const) {
      const plugin = createRuntimeProviderPlugin(provider, variant) as Plugin
      await expect((plugin.resolveId as any).call(
        { resolve },
        WEAPP_VITE_RUNTIME_VIRTUAL_ID,
        '/project/src/app.vue',
      )).resolves.toEqual({ id: `/resolved/runtime/${variant}` })
    }
  })

  it('resolves the web runtime and delegates its HMR footer to the provider', async () => {
    const plugin = createRuntimeProviderPlugin(webRuntimeProvider, 'production') as Plugin
    const resolve = vi.fn(async () => ({ id: '/resolved/web-runtime.mjs' }))

    await expect((plugin.resolveId as any).call(
      { resolve },
      WEAPP_VITE_RUNTIME_VIRTUAL_ID,
      '/project/src/app.js',
    )).resolves.toEqual({ id: '/resolved/web-runtime.mjs' })
    expect(resolve).toHaveBeenCalledWith(
      expect.stringMatching(/packages-runtime[\\/]web[\\/]dist[\\/]runtime[\\/]index\.mjs$/),
      '/project/src/app.js',
      { skipSelf: true },
    )
    expect(resolveRuntimeProviderHmrFooter(webRuntimeProvider))
      .toBe('if (import.meta.hot) { import.meta.hot.accept() }')
    expect(resolveRuntimeProviderHmrFooter(wevuMiniprogramRuntimeProvider)).toBeUndefined()
  })

  it('reports provider entry location failures before Vite resolution', async () => {
    const provider: RuntimeProvider = {
      ...webRuntimeProvider,
      descriptor: {
        ...webRuntimeProvider.descriptor,
        id: 'broken-web-runtime',
      },
      resolveModuleId() {
        throw new Error('package exports unavailable')
      },
    }
    const plugin = createRuntimeProviderPlugin(provider, 'production') as Plugin

    await expect((plugin.resolveId as any).call(
      { resolve: vi.fn() },
      WEAPP_VITE_RUNTIME_VIRTUAL_ID,
      '/project/src/app.js',
    )).rejects.toThrow(
      '运行时 provider "broken-web-runtime" 无法定位 production runtime 入口 "@weapp-vite/web/runtime"。',
    )
  })

  it('rejects native framework injection and contract version mismatches', () => {
    expect(() => resolveRuntimeProviderEntry(nativeMiniprogramRuntimeProvider, 'runtime', 'production'))
      .toThrow('运行时 provider "native-miniprogram" 不允许注入框架运行时。')

    const incompatible: RuntimeProvider = {
      descriptor: {
        ...wevuMiniprogramRuntimeProvider.descriptor,
        id: 'incompatible',
        contractVersion: WEAPP_VITE_RUNTIME_CONTRACT_VERSION + 1,
      },
    }
    expect(() => resolveRuntimeProviderEntry(incompatible, 'runtime', 'production'))
      .toThrow('运行时 provider "incompatible" 的 contract version 为 2，当前编译器要求 1。')
  })
})
