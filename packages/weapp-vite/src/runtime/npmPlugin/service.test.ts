import os from 'node:os'

import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNpmService,
  hasLocalSubPackageNpmConfig,
  resolveCopyFilterRelativePath,
  resolveNpmBuildCandidateDependenciesSync,
  resolveNpmDistDirName,
  resolveNpmSourceCacheOutDir,
  resolveTargetDependencies,
} from './service'

const buildPackageMock = vi.hoisted(() => vi.fn(async () => {}))
const checkDependenciesCacheOutdateMock = vi.hoisted(() => vi.fn(async () => true))
const writeDependenciesCacheMock = vi.hoisted(() => vi.fn(async () => {}))
const getPackNpmRelationListMock = vi.hoisted(() => vi.fn())
const getPackageInfoMock = vi.hoisted(() => vi.fn(async () => null))
const getPackageInfoSyncMock = vi.hoisted(() => vi.fn(() => null))

vi.mock('./builder', () => ({
  createPackageBuilder: () => ({
    isMiniprogramPackage: vi.fn((pkg) => {
      return typeof pkg?.miniprogram === 'string'
    }),
    shouldSkipBuild: vi.fn(),
    bundleBuild: vi.fn(),
    copyBuild: vi.fn(),
    buildPackage: buildPackageMock,
  }),
}))

vi.mock('./cache', () => ({
  createDependenciesCache: () => ({
    getDependenciesCacheFilePath: vi.fn(),
    dependenciesCacheHash: vi.fn(() => 'hash'),
    writeDependenciesCache: writeDependenciesCacheMock,
    readDependenciesCache: vi.fn(),
    checkDependenciesCacheOutdate: checkDependenciesCacheOutdateMock,
  }),
}))

vi.mock('./relations', () => ({
  getPackNpmRelationList: getPackNpmRelationListMock,
}))

vi.mock('local-pkg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('local-pkg')>()
  return {
    ...actual,
    getPackageInfo: getPackageInfoMock,
    getPackageInfoSync: getPackageInfoSyncMock,
  }
})

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-npm-service-'))
  tempDirs.push(dir)
  return dir
}

