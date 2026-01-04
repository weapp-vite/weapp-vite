import { describe, expect, it, vi } from 'vitest'
import { autoImport } from './autoImport'

describe('autoImport plugin', () => {
  it('bootstraps outputs without globs', async () => {
    const reset = vi.fn()
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)

    const ctx = {
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        weappViteConfig: {
          autoImportComponents: {
            resolvers: [{}],
            typedComponents: true,
            vueComponents: true,
          },
        },
      },
      autoImportService: {
        reset,
        awaitManifestWrites,
        filter: () => false,
        registerPotentialComponent: vi.fn(),
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    const plugin = autoImport(ctx)[0]
    plugin.configResolved?.({ build: { outDir: 'dist' } } as any)

    await plugin.buildStart?.()
    expect(reset).toHaveBeenCalledTimes(1)

    await plugin.closeBundle?.()
    expect(awaitManifestWrites).toHaveBeenCalledTimes(1)
  })

  it('does not bootstrap when nothing is enabled and no globs', async () => {
    const reset = vi.fn()
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)

    const ctx = {
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        weappViteConfig: {
          autoImportComponents: {
            output: false,
            typedComponents: false,
            htmlCustomData: false,
            vueComponents: false,
          },
        },
      },
      autoImportService: {
        reset,
        awaitManifestWrites,
        filter: () => false,
        registerPotentialComponent: vi.fn(),
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    const plugin = autoImport(ctx)[0]
    plugin.configResolved?.({ build: { outDir: 'dist' } } as any)

    await plugin.buildStart?.()
    expect(reset).not.toHaveBeenCalled()
  })
})
