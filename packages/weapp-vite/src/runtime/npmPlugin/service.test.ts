import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNpmService } from './service'

const buildPackageMock = vi.hoisted(() => vi.fn(async () => {}))
const checkDependenciesCacheOutdateMock = vi.hoisted(() => vi.fn(async () => true))
const writeDependenciesCacheMock = vi.hoisted(() => vi.fn(async () => {}))
const getPackNpmRelationListMock = vi.hoisted(() => vi.fn())

vi.mock('./builder', () => ({
  createPackageBuilder: () => ({
    isMiniprogramPackage: vi.fn(),
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

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-npm-service-'))
  tempDirs.push(dir)
  return dir
}

describe('runtime npm service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const cachedSourceOutDir = path.resolve(cwd, 'node_modules/weapp-vite/.cache/npm-source/miniprogram_npm')
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
            mainPackageDependencies: false,
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
})
