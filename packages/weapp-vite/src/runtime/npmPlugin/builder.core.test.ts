import os from 'node:os'

import { fs } from '@weapp-core/shared'
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
        plugins: [[customPlugin, null, oxcPlugin]],
      } as any,
    })

    expect(viteBuildMock).toHaveBeenCalledTimes(1)
    const finalOptions = viteBuildMock.mock.calls[0]?.[0] as any
    expect(finalOptions?.define?.['process.env.NODE_ENV']).toBe(JSON.stringify('production'))
    expect(finalOptions?.define?.['import.meta.env.__TEST__']).toBe(JSON.stringify('yes'))
    expect(finalOptions?.build?.lib?.fileName?.('cjs', 'entry')).toBe('entry.js')
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

  it('prefers exports.import and module entries over main for non-miniprogram packages', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'demo')
    const cjsEntry = path.resolve(pkgRoot, 'dist/index.cjs')
    const esmEntry = path.resolve(pkgRoot, 'esm/index.mjs')
    await fs.ensureDir(path.dirname(cjsEntry))
    await fs.ensureDir(path.dirname(esmEntry))
    await fs.writeFile(cjsEntry, 'module.exports = 1', 'utf8')
    await fs.writeFile(esmEntry, 'export const value = 1', 'utf8')

    const ctx = createMockContext()
    const builder = createPackageBuilder(ctx)
    getPackageInfoMock.mockResolvedValue({
      rootPath: pkgRoot,
      packageJson: {
        name: 'demo',
        version: '0.0.0',
        main: 'dist/index.cjs',
        module: 'esm/index.mjs',
        exports: {
          '.': {
            require: './dist/index.cjs',
            import: './esm/index.mjs',
            default: './dist/index.cjs',
          },
        },
        dependencies: {},
      },
    })
    resolveModuleMock.mockReturnValue(cjsEntry)

    await builder.buildPackage({
      dep: 'demo',
      outDir: path.resolve(root, 'dist/miniprogram_npm'),
      isDependenciesCacheOutdate: true,
    })

    expect(viteBuildMock).toHaveBeenCalledTimes(1)
    const finalOptions = viteBuildMock.mock.calls[0]?.[0] as any
    expect(finalOptions?.build?.lib?.entry?.index).toBe(esmEntry)
  })

  it('does not copy upstream entry sourcemap after rebundling npm package', async () => {
    const root = await createTempDir()
    const sourceEntry = path.resolve(root, 'demo/index.js')
    const sourceMapPath = `${sourceEntry}.map`
    await fs.ensureDir(path.dirname(sourceEntry))
    await fs.writeFile(sourceEntry, 'module.exports = 1\n//# sourceMappingURL=index.js.map', 'utf8')
    await fs.writeFile(sourceMapPath, JSON.stringify({ version: 3, file: 'index.js', sources: ['index.ts'] }), 'utf8')

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
      isDependenciesCacheOutdate: true,
    })

    const copiedMapPath = path.resolve(root, 'dist/miniprogram_npm/demo/index.js.map')
    expect(await fs.pathExists(copiedMapPath)).toBe(false)
  })

  it('does not backfill upstream sourcemap when non-miniprogram cache is valid', async () => {
    const root = await createTempDir()
    const sourceEntry = path.resolve(root, 'demo/index.js')
    const sourceMapPath = `${sourceEntry}.map`
    const outDir = path.resolve(root, 'dist/miniprogram_npm/demo')
    const outputEntry = path.resolve(outDir, 'index.js')
    await fs.ensureDir(path.dirname(sourceEntry))
    await fs.ensureDir(outDir)
    await fs.writeFile(sourceEntry, 'module.exports = 1\n//# sourceMappingURL=index.js.map', 'utf8')
    await fs.writeFile(sourceMapPath, JSON.stringify({ version: 3, file: 'index.js', sources: ['index.ts'] }), 'utf8')
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
    const copiedMapPath = path.resolve(outDir, 'index.js.map')
    expect(await fs.pathExists(copiedMapPath)).toBe(false)
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

  it('applies npm.buildOptions outDir to miniprogram copy packages', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'mini-pkg')
    const defaultOutRoot = path.resolve(root, 'dist/miniprogram_npm')
    const customOutRoot = path.resolve(root, 'dist/subpackages/issue-327/miniprogram_npm')

    await fs.ensureDir(path.resolve(pkgRoot, 'miniprogram/button'))
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram/button/index.js'), 'module.exports = 1', 'utf8')

    const buildOptions = vi.fn((options: any, pkgMeta: { name: string }) => {
      return {
        ...options,
        build: {
          ...options.build,
          outDir: path.resolve(customOutRoot, pkgMeta.name),
        },
      }
    })
    const ctx = createMockContext({
      cwd: root,
      weappViteConfig: {
        npm: {
          buildOptions,
        },
      },
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
      outDir: defaultOutRoot,
      isDependenciesCacheOutdate: true,
    })

    expect(buildOptions).toHaveBeenCalledTimes(1)
    expect(await fs.pathExists(path.resolve(customOutRoot, 'mini-pkg/button/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(defaultOutRoot, 'mini-pkg/button/index.js'))).toBe(false)
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

  it('normalizes alipay miniprogram package and hoists nested dependencies', async () => {
    const root = await createTempDir()
    const pkgRoot = path.resolve(root, 'mini-pkg')
    const outRoot = path.resolve(root, 'dist/node_modules')

    await fs.ensureDir(path.resolve(pkgRoot, 'es/button'))
    await fs.writeFile(path.resolve(pkgRoot, 'es/button/index.js'), 'export const x = 1', 'utf8')

    await fs.ensureDir(path.resolve(pkgRoot, 'miniprogram/button'))
    await fs.ensureDir(path.resolve(pkgRoot, 'miniprogram/miniprogram_npm/tslib'))
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram/button/index.wxml'), '<view wx:if="{{ok}}" else></view>', 'utf8')
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram/button/index.wxss'), '@import "./dep.wxss";', 'utf8')
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram/button/dep.wxss'), '.a {}', 'utf8')
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram/button/helper.wxs'), 'module.exports = {}', 'utf8')
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram/button/index.js'), 'import helper from "./helper.wxs"; export default helper', 'utf8')
    await fs.writeFile(path.resolve(pkgRoot, 'miniprogram/miniprogram_npm/tslib/index.js'), 'module.exports = 1', 'utf8')

    const ctx = createMockContext({
      platform: 'alipay',
      weappViteConfig: {
        npm: {
          alipayNpmMode: 'node_modules',
        },
      },
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
      isDependenciesCacheOutdate: true,
    })

    const outPkgRoot = path.resolve(outRoot, 'mini-pkg')
    expect(await fs.pathExists(path.resolve(outPkgRoot, 'button/index.axml'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outPkgRoot, 'button/index.acss'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outPkgRoot, 'button/helper.sjs'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outPkgRoot, 'es/button/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(outRoot, 'tslib/index.js'))).toBe(true)
  })
})
