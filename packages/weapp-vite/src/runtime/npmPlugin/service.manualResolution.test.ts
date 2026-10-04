import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPackageBuilder } from './builder'
import { createNpmBuildService } from './service/build'

const tempDirs: string[] = []

async function writeNativePackage(
  installRoot: string,
  name: string,
  marker: string,
  dependencies: Record<string, string> = {},
) {
  const packageRoot = path.join(installRoot, 'node_modules', name)
  await fs.outputJson(path.join(packageRoot, 'package.json'), {
    name,
    version: '1.0.0',
    main: 'miniprogram/index.js',
    miniprogram: 'miniprogram',
    dependencies,
  })
  await fs.outputFile(path.join(packageRoot, 'miniprogram/index.js'), 'Component({})\n')
  await fs.outputFile(path.join(packageRoot, 'miniprogram/index.wxml'), `<view>${marker}</view>`)
  await fs.outputJson(path.join(packageRoot, 'miniprogram/index.json'), { component: true })
  return packageRoot
}

afterEach(async () => {
  await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  tempDirs.length = 0
})

describe.each(['explicit', 'legacy'] as const)('manual npm service resolution (%s)', (strategy) => {
  it('resolves from the manifest and each parent package while retaining project build paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-npm-manual-'))
    tempDirs.push(root)
    const manifestRoot = path.join(root, 'npm-config')
    const npmOutDir = path.join(root, 'published/miniprogram_npm')
    const mirrorOutDir = path.join(root, 'mirror/miniprogram_npm')
    await fs.outputJson(path.join(root, 'package.json'), { name: 'manual-npm-project', private: true })
    await fs.outputJson(path.join(manifestRoot, 'package.json'), {
      dependencies: {
        'mini-card': '1.0.0',
        'local-only': '1.0.0',
        'ancestor-card': '1.0.0',
      },
    })
    await writeNativePackage(root, 'mini-card', 'wrong project card')
    const cardRoot = await writeNativePackage(manifestRoot, 'mini-card', 'manifest local card', {
      'mini-child': '1.0.0',
    })
    await writeNativePackage(manifestRoot, 'local-only', 'manifest only dependency')
    await writeNativePackage(root, 'ancestor-card', 'ancestor fallback dependency')
    await writeNativePackage(root, 'mini-child', 'wrong project child')
    await writeNativePackage(cardRoot, 'mini-child', 'parent local child')

    const callbackPaths = new Map<string, { root: string | undefined, outDir: string | undefined }>()
    const buildOptions = vi.fn((options: NpmBuildOptions, { name }: { name: string }) => {
      callbackPaths.set(name, { root: options.root, outDir: options.build?.outDir })
      return options
    })
    const ctx = {
      configService: {
        cwd: root,
        outDir: path.join(root, 'dist'),
        platform: 'weapp',
        multiPlatform: { enabled: false },
        projectConfig: {
          miniprogramRoot: './dist',
          setting: {
            packNpmManually: true,
            packNpmRelationList: [
              { packageJsonPath: './npm-config/package.json', miniprogramNpmDistDir: './published' },
              { packageJsonPath: './npm-config/package.json', miniprogramNpmDistDir: './mirror' },
            ],
          },
        },
        weappViteConfig: { npm: { enable: true, strategy, buildOptions } },
      },
      scanService: { subPackageMap: new Map() },
    } as unknown as MutableCompilerContext
    const cache = {
      checkDependenciesCacheOutdate: vi.fn(async () => true),
      writeDependenciesCache: vi.fn(async () => {}),
    }
    const service = createNpmBuildService({ ctx, builder: createPackageBuilder(ctx), cache })

    await service.build()

    const expectedMarkers = {
      'mini-card': 'manifest local card',
      'local-only': 'manifest only dependency',
      'ancestor-card': 'ancestor fallback dependency',
      'mini-child': 'parent local child',
    }
    for (const [name, marker] of Object.entries(expectedMarkers)) {
      expect(await fs.readFile(path.join(npmOutDir, name, 'index.wxml'), 'utf8')).toBe(`<view>${marker}</view>`)
      expect(await fs.readFile(path.join(mirrorOutDir, name, 'index.wxml'), 'utf8')).toBe(`<view>${marker}</view>`)
      expect(callbackPaths.get(name)).toEqual({ root, outDir: path.join(npmOutDir, name) })
    }
    expect(buildOptions).toHaveBeenCalledTimes(4)
    expect(await fs.pathExists(path.join(manifestRoot, 'published'))).toBe(false)
    expect(cache.writeDependenciesCache).toHaveBeenCalledOnce()
  })
})