describe('runtime npm service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildPackageMock.mockImplementation(async () => {})
    getPackageInfoMock.mockImplementation(async (dep: string) => {
      if (dep === 'tdesign-miniprogram' || dep === '@vant/weapp') {
        return {
          packageJson: {
            miniprogram: 'miniprogram_dist',
          },
        }
      }
      return null
    })
    getPackageInfoSyncMock.mockImplementation((dep: string) => {
      if (dep === 'tdesign-miniprogram' || dep === '@vant/weapp') {
        return {
          packageJson: {
            miniprogram: 'miniprogram_dist',
          },
        }
      }
      return null
    })
    getPackNpmRelationListMock.mockReturnValue([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: './dist',
      },
    ])
  })

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => fs.remove(dir)))
    tempDirs.length = 0
  })

  it('resolves target dependencies from string and regex patterns', () => {
    expect(resolveTargetDependencies(['dayjs', 'lodash'])).toEqual(['dayjs', 'lodash'])
    expect(resolveTargetDependencies(['dayjs', 'lodash'], false)).toEqual([])
    expect(resolveTargetDependencies(['dayjs', 'lodash'], ['dayjs', /^lod/])).toEqual(['dayjs', 'lodash'])
    expect(resolveTargetDependencies(['dayjs'], ['custom-only'])).toEqual(['custom-only'])
  })

  it('resolves explicit npm build candidates without forcing ordinary dependencies into external', () => {
    const pkgJson = {
      dependencies: {
        'dayjs': '^1.11.13',
        'tdesign-miniprogram': '^1.12.3',
      },
      devDependencies: {
        '@vant/weapp': '^1.11.6',
        'lodash': '^4.17.21',
      },
    }

    expect(resolveNpmBuildCandidateDependenciesSync({
      configService: {
        cwd: '/project',
        weappViteConfig: {
          npm: {
            include: ['dayjs'],
          },
        },
      },
    } as any, pkgJson as any)).toEqual(['tdesign-miniprogram', '@vant/weapp', 'dayjs'])
  })

  it('detects whether local subpackages define npm dependency lists', () => {
    expect(hasLocalSubPackageNpmConfig({
      configService: {
        weappViteConfig: {
          npm: {
            subPackages: {
              a: {
                dependencies: ['dayjs'],
              },
            },
          },
        },
      },
    } as any)).toBe(true)

    expect(hasLocalSubPackageNpmConfig({
      configService: {
        weappViteConfig: {
          npm: {
            subPackages: {
              a: {
                dependencies: [],
              },
            },
          },
        },
      },
    } as any)).toBe(false)
  })

  it('resolves npm dist dir names from platform-specific config', () => {
    expect(resolveNpmDistDirName(undefined)).toBe('miniprogram_npm')
    expect(resolveNpmDistDirName({
      platform: 'weapp',
      weappViteConfig: {},
    } as any)).toBe('miniprogram_npm')
    expect(resolveNpmDistDirName({
      platform: 'alipay',
      weappViteConfig: {
        npm: {
          alipayNpmMode: 'node_modules',
        },
      },
    } as any)).toBe('node_modules')
  })

  it('stores npm source cache inside the project-local .weapp-vite directory', () => {
    expect(resolveNpmSourceCacheOutDir('/project', 'miniprogram_npm')).toBe('/project/.weapp-vite/npm-source/miniprogram_npm')
  })

  it('normalizes fs.copy filter relative paths for Windows-style paths', () => {
    expect(
      resolveCopyFilterRelativePath(
        'C:\\project\\.weapp-vite\\npm-source\\miniprogram_npm',
        'C:\\project\\.weapp-vite\\npm-source\\miniprogram_npm\\dayjs\\index.js',
      ),
    ).toBe('dayjs/index.js')

    expect(
      resolveCopyFilterRelativePath(
        'D:/project/.weapp-vite/npm-source/miniprogram_npm',
        'D:/project/.weapp-vite/npm-source/miniprogram_npm/dayjs/index.js',
      ),
    ).toBe('dayjs/index.js')

    expect(
      resolveCopyFilterRelativePath(
        'D:/project/.weapp-vite/npm-source/miniprogram_npm',
        'D:\\project\\.weapp-vite\\npm-source\\miniprogram_npm\\dayjs\\index.js',
      ),
    ).toBe('dayjs/index.js')
  })

  it('defaults to explicit npm candidates from miniprogram packages and include patterns', async () => {
    const cwd = await createTempDir()
    const packageJson = {
      dependencies: {
        'dayjs': '^1.11.13',
        'tdesign-miniprogram': '^1.12.3',
      },
      devDependencies: {
        '@vant/weapp': '^1.11.6',
        'lodash': '^4.17.21',
      },
    }

    await fs.writeJson(path.resolve(cwd, 'package.json'), packageJson)
    buildPackageMock.mockImplementation(async ({ dep, outDir }) => {
      await fs.outputFile(path.resolve(outDir, dep, 'index.js'), `module.exports = "${dep}"`)
    })

    const ctx = {
      configService: {
        cwd,
        outDir: path.resolve(cwd, 'dist'),
        platform: 'weapp',
        packageJson,
        weappViteConfig: {
          npm: {
            enable: true,
            include: ['dayjs'],
          },
        },
      },
      scanService: {
        subPackageMap: new Map(),
      },
    } as any

    const service = createNpmService(ctx)
    await service.build()

    expect(await fs.pathExists(path.resolve(cwd, 'dist/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/miniprogram_npm/tdesign-miniprogram/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/miniprogram_npm/@vant/weapp/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/miniprogram_npm/lodash/index.js'))).toBe(false)

    const buildCalls = buildPackageMock.mock.calls.map(([args]) => args.dep)
    expect(buildCalls).toEqual(['tdesign-miniprogram', '@vant/weapp', 'dayjs'])
  })

  it('allows explicit subpackage patterns to build npm packages from devDependencies', async () => {
    const cwd = await createTempDir()
    const packageJson = {
      devDependencies: {
        dayjs: '^1.11.13',
      },
    }

    await fs.writeJson(path.resolve(cwd, 'package.json'), packageJson)
    buildPackageMock.mockImplementation(async ({ dep, outDir }) => {
      await fs.outputFile(path.resolve(outDir, dep, 'index.js'), `module.exports = "${dep}"`)
    })
    checkDependenciesCacheOutdateMock.mockResolvedValue(true)

    const ctx = {
      configService: {
        cwd,
        outDir: path.resolve(cwd, 'dist'),
        platform: 'weapp',
        packageJson,
        weappViteConfig: {
          npm: {
            enable: true,
            mainPackage: {
              dependencies: false,
            },
            subPackages: {
              packageA: {
                dependencies: ['dayjs'],
              },
            },
          },
        },
      },
      scanService: {
        loadAppEntry: vi.fn(async () => {}),
        loadSubPackages: vi.fn(() => []),
        subPackageMap: new Map([
          ['packageA', {
            subPackage: {
              root: 'packageA',
              dependencies: ['dayjs'],
            },
          }],
        ]),
      },
    } as any

    const service = createNpmService(ctx)
    await service.build()

    expect(await fs.pathExists(path.resolve(cwd, 'dist/miniprogram_npm/dayjs/index.js'))).toBe(false)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageA/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(buildPackageMock).toHaveBeenCalledTimes(1)
    expect(buildPackageMock).toHaveBeenCalledWith(expect.objectContaining({
      dep: 'dayjs',
      outDir: path.resolve(cwd, '.weapp-vite/npm-source/miniprogram_npm'),
    }))
  })

  it('builds cached npm source and removes main output when main output is disabled', async () => {
    const cwd = await createTempDir()
    const packageJson = {
      dependencies: {
        'dayjs': '^1.11.13',
        'tdesign-miniprogram': '^1.12.3',
        'clsx': '^2.1.1',
        'class-variance-authority': '^0.7.1',
      },
    }

    await fs.writeJson(path.resolve(cwd, 'package.json'), packageJson)
    await fs.outputFile(path.resolve(cwd, 'dist/miniprogram_npm/stale/index.js'), 'module.exports = "stale"')
    const cachedSourceOutDir = resolveNpmSourceCacheOutDir(cwd, 'miniprogram_npm')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'dayjs/index.js'), 'module.exports = "dayjs"')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'tdesign-miniprogram/index.js'), 'module.exports = "tdesign"')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'clsx/index.js'), 'module.exports = "clsx"')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'class-variance-authority/index.js'), 'module.exports = "cva"')
    checkDependenciesCacheOutdateMock.mockImplementation(async (key?: string) => key !== '__all__')

    const ctx = {
      configService: {
        cwd,
        platform: 'weapp',
        packageJson,
        weappViteConfig: {
          npm: {
            enable: true,
            strategy: 'legacy',
            mainPackage: {
              dependencies: false,
            },
            subPackages: {
              packageA: {
                dependencies: ['dayjs', 'tdesign-miniprogram', 'clsx'],
              },
              packageB: {
                dependencies: ['dayjs', 'tdesign-miniprogram', 'class-variance-authority'],
              },
            },
          },
        },
      },
      scanService: {
        loadAppEntry: vi.fn(async () => {}),
        loadSubPackages: vi.fn(() => []),
        subPackageMap: new Map([
          ['packageA', {
            subPackage: {
              root: 'packageA',
              dependencies: ['dayjs', 'tdesign-miniprogram', 'clsx'],
            },
          }],
          ['packageB', {
            subPackage: {
              root: 'packageB',
              dependencies: ['dayjs', 'tdesign-miniprogram', 'class-variance-authority'],
            },
          }],
        ]),
      },
    } as any

    const service = createNpmService(ctx)
    await service.build()

    const rootOutDir = path.resolve(cwd, 'dist/miniprogram_npm')
    expect(await fs.pathExists(rootOutDir)).toBe(false)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageA/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageA/miniprogram_npm/clsx/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageB/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageB/miniprogram_npm/class-variance-authority/index.js'))).toBe(true)

    const buildCalls = buildPackageMock.mock.calls.map(([args]) => ({
      dep: args.dep,
      outDir: path.relative(cwd, args.outDir).replace(/\\/g, '/'),
    }))

    expect(buildCalls).toEqual([
      { dep: 'dayjs', outDir: path.relative(cwd, cachedSourceOutDir).replace(/\\/g, '/') },
      { dep: 'tdesign-miniprogram', outDir: path.relative(cwd, cachedSourceOutDir).replace(/\\/g, '/') },
      { dep: 'clsx', outDir: path.relative(cwd, cachedSourceOutDir).replace(/\\/g, '/') },
      { dep: 'class-variance-authority', outDir: path.relative(cwd, cachedSourceOutDir).replace(/\\/g, '/') },
    ])

    expect(writeDependenciesCacheMock).toHaveBeenCalledWith(undefined)
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('__all__')
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('packageA')
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('packageB')
    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
  })

  it('rebuilds cached npm source when cache is marked fresh but source output is missing', async () => {
    const cwd = await createTempDir()
    const packageJson = {
      dependencies: {
        dayjs: '^1.11.13',
        lodash: '^4.17.21',
      },
    }

    await fs.writeJson(path.resolve(cwd, 'package.json'), packageJson)
    checkDependenciesCacheOutdateMock.mockResolvedValue(false)
    buildPackageMock.mockImplementation(async ({ dep, outDir }) => {
      await fs.outputFile(path.resolve(outDir, dep, 'index.js'), `module.exports = "${dep}"`)
    })
    getPackNpmRelationListMock.mockReturnValue([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: '.',
      },
    ])

    const ctx = {
      configService: {
        cwd,
        outDir: path.resolve(cwd, 'dist'),
        platform: 'weapp',
        packageJson,
        weappViteConfig: {
          npm: {
            enable: true,
            strategy: 'legacy',
            mainPackage: {
              dependencies: false,
            },
            subPackages: {
              packageA: {
                dependencies: [/^dayjs$/],
              },
              packageB: {
                dependencies: [/^lodash$/],
              },
            },
          },
        },
      },
      scanService: {
        loadAppEntry: vi.fn(async () => {}),
        loadSubPackages: vi.fn(() => []),
        subPackageMap: new Map([
          ['packageA', {
            subPackage: {
              root: 'packageA',
              dependencies: [/^dayjs$/],
            },
          }],
          ['packageB', {
            subPackage: {
              root: 'packageB',
              dependencies: [/^lodash$/],
            },
          }],
        ]),
      },
    } as any

    const service = createNpmService(ctx)
    await expect(service.build()).resolves.toBeUndefined()

    const cachedSourceOutDir = resolveNpmSourceCacheOutDir(cwd, 'miniprogram_npm')
    expect(await fs.pathExists(path.resolve(cachedSourceOutDir, 'dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cachedSourceOutDir, 'lodash/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/miniprogram_npm'))).toBe(false)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageA/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageB/miniprogram_npm/lodash/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'packageA/miniprogram_npm/dayjs/index.js'))).toBe(false)
    expect(await fs.pathExists(path.resolve(cwd, 'packageB/miniprogram_npm/lodash/index.js'))).toBe(false)

    const buildCalls = buildPackageMock.mock.calls.map(([args]) => ({
      dep: args.dep,
      outDir: path.relative(cwd, args.outDir).replace(/\\/g, '/'),
    }))

    expect(buildCalls).toEqual([
      {
        dep: 'dayjs',
        outDir: '.weapp-vite/npm-source/miniprogram_npm',
      },
      {
        dep: 'lodash',
        outDir: '.weapp-vite/npm-source/miniprogram_npm',
      },
    ])
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('__all__')
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith(undefined)
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('packageA')
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('packageB')
  })

  it('serializes local subpackage copies from the shared npm source cache', async () => {
    const cwd = await createTempDir()
    const packageJson = {
      dependencies: {
        'dayjs': '^1.11.13',
        'tdesign-miniprogram': '^1.12.3',
        'class-variance-authority': '^0.7.1',
        'clsx': '^2.1.1',
      },
    }

    await fs.writeJson(path.resolve(cwd, 'package.json'), packageJson)

    const cachedSourceOutDir = resolveNpmSourceCacheOutDir(cwd, 'miniprogram_npm')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'dayjs/index.js'), 'module.exports = "dayjs"')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'tdesign-miniprogram/drawer/drawer.js'), 'module.exports = "drawer"')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'class-variance-authority/index.js'), 'module.exports = "cva"')
    await fs.outputFile(path.resolve(cachedSourceOutDir, 'clsx/index.js'), 'module.exports = "clsx"')

    checkDependenciesCacheOutdateMock.mockImplementation(async (key?: string) => key !== '__all__')

    const ctx = {
      configService: {
        cwd,
        outDir: path.resolve(cwd, 'dist'),
        platform: 'weapp',
        packageJson,
        weappViteConfig: {
          npm: {
            enable: true,
            strategy: 'legacy',
            mainPackage: {
              dependencies: false,
            },
            subPackages: {
              packageA: {
                dependencies: ['dayjs', 'tdesign-miniprogram', 'clsx'],
              },
              packageB: {
                dependencies: ['dayjs', 'tdesign-miniprogram', 'class-variance-authority'],
              },
            },
          },
        },
      },
      scanService: {
        loadAppEntry: vi.fn(async () => {}),
        loadSubPackages: vi.fn(() => []),
        subPackageMap: new Map([
          ['packageA', {
            subPackage: {
              root: 'packageA',
              dependencies: ['dayjs', 'tdesign-miniprogram', 'clsx'],
            },
          }],
          ['packageB', {
            subPackage: {
              root: 'packageB',
              dependencies: ['dayjs', 'tdesign-miniprogram', 'class-variance-authority'],
            },
          }],
        ]),
      },
    } as any

    const originalCopy = fs.copy.bind(fs)
    let activeSharedCopy = 0
    const copySpy = vi.spyOn(fs, 'copy').mockImplementation(async (src, dest, options) => {
      const normalizedSrc = path.resolve(String(src))
      if (normalizedSrc === cachedSourceOutDir) {
        activeSharedCopy += 1
        expect(activeSharedCopy).toBe(1)
        await new Promise(resolve => setTimeout(resolve, 5))
        try {
          return await originalCopy(src, dest, options as any)
        }
        finally {
          activeSharedCopy -= 1
        }
      }
      return originalCopy(src, dest, options as any)
    })

    try {
      const service = createNpmService(ctx)
      await expect(service.build()).resolves.toBeUndefined()
    }
    finally {
      copySpy.mockRestore()
    }

    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageA/miniprogram_npm/tdesign-miniprogram/drawer/drawer.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist/packageB/miniprogram_npm/tdesign-miniprogram/drawer/drawer.js'))).toBe(true)
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('packageA')
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('packageB')
  })

  it('uses pluginPackage dependency scope in pluginOnly mode', async () => {
    const cwd = await createTempDir()
    const packageJson = {
      dependencies: {
        dayjs: '^1.11.13',
        lodash: '^4.17.21',
      },
    }

    await fs.writeJson(path.resolve(cwd, 'package.json'), packageJson)
    buildPackageMock.mockImplementation(async ({ dep, outDir }) => {
      await fs.outputFile(path.resolve(outDir, dep, 'index.js'), `module.exports = "${dep}"`)
    })
    checkDependenciesCacheOutdateMock.mockResolvedValue(true)
    getPackNpmRelationListMock.mockReturnValue([
      {
        packageJsonPath: './package.json',
        miniprogramNpmDistDir: './dist-plugin',
      },
    ])

    const ctx = {
      configService: {
        cwd,
        outDir: path.resolve(cwd, 'dist-plugin'),
        pluginOnly: true,
        platform: 'weapp',
        packageJson,
        weappViteConfig: {
          npm: {
            enable: true,
            strategy: 'legacy',
            pluginPackage: {
              dependencies: ['dayjs'],
            },
          },
        },
      },
      scanService: {
        subPackageMap: new Map(),
      },
    } as any

    const service = createNpmService(ctx)
    await service.build()

    expect(await fs.pathExists(path.resolve(cwd, 'dist-plugin/miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(cwd, 'dist-plugin/miniprogram_npm/lodash/index.js'))).toBe(false)

    const buildCalls = buildPackageMock.mock.calls.map(([args]) => ({
      dep: args.dep,
      outDir: path.relative(cwd, args.outDir).replace(/\\/g, '/'),
    }))

    expect(buildCalls).toEqual([
      {
        dep: 'dayjs',
        outDir: '.weapp-vite/npm-source/miniprogram_npm',
      },
      {
        dep: 'lodash',
        outDir: '.weapp-vite/npm-source/miniprogram_npm',
      },
      {
        dep: 'dayjs',
        outDir: 'dist-plugin/miniprogram_npm',
      },
    ])
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('__all__')
    expect(writeDependenciesCacheMock).toHaveBeenCalledWith('__plugin__')
  })
})
