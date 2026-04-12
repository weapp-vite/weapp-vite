import type { MutableCompilerContext } from '../../context'
import os from 'node:os'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPackageBuilder } from './builder'

const getPackageInfoMock = vi.hoisted(() => vi.fn())
const resolveModuleMock = vi.hoisted(() => vi.fn())

vi.mock('local-pkg', () => {
  return {
    getPackageInfo: getPackageInfoMock,
    resolveModule: resolveModuleMock,
  }
})

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-builder-race-'))
  tempDirs.push(dir)
  return dir
}

async function createMiniProgramPackage(root: string, name: string) {
  const pkgRoot = path.resolve(root, name)
  const miniRoot = path.resolve(pkgRoot, 'miniprogram_dist')
  await fs.ensureDir(miniRoot)
  await fs.writeJson(path.resolve(pkgRoot, 'package.json'), {
    name,
    version: '0.0.0',
    miniprogram: 'miniprogram_dist',
  })
  await fs.writeFile(path.resolve(miniRoot, 'index.js'), `module.exports = "${name}"`)
  return pkgRoot
}

describe('runtime npm builder concurrent dedupe', () => {
  beforeEach(() => {
    getPackageInfoMock.mockReset()
    resolveModuleMock.mockReset()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(tempDirs.map(dir => fs.remove(dir)))
    tempDirs.length = 0
  })

  it('dedupes shared dependency builds under concurrent recursion', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist', 'miniprogram_npm')

    const pkgARoot = await createMiniProgramPackage(root, 'pkg-a')
    const pkgBRoot = await createMiniProgramPackage(root, 'pkg-b')
    const sharedRoot = await createMiniProgramPackage(root, 'shared')

    const packageInfoMap = new Map([
      ['pkg-a', {
        rootPath: pkgARoot,
        packageJson: {
          name: 'pkg-a',
          version: '0.0.0',
          miniprogram: 'miniprogram_dist',
          dependencies: {
            shared: '1.0.0',
          },
        },
      }],
      ['pkg-b', {
        rootPath: pkgBRoot,
        packageJson: {
          name: 'pkg-b',
          version: '0.0.0',
          miniprogram: 'miniprogram_dist',
          dependencies: {
            shared: '1.0.0',
          },
        },
      }],
      ['shared', {
        rootPath: sharedRoot,
        packageJson: {
          name: 'shared',
          version: '0.0.0',
          miniprogram: 'miniprogram_dist',
          dependencies: {},
        },
      }],
    ])

    getPackageInfoMock.mockImplementation(async (dep: string) => {
      return packageInfoMap.get(dep) ?? null
    })
    resolveModuleMock.mockReturnValue(undefined)

    const ctx = {
      configService: {
        platform: 'weapp',
        weappViteConfig: {},
      },
    } as MutableCompilerContext
    const builder = createPackageBuilder(ctx)

    await Promise.all([
      builder.buildPackage({
        dep: 'pkg-a',
        outDir,
        isDependenciesCacheOutdate: true,
      }),
      builder.buildPackage({
        dep: 'pkg-b',
        outDir,
        isDependenciesCacheOutdate: true,
      }),
    ])

    const sharedDest = path.resolve(outDir, 'shared')
    const sharedPackageInfoCalls = getPackageInfoMock.mock.calls.filter(([dep]) => dep === 'shared')

    expect(await fs.pathExists(path.resolve(sharedDest, 'index.js'))).toBe(true)
    expect(sharedPackageInfoCalls).toHaveLength(1)
  })
})
