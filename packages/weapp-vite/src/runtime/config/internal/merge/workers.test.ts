import { describe, expect, it, vi } from 'vitest'
import {
  mergeWorkers,
  resolveWorkersBuildDefaults,
} from './workers'

vi.mock('../../../../plugins', () => ({
  vitePluginWeappWorkers: vi.fn(() => [{
    name: 'weapp-worker-plugin',
  }]),
}))

describe('runtime config merge workers', () => {
  it('resolves worker build defaults by mode', () => {
    expect(resolveWorkersBuildDefaults(true)).toEqual({
      watch: {},
      minify: false,
      emptyOutDir: false,
    })
    expect(resolveWorkersBuildDefaults(false)).toEqual({
      emptyOutDir: false,
    })
  })

  it('injects weapp-vite host metadata for development worker builds', () => {
    const applyRuntimePlatform = vi.fn()
    const injectBuiltinAliases = vi.fn()

    const result = mergeWorkers({
      ctx: {} as any,
      isDev: true,
      config: {} as any,
      cwd: '/project',
      injectBuiltinAliases,
      getDefineImportMetaEnv: () => ({
        'import.meta.env.RUNTIME': '"worker"',
      }),
      applyRuntimePlatform,
    })

    expect(applyRuntimePlatform).toHaveBeenCalledWith('miniprogram')
    expect(result.weappVite).toEqual({
      name: 'weapp-vite',
      runtime: 'miniprogram',
    })
    expect(result.plugins).toEqual([
      [{ name: 'weapp-worker-plugin' }],
    ])
    expect(injectBuiltinAliases).toHaveBeenCalledWith(result)
  })

  it('injects weapp-vite host metadata for production worker builds', () => {
    const result = mergeWorkers({
      ctx: {} as any,
      isDev: false,
      config: {} as any,
      cwd: '/project',
      injectBuiltinAliases: vi.fn(),
      getDefineImportMetaEnv: () => ({}),
      applyRuntimePlatform: vi.fn(),
    })

    expect(result.weappVite).toEqual({
      name: 'weapp-vite',
      runtime: 'miniprogram',
    })
    expect(result.logLevel).toBe('info')
  })
})
