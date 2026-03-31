// eslint-disable-next-line e18e/ban-dependencies
import fs from 'fs-extra'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { autoImport } from './autoImport'

const chokidarWatchMock = vi.hoisted(() => vi.fn())

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarWatchMock,
  },
}))

describe('autoImport plugin', () => {
  function createMockSidecarWatcher() {
    const listeners = new Map<string, (filePath: string) => void>()
    const watcher = {
      on: vi.fn((event: string, handler: (filePath: string) => void) => {
        listeners.set(event, handler)
        return watcher
      }),
      close: vi.fn(),
      emit(event: 'add' | 'unlink', filePath: string) {
        listeners.get(event)?.(filePath)
      },
    }

    return watcher
  }

  beforeEach(() => {
    chokidarWatchMock.mockReset()
    chokidarWatchMock.mockReturnValue(createMockSidecarWatcher())
  })

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

  it('bootstraps generated outputs when auto import is enabled with boolean true', async () => {
    const reset = vi.fn()
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)

    const ctx = {
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        weappViteConfig: {
          autoImportComponents: true,
        },
        packageJson: {},
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

  it('starts sidecar watcher with narrowed glob base directories instead of src root fallback', async () => {
    const reset = vi.fn()
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)

    const ctx = {
      runtimeState: {
        watcher: {
          sidecarWatcherMap: new Map(),
        },
      },
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        isDev: true,
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
    await plugin.buildStart?.call({ addWatchFile: vi.fn() } as any)

    expect(chokidarWatchMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        '/project/src/components',
        '/project/src/packages/order/components',
      ]),
      expect.any(Object),
    )
    const watchArgs = chokidarWatchMock.mock.calls[0]?.[0] ?? []
    expect(watchArgs).not.toContain('/project/src')
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
    const sidecarWatcher = createMockSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)

    const ctx = {
      runtimeState: {
        watcher: {
          sidecarWatcherMap: new Map(),
        },
      },
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

      registerPotentialComponent.mockClear()
      await plugin.buildStart?.()
      expect(registerPotentialComponent).not.toHaveBeenCalled()

      sidecarWatcher.emit('add', secondComponent)
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

  it('returns early in buildStart when config is not resolved', async () => {
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
            globs: ['components/**/*.vue'],
          },
        },
      },
      autoImportService: {
        reset,
        awaitManifestWrites,
        filter: () => true,
        registerPotentialComponent: vi.fn(),
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    const plugin = autoImport(ctx)[0]
    await plugin.buildStart?.()
    expect(reset).not.toHaveBeenCalled()
  })

  it('handles watchChange delete and update events after initial scan', async () => {
    const tempRoot = path.resolve(import.meta.dirname, '../test/__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-watch-change-'))
    const srcRoot = path.join(tempDir, 'src')
    const watchedFile = path.join(srcRoot, 'components/WatchCard/index.vue')
    await fs.ensureDir(path.dirname(watchedFile))
    await fs.writeFile(watchedFile, '<template><view>watch</view></template>', 'utf8')

    const reset = vi.fn()
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const removePotentialComponent = vi.fn()
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)
    chokidarWatchMock.mockReturnValue(createMockSidecarWatcher())

    const ctx = {
      runtimeState: {
        watcher: {
          sidecarWatcherMap: new Map(),
        },
      },
      configService: {
        cwd: tempDir,
        absoluteSrcRoot: srcRoot,
        relativeCwd: (p: string) => p.replace(`${tempDir}/`, ''),
        relativeAbsoluteSrcRoot: (p: string) => p.replace(`${srcRoot}/`, ''),
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
        filter: (target: string) => target.includes('components/WatchCard/index.vue'),
        registerPotentialComponent,
        removePotentialComponent,
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    try {
      const plugin = autoImport(ctx)[0]
      plugin.configResolved?.({ build: { outDir: 'dist' } } as any)
      await plugin.buildStart?.()

      registerPotentialComponent.mockClear()
      await plugin.watchChange?.('components/WatchCard/index.vue?macro=true', { event: 'update' } as any)
      expect(registerPotentialComponent).toHaveBeenCalledWith(watchedFile)

      await plugin.watchChange?.(watchedFile, { event: 'delete' } as any)
      expect(removePotentialComponent).toHaveBeenCalledWith(watchedFile)
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

  it('handles file rename through unlink and add watcher events', async () => {
    const tempRoot = path.resolve(import.meta.dirname, '../test/__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-rename-file-'))
    const srcRoot = path.join(tempDir, 'src')
    const originalFile = path.join(srcRoot, 'components/OldCard/index.vue')
    const renamedFile = path.join(srcRoot, 'components/NewCard/index.vue')
    await fs.ensureDir(path.dirname(originalFile))
    await fs.writeFile(originalFile, '<template><view>old</view></template>', 'utf8')

    const sidecarWatcher = createMockSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const removePotentialComponent = vi.fn()

    const ctx = {
      runtimeState: {
        watcher: {
          sidecarWatcherMap: new Map(),
        },
      },
      configService: {
        cwd: tempDir,
        absoluteSrcRoot: srcRoot,
        relativeCwd: (p: string) => p.replace(`${tempDir}/`, ''),
        relativeAbsoluteSrcRoot: (p: string) => p.replace(`${srcRoot}/`, ''),
        isDev: true,
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue'],
          },
        },
      },
      autoImportService: {
        reset: vi.fn(),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        filter: (target: string) => target.includes('components/'),
        registerPotentialComponent,
        removePotentialComponent,
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    try {
      const plugin = autoImport(ctx)[0]
      plugin.configResolved?.({ build: { outDir: 'dist' } } as any)
      await plugin.buildStart?.()

      registerPotentialComponent.mockClear()
      removePotentialComponent.mockClear()

      await fs.ensureDir(path.dirname(renamedFile))
      await fs.writeFile(renamedFile, '<template><view>new</view></template>', 'utf8')

      sidecarWatcher.emit('unlink', originalFile)
      sidecarWatcher.emit('add', renamedFile)

      expect(removePotentialComponent).toHaveBeenCalledWith(originalFile)
      expect(registerPotentialComponent).toHaveBeenCalledWith(renamedFile)
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

  it('handles directory rename through unlink and add watcher events', async () => {
    const tempRoot = path.resolve(import.meta.dirname, '../test/__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-rename-dir-'))
    const srcRoot = path.join(tempDir, 'src')
    const originalFile = path.join(srcRoot, 'components/OldGroup/Card/index.vue')
    const renamedFile = path.join(srcRoot, 'components/NewGroup/Card/index.vue')
    await fs.ensureDir(path.dirname(originalFile))
    await fs.writeFile(originalFile, '<template><view>old-group</view></template>', 'utf8')

    const sidecarWatcher = createMockSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const removePotentialComponent = vi.fn()

    const ctx = {
      runtimeState: {
        watcher: {
          sidecarWatcherMap: new Map(),
        },
      },
      configService: {
        cwd: tempDir,
        absoluteSrcRoot: srcRoot,
        relativeCwd: (p: string) => p.replace(`${tempDir}/`, ''),
        relativeAbsoluteSrcRoot: (p: string) => p.replace(`${srcRoot}/`, ''),
        isDev: true,
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue'],
          },
        },
      },
      autoImportService: {
        reset: vi.fn(),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        filter: (target: string) => target.includes('components/'),
        registerPotentialComponent,
        removePotentialComponent,
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    try {
      const plugin = autoImport(ctx)[0]
      plugin.configResolved?.({ build: { outDir: 'dist' } } as any)
      await plugin.buildStart?.()

      registerPotentialComponent.mockClear()
      removePotentialComponent.mockClear()

      await fs.ensureDir(path.dirname(renamedFile))
      await fs.writeFile(renamedFile, '<template><view>new-group</view></template>', 'utf8')

      sidecarWatcher.emit('unlink', originalFile)
      sidecarWatcher.emit('add', renamedFile)

      expect(removePotentialComponent).toHaveBeenCalledWith(originalFile)
      expect(registerPotentialComponent).toHaveBeenCalledWith(renamedFile)
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

  it('ignores unmatched or invalid watch changes', async () => {
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const removePotentialComponent = vi.fn()
    const ctx = {
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        weappViteConfig: {
          autoImportComponents: {
            output: true,
          },
        },
      },
      autoImportService: {
        reset: vi.fn(),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        filter: () => false,
        registerPotentialComponent,
        removePotentialComponent,
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    const plugin = autoImport(ctx)[0]
    plugin.configResolved?.({ build: { outDir: 'dist' } } as any)

    await plugin.watchChange?.('components/Ignore/index.vue', { event: 'update' } as any)
    await plugin.buildStart?.()
    await plugin.watchChange?.('\0virtual:entry', { event: 'update' } as any)
    await plugin.watchChange?.('../outside.vue', { event: 'update' } as any)

    expect(registerPotentialComponent).not.toHaveBeenCalled()
    expect(removePotentialComponent).not.toHaveBeenCalled()
  })

  it('handles bootstrap options when globs are absent', async () => {
    const awaitManifestWrites = vi.fn().mockResolvedValue(undefined)
    const scenarios = [
      {
        config: {
          output: false,
          typedComponents: true,
        },
        shouldReset: true,
      },
      {
        config: {
          output: false,
          typedComponents: false,
          htmlCustomData: 'custom-data.json',
        },
        shouldReset: true,
      },
      {
        config: {
          output: false,
          typedComponents: false,
          htmlCustomData: false,
          vueComponents: 'components.d.ts',
        },
        shouldReset: true,
      },
    ]

    for (const scenario of scenarios) {
      const reset = vi.fn()
      const ctx = {
        configService: {
          cwd: '/project',
          absoluteSrcRoot: '/project/src',
          relativeCwd: (p: string) => p,
          relativeAbsoluteSrcRoot: (p: string) => p,
          weappViteConfig: scenario.config
            ? { autoImportComponents: scenario.config }
            : {},
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

      if (scenario.shouldReset) {
        expect(reset).toHaveBeenCalledTimes(1)
      }
      else {
        expect(reset).not.toHaveBeenCalled()
      }
    }

    const resetWithoutConfig = vi.fn()
    const pluginWithoutConfig = autoImport({
      configService: undefined,
      autoImportService: {
        reset: resetWithoutConfig,
        awaitManifestWrites,
        filter: () => false,
        registerPotentialComponent: vi.fn(),
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any)[0]

    pluginWithoutConfig.configResolved?.({ build: { outDir: 'dist' } } as any)
    await pluginWithoutConfig.buildStart?.()
    expect(resetWithoutConfig).not.toHaveBeenCalled()
  })

  it('registers only src root watch target when glob base is empty', async () => {
    const tempRoot = path.resolve(import.meta.dirname, '../test/__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-watch-root-'))
    const srcRoot = path.join(tempDir, 'src')
    await fs.ensureDir(srcRoot)

    const addWatchFile = vi.fn()
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
            globs: ['**/*.vue'],
          },
        },
      },
      autoImportService: {
        reset,
        awaitManifestWrites,
        filter: () => false,
        registerPotentialComponent,
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    } as any

    try {
      const plugin = autoImport(ctx)[0]
      plugin.configResolved?.({ build: { outDir: 'dist' } } as any)
      await plugin.buildStart?.call({ addWatchFile } as any)

      expect(addWatchFile).toHaveBeenCalledTimes(1)
      expect(addWatchFile).toHaveBeenCalledWith(srcRoot)
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

  it('ignores watch changes when config service is missing after bootstrap', async () => {
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const ctx: any = {
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: (p: string) => p,
        relativeAbsoluteSrcRoot: (p: string) => p,
        weappViteConfig: {
          autoImportComponents: {
            output: true,
          },
        },
      },
      autoImportService: {
        reset: vi.fn(),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        filter: () => true,
        registerPotentialComponent,
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    }

    const plugin = autoImport(ctx)[0]
    plugin.configResolved?.({ build: { outDir: 'dist' } } as any)
    await plugin.buildStart?.()

    ctx.configService = undefined
    await plugin.watchChange?.('components/Lost/index.vue', { event: 'update' } as any)

    expect(registerPotentialComponent).not.toHaveBeenCalled()
  })

  it('ignores watch changes when autoImport service is unavailable or targets are empty', async () => {
    const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
    const ctx: any = {
      configService: {
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        relativeCwd: () => '',
        relativeAbsoluteSrcRoot: () => '',
        weappViteConfig: {
          autoImportComponents: {
            output: true,
          },
        },
      },
      autoImportService: {
        reset: vi.fn(),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        filter: () => false,
        registerPotentialComponent,
        removePotentialComponent: vi.fn(),
        resolve: vi.fn(),
        getRegisteredLocalComponents: vi.fn(),
      },
    }

    const plugin = autoImport(ctx)[0]
    plugin.configResolved?.({ build: { outDir: 'dist' } } as any)
    await plugin.buildStart?.()

    await plugin.watchChange?.('components/EmptyTarget/index.vue', { event: 'update' } as any)
    ctx.autoImportService = undefined
    await plugin.watchChange?.('components/MissingService/index.vue', { event: 'update' } as any)

    expect(registerPotentialComponent).not.toHaveBeenCalled()
  })
})
