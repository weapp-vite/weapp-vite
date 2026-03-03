import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPackageBuilder } from './builder'

const getPackageInfoMock = vi.hoisted(() => vi.fn())
const resolveModuleMock = vi.hoisted(() => vi.fn())
const viteBuildMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('local-pkg', () => ({
  getPackageInfo: getPackageInfoMock,
  resolveModule: resolveModuleMock,
}))

vi.mock('vite', () => ({
  build: viteBuildMock,
}))

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-builder-core-'))
  tempDirs.push(dir)
  return dir
}

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    configService: {
      cwd: '/project',
      platform: 'weapp',
      defineImportMetaEnv: {
        'import.meta.env.__TEST__': JSON.stringify('yes'),
      },
      weappViteConfig: {},
      ...overrides,
    },
  } as any
}

describe('runtime npm package builder core', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => fs.remove(dir)))
    tempDirs.length = 0
  })

  it('merges bundle options and injects oxc plugin without duplicates', async () => {
    const oxcPlugin = { name: 'oxc-runtime' } as any
    const customPlugin = { name: 'custom' } as any
    const buildOptions = vi.fn((options: any) => options)
    const ctx = createMockContext({
      weappViteConfig: {
        npm: {
          buildOptions,
        },
      },
    })
    const builder = createPackageBuilder(ctx, oxcPlugin)

    await builder.bundleBuild({
      name: 'demo',
      entry: { index: '/deps/demo/index.js' },
      outDir: '/dist/demo',
      options: {
        plugins: [[customPlugin, oxcPlugin]],
      } as any,
    })

    expect(viteBuildMock).toHaveBeenCalledTimes(1)
    const finalOptions = viteBuildMock.mock.calls[0]?.[0] as any
    expect(finalOptions?.define?.['process.env.NODE_ENV']).toBe(JSON.stringify('production'))
    expect(finalOptions?.define?.['import.meta.env.__TEST__']).toBe(JSON.stringify('yes'))
    expect(finalOptions?.plugins?.filter((plugin: any) => plugin === oxcPlugin)).toHaveLength(1)
    expect(buildOptions).toHaveBeenCalledTimes(1)
  })

  it('skips vite build when npm buildOptions returns a non-object value', async () => {
    const ctx = createMockContext({
      weappViteConfig: {
        npm: {
          buildOptions: () => false,
        },
      },
    })
    const builder = createPackageBuilder(ctx)

    await builder.bundleBuild({
      name: 'demo',
      entry: { index: '/deps/demo/index.js' },
      outDir: '/dist/demo',
    })

    expect(viteBuildMock).not.toHaveBeenCalled()
  })

  it('handles non-miniprogram package with unresolved module gracefully', async () => {
    const ctx = createMockContext()
    const builder = createPackageBuilder(ctx)
    getPackageInfoMock.mockResolvedValue({
      rootPath: '/deps/demo',
      packageJson: {
        name: 'demo',
        version: '0.0.0',
        dependencies: {},
      },
    })
    resolveModuleMock.mockReturnValue(undefined)

    await builder.buildPackage({
      dep: 'demo',
      outDir: '/dist/miniprogram_npm',
      isDependenciesCacheOutdate: true,
    })

    expect(viteBuildMock).not.toHaveBeenCalled()
  })

  it('bundles non-miniprogram package and only recurses into builtin dependencies', async () => {
    const root = await createTempDir()
    const sourceEntry = path.resolve(root, 'demo/index.js')
    await fs.ensureDir(path.dirname(sourceEntry))
    await fs.writeFile(sourceEntry, 'module.exports = 1', 'utf8')

    const ctx = createMockContext()
    const builder = createPackageBuilder(ctx)
    getPackageInfoMock.mockImplementation(async (dep: string) => {
      if (dep === 'demo') {
        return {
          rootPath: path.resolve(root, 'demo'),
          packageJson: {
            name: 'demo',
            version: '0.0.0',
            dependencies: {
              fs: '*',
              lodash: '*',
            },
          },
        }
      }
      return null
    })
    resolveModuleMock.mockImplementation((dep: string) => dep === 'demo' ? sourceEntry : undefined)

    await builder.buildPackage({
      dep: 'demo',
      outDir: path.resolve(root, 'dist/miniprogram_npm'),
      isDependenciesCacheOutdate: true,
    })

    expect(viteBuildMock).toHaveBeenCalledTimes(1)
    expect(getPackageInfoMock).toHaveBeenCalledWith('demo')
    expect(getPackageInfoMock).toHaveBeenCalledWith('fs/')
    expect(getPackageInfoMock).not.toHaveBeenCalledWith('lodash')
  })

  it('skips non-miniprogram rebuild when output entry is newer than source entry', async () => {
    const root = await createTempDir()
    const sourceEntry = path.resolve(root, 'demo/index.js')
    const outDir = path.resolve(root, 'dist/miniprogram_npm/demo')
    const outputEntry = path.resolve(outDir, 'index.js')
    await fs.ensureDir(path.dirname(sourceEntry))
    await fs.ensureDir(outDir)
    await fs.writeFile(sourceEntry, 'module.exports = 1', 'utf8')
    await fs.writeFile(outputEntry, 'module.exports = 1', 'utf8')

    const sourceTime = new Date('2024-01-01T00:00:00.000Z')
    const outputTime = new Date('2024-01-02T00:00:00.000Z')
    await fs.utimes(sourceEntry, sourceTime, sourceTime)
    await fs.utimes(outputEntry, outputTime, outputTime)

    const ctx = createMockContext()
    const builder = createPackageBuilder(ctx)
    getPackageInfoMock.mockResolvedValue({
      rootPath: path.resolve(root, 'demo'),
      packageJson: {
        name: 'demo',
        version: '0.0.0',
        dependencies: {},
      },
    })
    resolveModuleMock.mockReturnValue(sourceEntry)

    await builder.buildPackage({
      dep: 'demo',
      outDir: path.resolve(root, 'dist/miniprogram_npm'),
      isDependenciesCacheOutdate: false,
    })

    expect(viteBuildMock).not.toHaveBeenCalled()
  })

  it('skips miniprogram copy build when cache is valid on weapp platform', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'mini-pkg')
    const outRoot = path.resolve(root, 'dist/miniprogram_npm')
    const outPkgRoot = path.resolve(outRoot, 'mini-pkg')
    await fs.ensureDir(path.resolve(pkgRoot, 'miniprogram'))
    await fs.ensureDir(outPkgRoot)

    const copySpy = vi.spyOn(fs, 'copy')
    const ctx = createMockContext({
      platform: 'weapp',
    })
    const builder = createPackageBuilder(ctx)
    getPackageInfoMock.mockResolvedValue({
      rootPath: pkgRoot,
      packageJson: {
        name: 'mini-pkg',
        version: '0.0.0',
        miniprogram: 'miniprogram',
        dependencies: {},
      },
    })

    await builder.buildPackage({
      dep: 'mini-pkg',
      outDir: outRoot,
      isDependenciesCacheOutdate: false,
    })

    expect(copySpy).not.toHaveBeenCalled()
  })
})
