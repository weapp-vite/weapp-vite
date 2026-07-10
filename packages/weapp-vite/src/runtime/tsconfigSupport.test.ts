import os from 'node:os'

import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { syncProjectSupportFiles } from './supportFiles'
import { createManagedTsconfigFiles, hasManagedTsconfigBootstrapCompleted, syncManagedTsconfigBootstrapFiles, syncManagedTsconfigFiles } from './tsconfigSupport'

function createCtx(overrides: Record<string, any> = {}) {
  return {
    configService: {
      cwd: '/project',
      configFilePath: '/project/vite.config.ts',
      packageJson: {},
      weappViteConfig: {},
      ...overrides,
    },
  } as any
}

describe('tsconfig support', () => {
  it('creates managed tsconfig files with standard defaults', async () => {
    const files = await createManagedTsconfigFiles(createCtx())
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)
    const node = JSON.parse(files.find(file => file.path.endsWith('tsconfig.node.json'))!.content)
    const server = JSON.parse(files.find(file => file.path.endsWith('tsconfig.server.json'))!.content)
    const shared = JSON.parse(files.find(file => file.path.endsWith('tsconfig.shared.json'))!.content)
    const sharedEmpty = files.find(file => file.path.endsWith('tsconfig.shared.empty.d.ts'))!

    expect(shared.compilerOptions.target).toBe('ES2023')
    expect(shared.files).toEqual(['./tsconfig.shared.empty.d.ts'])
    expect(shared).not.toHaveProperty('include')
    expect(sharedEmpty.content).toBe('export {}\n')
    expect(app.extends).toBe('./tsconfig.shared.json')
    expect(app.compilerOptions.lib).toEqual(['ES2023', 'DOM'])
    expect(app.compilerOptions.types).toContain('miniprogram-api-typings')
    expect(app.compilerOptions.types).toContain('weapp-vite/client')
    expect(app.compilerOptions.types).not.toContain('vite/client')
    expect(app.compilerOptions).not.toHaveProperty('baseUrl')
    expect(app.include).toContain('../src/**/*')
    expect(app.compilerOptions.paths['@/*']).toEqual(['../src/*'])
    expect(node.extends).toBe('./tsconfig.shared.json')
    expect(node.compilerOptions.types).toContain('node')
    expect(node.include).toContain('../vite.config.ts')
    expect(node.include).toContain('../weapp-vite.config.ts')
    expect(server.extends).toBe('./tsconfig.shared.json')
    expect(server.compilerOptions.types).toContain('node')
    expect(server.files).toEqual([])
  })

  it('adds wevu and web-aware settings and merges user overrides', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      cwd: '/repo/apps/demo',
      configFilePath: '/repo/apps/demo/vite.config.ts',
      packageJson: {
        dependencies: {
          wevu: '^1.0.0',
        },
      },
      weappViteConfig: {
        web: {
          enable: true,
        },
        typescript: {
          app: {
            compilerOptions: {
              paths: {
                '@weapp-vite/web': ['../../packages-runtime/web/src/index.ts'],
              },
            },
            include: ['../playground/**/*.ts'],
            vueCompilerOptions: {
              target: 3.5,
            },
          },
        },
      },
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client', 'vite/client']))
    expect(app.compilerOptions.paths['weapp-vite/typed-components']).toEqual(['./typed-components.d.ts'])
    expect(app.compilerOptions.paths['@weapp-vite/web']).toEqual(['../../../packages-runtime/web/src/index.ts'])
    expect(app.vueCompilerOptions.lib).toBe('wevu')
    expect(app.vueCompilerOptions.target).toBe(3.5)
    expect(app.include).toContain('../playground/**/*.ts')
  })

  it('prefers platform-specific typings for tt projects when the package is installed', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      packageJson: {
        devDependencies: {
          '@douyin-microapp/typings': '^1.3.1',
        },
      },
      weappViteConfig: {
        platform: 'tt',
      },
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['@douyin-microapp/typings', 'weapp-vite/client']))
    expect(app.compilerOptions.types).not.toContain('miniprogram-api-typings')
  })

  it('merges legacy root tsconfig files into managed outputs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-legacy-tsconfig-'))
    await fs.writeFile(path.join(root, 'tsconfig.shared.json'), `{
      // legacy shared config
      "compilerOptions": {
        "strict": false
      }
    }`)
    await fs.writeFile(path.join(root, 'tsconfig.app.json'), `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "tdesign-miniprogram/*": ["./node_modules/tdesign-miniprogram/miniprogram_dist/*"]
        }
      },
      "include": ["../legacy/**/*.ts"],
      "exclude": ["../legacy-exclude/**"]
    }`)
    await fs.writeFile(path.join(root, 'tsconfig.server.json'), `{
      "files": ["../server/entry.ts"]
    }`)

    const files = await createManagedTsconfigFiles(createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)
    const server = JSON.parse(files.find(file => file.path.endsWith('tsconfig.server.json'))!.content)
    const shared = JSON.parse(files.find(file => file.path.endsWith('tsconfig.shared.json'))!.content)

    expect(shared.compilerOptions.strict).toBe(false)
    expect(app.compilerOptions).not.toHaveProperty('baseUrl')
    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client']))
    expect(app.compilerOptions.paths['tdesign-miniprogram/*']).toEqual(['../node_modules/tdesign-miniprogram/miniprogram_dist/*'])
    expect(app.include).toContain('../legacy/**/*.ts')
    expect(app.exclude).toContain('../legacy-exclude/**')
    expect(server.files).toContain('../server/entry.ts')
  })

  it('reads legacy root tsconfig files without path existence prechecks', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-legacy-tsconfig-direct-read-'))
    await fs.writeFile(path.join(root, 'tsconfig.app.json'), `{
      "compilerOptions": {
        "paths": {
          "legacy/*": ["./legacy/*"]
        }
      }
    }`)

    const legacyPaths = new Set([
      path.join(root, 'tsconfig.shared.json'),
      path.join(root, 'tsconfig.app.json'),
      path.join(root, 'tsconfig.node.json'),
      path.join(root, 'tsconfig.server.json'),
    ])
    const pathExistsSpy = vi.spyOn(fs, 'pathExists')

    await createManagedTsconfigFiles(createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    }))

    const checkedLegacyPaths = pathExistsSpy.mock.calls
      .map(([filePath]) => path.resolve(String(filePath)))
      .filter(filePath => legacyPaths.has(filePath))

    expect(checkedLegacyPaths).toEqual([])
  })

  it('keeps shared tsconfig as an empty project when referenced directly', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-empty-shared-tsconfig-'))
    await fs.writeFile(path.join(root, 'tsconfig.shared.json'), `{
      "include": ["src/**/*.ts"],
      "files": ["src/env.d.ts"],
      "compilerOptions": {
        "strict": false
      }
    }`)

    const files = await createManagedTsconfigFiles(createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {
        typescript: {
          shared: {
            include: ['.weapp-vite/**/*.d.ts'],
            files: ['.weapp-vite/components.d.ts'],
          },
          app: {
            include: ['../custom/**/*.vue'],
            files: ['../src/env.d.ts'],
          },
        },
      },
    }))
    const shared = JSON.parse(files.find(file => file.path.endsWith('tsconfig.shared.json'))!.content)
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(shared.compilerOptions.strict).toBe(false)
    expect(shared.files).toEqual(['./tsconfig.shared.empty.d.ts'])
    expect(shared).not.toHaveProperty('include')
    expect(app.include).toEqual(expect.arrayContaining(['../src/**/*', './**/*.d.ts', '../custom/**/*.vue']))
    expect(app.files).toContain('../src/env.d.ts')
  })

  it('ignores invalid legacy root tsconfig files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-invalid-legacy-tsconfig-'))
    await fs.writeFile(path.join(root, 'tsconfig.app.json'), '{ invalid jsonc')

    const files = await createManagedTsconfigFiles(createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.include).toContain('../src/**/*')
    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client']))
    expect(app.compilerOptions.paths['@/*']).toEqual(['../src/*'])
  })

  it('points default @ alias to configured srcRoot', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      srcRoot: 'miniprogram',
      weappViteConfig: {},
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.paths['@/*']).toEqual(['../miniprogram/*'])
    expect(app.include).toContain('../miniprogram/**/*')
    expect(app.include).not.toContain('../src/**/*')
  })

  it('keeps builtin app macro types when user overrides app compilerOptions.types', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      weappViteConfig: {
        web: {
          enable: true,
        },
        typescript: {
          app: {
            compilerOptions: {
              types: ['custom-env'],
            },
          },
        },
      },
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client', 'vite/client', 'custom-env']))
  })

  it('omits deprecated baseUrl from managed and user app compiler options', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      weappViteConfig: {
        typescript: {
          app: {
            compilerOptions: {
              baseUrl: '.',
            },
          },
        },
      },
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions).not.toHaveProperty('baseUrl')
  })

  it('writes managed tsconfig files into .weapp-vite', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-managed-tsconfig-'))
    const ctx = createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    })

    await syncManagedTsconfigFiles(ctx)

    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.shared.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.shared.empty.d.ts'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.node.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.server.json'))).toBe(true)
  })

  it('does not rewrite unchanged managed tsconfig files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-managed-tsconfig-stable-'))
    const ctx = createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    })
    const appTsconfigPath = path.join(root, '.weapp-vite', 'tsconfig.app.json')

    await expect(syncManagedTsconfigFiles(ctx)).resolves.toBe(true)
    const before = await fs.stat(appTsconfigPath)

    await expect(syncManagedTsconfigFiles(ctx)).resolves.toBe(false)
    const after = await fs.stat(appTsconfigPath)

    expect(after.mtimeMs).toBe(before.mtimeMs)
  })

  it('warns and regenerates stale app tsconfig include after srcRoot changes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-managed-tsconfig-srcroot-'))
    const ctx = {
      configService: {
        cwd: root,
        configFilePath: path.join(root, 'vite.config.ts'),
        packageJson: {},
        srcRoot: 'miniprogram',
        weappViteConfig: {
          autoImportComponents: false,
        },
      },
      autoRoutesService: {
        isEnabled: () => false,
      },
    } as any
    const appTsconfigPath = path.join(root, '.weapp-vite', 'tsconfig.app.json')

    await fs.outputJson(appTsconfigPath, {
      extends: './tsconfig.shared.json',
      compilerOptions: {
        paths: {
          '@/*': ['../src/*'],
        },
      },
      include: [
        '../src/**/*',
        '../types/**/*.d.ts',
        '../env.d.ts',
        './**/*.d.ts',
      ],
    })

    const result = await syncProjectSupportFiles(ctx)
    const app = await fs.readJson(appTsconfigPath)

    expect(result.managedTsconfigChanged).toBe(true)
    expect(result.managedTsconfigWarnings).toEqual([
      '[prepare] 检测到 .weapp-vite/tsconfig.app.json include 与 weapp.srcRoot 不匹配：srcRoot 为 `miniprogram`，期望包含 `../miniprogram/**/*`，当前为 `../src/**/*`。已自动重新生成支持文件并使用最新配置继续运行。',
    ])
    expect(app.include).toContain('../miniprogram/**/*')
    expect(app.include).not.toContain('../src/**/*')
    expect(app.compilerOptions.paths['@/*']).toEqual(['../miniprogram/*'])
  })

  it('marks auto import globs as prepared after support file sync', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-support-auto-import-prepared-'))
    const srcRoot = path.join(root, 'src')
    const componentFile = path.join(srcRoot, 'components/PreparedCard/index.vue')
    await fs.ensureDir(path.dirname(componentFile))
    await fs.writeFile(componentFile, '<template><view>prepared</view></template>', 'utf8')

    const ctx = {
      runtimeState: {
        autoImport: {
          preparedGlobsKey: undefined,
        },
      },
      configService: {
        cwd: root,
        configFilePath: path.join(root, 'vite.config.ts'),
        absoluteSrcRoot: srcRoot,
        srcRoot: 'src',
        outDir: path.join(root, 'dist'),
        packageJson: {},
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue'],
          },
        },
      },
      autoRoutesService: {
        isEnabled: () => false,
      },
      autoImportService: {
        runInBatch: async (task: () => Promise<void>) => {
          await task()
        },
        reset: vi.fn(),
        registerPotentialComponent: vi.fn().mockResolvedValue(undefined),
        resolve: vi.fn(),
        setSupportFileResolverComponents: vi.fn(),
        collectStaticResolverComponentsForSupportFiles: vi.fn(() => ({})),
        syncSupportFileResolverComponents: vi.fn().mockResolvedValue(undefined),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        clearSupportFileResolverComponents: vi.fn(),
      },
    } as any

    await syncProjectSupportFiles(ctx)

    expect(ctx.runtimeState.autoImport.preparedGlobsKey).toBe('components/**/*.vue')
    expect(ctx.autoImportService.registerPotentialComponent).toHaveBeenCalledWith(componentFile)
  })

  it('skips template tag scan when static full resolvers already cover support files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-support-auto-import-static-full-'))
    const srcRoot = path.join(root, 'src')
    const pageFile = path.join(srcRoot, 'pages/index/index.vue')
    const resolverComponents = {
      'van-button': '@vant/weapp/button',
      'van-cell': '@vant/weapp/cell',
    }
    await fs.ensureDir(path.dirname(pageFile))
    await fs.writeFile(pageFile, '<template><view><van-button /></view></template>', 'utf8')

    const ctx = {
      runtimeState: {
        autoImport: {
          preparedGlobsKey: undefined,
        },
      },
      configService: {
        cwd: root,
        configFilePath: path.join(root, 'vite.config.ts'),
        absoluteSrcRoot: srcRoot,
        srcRoot: 'src',
        outDir: path.join(root, 'dist'),
        packageJson: {},
        weappViteConfig: {
          autoImportComponents: {
            resolvers: [
              {
                components: resolverComponents,
                supportFilesStrategy: 'full',
              },
            ],
          },
        },
      },
      autoRoutesService: {
        isEnabled: () => false,
      },
      autoImportService: {
        runInBatch: async (task: () => Promise<void>) => {
          await task()
        },
        reset: vi.fn(),
        registerPotentialComponent: vi.fn().mockResolvedValue(undefined),
        resolve: vi.fn(),
        setSupportFileResolverComponents: vi.fn(),
        collectStaticResolverComponentsForSupportFiles: vi.fn(() => resolverComponents),
        syncSupportFileResolverComponents: vi.fn().mockResolvedValue(undefined),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        clearSupportFileResolverComponents: vi.fn(),
      },
    } as any

    await syncProjectSupportFiles(ctx)

    expect(ctx.autoImportService.resolve).not.toHaveBeenCalled()
    expect(ctx.autoImportService.setSupportFileResolverComponents).toHaveBeenCalledWith(resolverComponents)
    expect(ctx.runtimeState.autoImport.preparedGlobsKey).toBe('components/**/*.wxml')
  })

  it('avoids rereading inspected managed tsconfig files while syncing support files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-support-tsconfig-reuse-'))
    const ctx = {
      runtimeState: {
        autoImport: {
          preparedGlobsKey: undefined,
        },
      },
      configService: {
        cwd: root,
        configFilePath: path.join(root, 'vite.config.ts'),
        absoluteSrcRoot: path.join(root, 'src'),
        srcRoot: 'src',
        outDir: path.join(root, 'dist'),
        packageJson: {},
        weappViteConfig: {
          autoImportComponents: false,
        },
      },
      autoRoutesService: {
        isEnabled: () => false,
      },
    } as any

    await syncManagedTsconfigFiles(ctx)
    const managedFiles = await createManagedTsconfigFiles(ctx)
    const managedReadCounts = new Map<string, number>()
    const originalReadFile = fs.readFile.bind(fs)
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: any, ...args: any[]) => {
      const normalizedPath = path.resolve(String(filePath))
      if (managedFiles.some(file => file.path === normalizedPath)) {
        managedReadCounts.set(normalizedPath, (managedReadCounts.get(normalizedPath) ?? 0) + 1)
      }
      return originalReadFile(filePath, ...args)
    })

    await syncProjectSupportFiles(ctx)

    for (const file of managedFiles) {
      expect(managedReadCounts.get(file.path) ?? 0).toBe(0)
    }
  })

  it('processes auto import template files in a shared batch during support file sync', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-support-auto-import-concurrent-'))
    const srcRoot = path.join(root, 'src')
    const vueFile = path.join(srcRoot, 'components/ConcurrentCard/index.vue')
    const wxmlFile = path.join(srcRoot, 'components/ConcurrentPanel/index.wxml')
    await fs.ensureDir(path.dirname(vueFile))
    await fs.ensureDir(path.dirname(wxmlFile))
    await fs.writeFile(vueFile, '<template><view><ConcurrentPanel /></view></template>', 'utf8')
    await fs.writeFile(wxmlFile, '<view><ConcurrentCard /></view>', 'utf8')

    const ctx = {
      runtimeState: {
        autoImport: {
          preparedGlobsKey: undefined,
        },
      },
      configService: {
        cwd: root,
        configFilePath: path.join(root, 'vite.config.ts'),
        absoluteSrcRoot: srcRoot,
        srcRoot: 'src',
        outDir: path.join(root, 'dist'),
        packageJson: {},
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue', 'components/**/*.wxml'],
            resolvers: [
              {
                resolve(componentName: string) {
                  return {
                    name: componentName,
                    from: `resolver/${componentName}`,
                  }
                },
              },
            ],
          },
        },
      },
      autoRoutesService: {
        isEnabled: () => false,
      },
      autoImportService: {
        runInBatch: async (task: () => Promise<void>) => {
          await task()
        },
        reset: vi.fn(),
        registerPotentialComponent: vi.fn().mockResolvedValue(undefined),
        resolve: vi.fn(),
        setSupportFileResolverComponents: vi.fn(),
        collectStaticResolverComponentsForSupportFiles: vi.fn(() => ({})),
        syncSupportFileResolverComponents: vi.fn().mockResolvedValue(undefined),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        clearSupportFileResolverComponents: vi.fn(),
      },
    } as any

    const syncPromise = syncProjectSupportFiles(ctx)
    await expect(syncPromise).resolves.toMatchObject({
      managedTsconfigChanged: expect.any(Boolean),
      managedTsconfigWarnings: expect.any(Array),
    })
    expect(ctx.autoImportService.registerPotentialComponent).toHaveBeenCalledWith(vueFile)
    expect(ctx.autoImportService.resolve).toHaveBeenCalled()
  })

  it('runs independent support file tasks concurrently', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-support-files-concurrent-'))
    const srcRoot = path.join(root, 'src')
    const componentFile = path.join(srcRoot, 'components/ConcurrentSupport/index.vue')
    await fs.ensureDir(path.dirname(componentFile))
    await fs.writeFile(componentFile, '<template><view>support</view></template>', 'utf8')

    let resolveAutoRoutes!: () => void
    let autoRoutesFinished = false
    let resolveAutoImportRegistered!: () => void
    const autoImportRegistered = new Promise<void>((resolve) => {
      resolveAutoImportRegistered = resolve
    })
    const autoRoutesBlocked = new Promise<void>((resolve) => {
      resolveAutoRoutes = () => {
        autoRoutesFinished = true
        resolve()
      }
    })
    const ctx = {
      runtimeState: {
        autoImport: {
          preparedGlobsKey: undefined,
        },
      },
      configService: {
        cwd: root,
        configFilePath: path.join(root, 'vite.config.ts'),
        absoluteSrcRoot: srcRoot,
        srcRoot: 'src',
        outDir: path.join(root, 'dist'),
        packageJson: {},
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue'],
          },
        },
      },
      autoRoutesService: {
        isEnabled: () => true,
        ensureFresh: vi.fn(async () => {
          await autoRoutesBlocked
        }),
      },
      autoImportService: {
        runInBatch: async (task: () => Promise<void>) => {
          await task()
        },
        reset: vi.fn(),
        registerPotentialComponent: vi.fn(async () => {
          resolveAutoImportRegistered()
        }),
        resolve: vi.fn(),
        setSupportFileResolverComponents: vi.fn(),
        collectStaticResolverComponentsForSupportFiles: vi.fn(() => ({})),
        syncSupportFileResolverComponents: vi.fn().mockResolvedValue(undefined),
        awaitManifestWrites: vi.fn().mockResolvedValue(undefined),
        clearSupportFileResolverComponents: vi.fn(),
      },
    } as any

    const syncPromise = syncProjectSupportFiles(ctx)
    await autoImportRegistered

    expect(autoRoutesFinished).toBe(false)
    expect(ctx.autoImportService.registerPotentialComponent).toHaveBeenCalledWith(componentFile)

    resolveAutoRoutes()
    await expect(syncPromise).resolves.toMatchObject({
      managedTsconfigChanged: expect.any(Boolean),
      managedTsconfigWarnings: expect.any(Array),
    })
  })

  it('bootstraps managed tsconfig files from cwd and package.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-'))
    await fs.writeJson(path.join(root, 'package.json'), {
      devDependencies: {
        wevu: '^1.0.0',
      },
    })

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(true)

    expect(hasManagedTsconfigBootstrapCompleted(root)).toBe(true)
    const app = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.app.json'))
    const server = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.server.json'))
    expect(app.compilerOptions.paths['weapp-vite/typed-components']).toEqual(['./typed-components.d.ts'])
    expect(server.files).toEqual([])
  })

  it('returns false when bootstrap managed tsconfig files are already fresh', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-fresh-'))
    await fs.writeJson(path.join(root, 'package.json'), {})

    await syncManagedTsconfigBootstrapFiles(root)

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(false)
  })

  it('bootstraps managed tsconfig files without package.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-no-package-json-'))

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(true)

    const rootTsconfig = await fs.readJson(path.join(root, 'tsconfig.json'))
    const app = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.app.json'))
    expect(rootTsconfig.references).toEqual([
      {
        path: './.weapp-vite/tsconfig.app.json',
      },
      {
        path: './.weapp-vite/tsconfig.server.json',
      },
      {
        path: './.weapp-vite/tsconfig.node.json',
      },
      {
        path: './.weapp-vite/tsconfig.shared.json',
      },
    ])
    expect(rootTsconfig.files).toEqual([])
    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client']))
  })

  it('does not overwrite existing root tsconfig during bootstrap', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-root-preserve-'))
    const rootTsconfigPath = path.join(root, 'tsconfig.json')
    await fs.writeJson(rootTsconfigPath, {
      compilerOptions: {
        paths: {
          '@/*': ['./src/*'],
        },
      },
    })

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(true)

    const rootTsconfig = await fs.readJson(rootTsconfigPath)
    expect(rootTsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*'])
    expect(rootTsconfig).not.toHaveProperty('references')
  })

  it('bootstraps managed tsconfig files for referenced workspace apps', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-workspace-tsconfig-'))
    const currentApp = path.join(root, 'apps/current')
    const referencedApp = path.join(root, 'apps/referenced')
    const plainPackage = path.join(root, 'packages/plain')

    await fs.ensureDir(currentApp)
    await fs.ensureDir(referencedApp)
    await fs.ensureDir(plainPackage)
    await fs.writeJson(path.join(root, 'tsconfig.json'), {
      references: [
        { path: './apps/current' },
        { path: './apps/referenced' },
        { path: './packages/plain' },
      ],
      files: [],
    })
    await fs.writeJson(path.join(currentApp, 'tsconfig.json'), {
      references: [
        { path: './.weapp-vite/tsconfig.app.json' },
      ],
      files: [],
    })
    await fs.writeJson(path.join(referencedApp, 'tsconfig.json'), {
      extends: './.weapp-vite/tsconfig.shared.json',
      compilerOptions: {},
    })
    await fs.writeJson(path.join(plainPackage, 'tsconfig.json'), {
      compilerOptions: {},
    })

    await expect(syncManagedTsconfigBootstrapFiles(currentApp)).resolves.toBe(true)

    await expect(fs.pathExists(path.join(currentApp, '.weapp-vite/tsconfig.shared.json'))).resolves.toBe(true)
    await expect(fs.pathExists(path.join(referencedApp, '.weapp-vite/tsconfig.shared.json'))).resolves.toBe(true)
    await expect(fs.pathExists(path.join(plainPackage, '.weapp-vite/tsconfig.shared.json'))).resolves.toBe(false)
  })

  it('does not overwrite richer managed tsconfig files during bootstrap', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-preserve-'))
    await fs.writeJson(path.join(root, 'package.json'), {
      devDependencies: {
        wevu: '^1.0.0',
      },
    })
    await fs.writeJson(path.join(root, 'tsconfig.json'), {
      references: [
        {
          path: './.weapp-vite/tsconfig.app.json',
        },
      ],
      files: [],
    })

    const ctx = createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      packageJson: {
        devDependencies: {
          wevu: '^1.0.0',
        },
      },
      weappViteConfig: {
        typescript: {
          app: {
            compilerOptions: {
              paths: {
                'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
              },
            },
          },
        },
      },
    })

    await syncManagedTsconfigFiles(ctx)
    const before = await fs.readFile(path.join(root, '.weapp-vite', 'tsconfig.app.json'), 'utf8')

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(false)

    const after = await fs.readFile(path.join(root, '.weapp-vite', 'tsconfig.app.json'), 'utf8')
    const app = JSON.parse(after)

    expect(after).toBe(before)
    expect(app.compilerOptions.paths['tdesign-miniprogram/*']).toEqual(['../node_modules/tdesign-miniprogram/miniprogram_dist/*'])
  })
})
