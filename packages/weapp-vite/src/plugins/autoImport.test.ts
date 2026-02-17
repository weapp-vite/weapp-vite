import fs from 'fs-extra'
import path from 'pathe'
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

  it('initial scan should include .vue files when globs point to components/**/*.vue', async () => {
    const tempRoot = path.resolve(import.meta.dirname, '../test/__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-plugin-'))
    const srcRoot = path.join(tempDir, 'src')
    const vueFile = path.join(srcRoot, 'components/SfcAuto/index.vue')
    await fs.ensureDir(path.dirname(vueFile))
    await fs.writeFile(vueFile, '<template><view>auto</view></template>', 'utf8')

    const reset = vi.fn()
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)

    const ctx = {
      configService: {
        cwd: tempDir,
        absoluteSrcRoot: srcRoot,
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue'],
          },
        },
      },
      autoImportService: {
        reset,
        awaitManifestWrites,
        filter: () => true,
        registerPotentialComponent,
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    try {
      const plugin = autoImport(ctx)[0]
      plugin.configResolved?.({ build: { outDir: 'dist' } } as any)

      await plugin.buildStart?.()

      expect(reset).toHaveBeenCalledTimes(1)
      expect(registerPotentialComponent).toHaveBeenCalledWith(vueFile)
    }
    finally {
      await fs.remove(tempDir)
      if (await fs.pathExists(tempRoot)) {
        const remaining = await fs.readdir(tempRoot)
        if (remaining.length === 0) {
          await fs.remove(tempRoot)
        }
      }
    }
  })

  it('registers watch targets for auto import globs during build start', async () => {
    const addWatchFile = vi.fn()
    const reset = vi.fn()
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)

    const ctx = {
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue', 'packages/order/components/**/*.wxml'],
          },
        },
      },
      autoImportService: {
        reset,
        awaitManifestWrites,
        filter: () => true,
        registerPotentialComponent,
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    const plugin = autoImport(ctx)[0]
    plugin.configResolved?.({ build: { outDir: 'dist' } } as any)
    await plugin.buildStart?.call({ addWatchFile } as any)

    expect(addWatchFile).toHaveBeenCalledWith('/project/src')
    expect(addWatchFile).toHaveBeenCalledWith('/project/src/components')
    expect(addWatchFile).toHaveBeenCalledWith('/project/src/packages/order/components')
  })

  it('rescans globs on repeated dev buildStart to include newly created components', async () => {
    const tempRoot = path.resolve(import.meta.dirname, '../test/__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-dev-rescan-'))
    const srcRoot = path.join(tempDir, 'src')
    const firstComponent = path.join(srcRoot, 'components/FirstCard/index.vue')
    const secondComponent = path.join(srcRoot, 'components/SecondCard/index.vue')

    await fs.ensureDir(path.dirname(firstComponent))
    await fs.writeFile(firstComponent, '<template><view>first</view></template>', 'utf8')

    const reset = vi.fn()
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)

    const ctx = {
      configService: {
        cwd: tempDir,
        absoluteSrcRoot: srcRoot,
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        isDev: true,
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue'],
          },
        },
      },
      autoImportService: {
        reset,
        awaitManifestWrites,
        filter: () => true,
        registerPotentialComponent,
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    try {
      const plugin = autoImport(ctx)[0]
      plugin.configResolved?.({ build: { outDir: 'dist' } } as any)

      await plugin.buildStart?.()
      expect(registerPotentialComponent).toHaveBeenCalledWith(firstComponent)

      await fs.ensureDir(path.dirname(secondComponent))
      await fs.writeFile(secondComponent, '<template><view>second</view></template>', 'utf8')

      await plugin.buildStart?.()
      expect(registerPotentialComponent).toHaveBeenCalledWith(secondComponent)
    }
    finally {
      await fs.remove(tempDir)
      if (await fs.pathExists(tempRoot)) {
        const remaining = await fs.readdir(tempRoot)
        if (remaining.length === 0) {
          await fs.remove(tempRoot)
        }
      }
    }
  })
})
