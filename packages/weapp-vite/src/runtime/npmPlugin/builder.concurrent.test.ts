import type { MutableCompilerContext } from '../../context'
import os from 'node:os'
import fs from 'fs-extra'
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

    const originalCopy = fs.copy.bind(fs)
    const activeDestinations = new Set<string>()
    const copySpy = vi.spyOn(fs, 'copy').mockImplementation(async (from: string, to: string, ...rest: unknown[]) => {
      const resolvedDest = path.resolve(to)
      if (activeDestinations.has(resolvedDest)) {
        const error = new Error(`copy destination race detected: ${resolvedDest}`) as Error & {
          code?: string
          syscall?: string
          path?: string
        }
        error.code = 'ENOENT'
        error.syscall = 'unlink'
        error.path = resolvedDest
        throw error
      }
      activeDestinations.add(resolvedDest)
      await new Promise(resolve => setTimeout(resolve, 5))
      try {
        return await (originalCopy as (...args: unknown[]) => Promise<void>)(from, to, ...rest)
      }
      finally {
        activeDestinations.delete(resolvedDest)
      }
    })

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
    const sharedCopyCalls = copySpy.mock.calls.filter(([, to]) => path.resolve(String(to)) === sharedDest)

    expect(await fs.pathExists(path.resolve(sharedDest, 'index.js'))).toBe(true)
    expect(sharedCopyCalls).toHaveLength(1)
  })
})
