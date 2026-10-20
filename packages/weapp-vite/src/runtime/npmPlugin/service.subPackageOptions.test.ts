import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPackageBuilder } from './builder'
import { createNpmBuildService } from './service/build'

const tempDirs: string[] = []
const packageName = 'native-card'
type BuildOptions = (options: NpmBuildOptions, meta: { name: string }) => NpmBuildOptions | false | void

async function writeNativePackage(installRoot: string, name: string, marker: string, dependencies: Record<string, string> = {}) {
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

async function createFixture(buildOptions: BuildOptions, dependencies = [packageName]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-npm-subpackage-options-'))
  tempDirs.push(root)
  const outDir = path.join(root, 'dist')
  await fs.outputJson(path.join(root, 'package.json'), {
    dependencies: { [packageName]: '1.0.0', 'unrelated-card': '1.0.0' },
  })
  const packageRoot = await writeNativePackage(root, packageName, 'selected card')
  await writeNativePackage(root, 'unrelated-card', 'unselected card')
  const ctx = {
    configService: {
      cwd: root,
      outDir,
      platform: 'weapp',
      multiPlatform: { enabled: false },
      projectConfig: {
        miniprogramRoot: './dist',
        setting: {
          packNpmManually: true,
          packNpmRelationList: [
            { packageJsonPath: './package.json', miniprogramNpmDistDir: './dist' },
            { packageJsonPath: './package.json', miniprogramNpmDistDir: './dist/mirror' },
          ],
        },
      },
      weappViteConfig: {
        npm: {
          enable: true,
          mainPackage: { dependencies: false },
          subPackages: { customized: { dependencies } },
          buildOptions,
        },
      },
    },
    scanService: {
      loadSubPackages: vi.fn(),
      subPackageMap: new Map([['customized', { subPackage: { root: 'customized', dependencies } }]]),
    },
  } as unknown as MutableCompilerContext
  let outdated = true
  const cache = {
    checkDependenciesCacheOutdate: vi.fn(async (_key?: string) => outdated),
    writeDependenciesCache: vi.fn(async (_key?: string) => {}),
  }
  const service = createNpmBuildService({ ctx, builder: createPackageBuilder(ctx), cache })
  return {
    root,
    outDir,
    packageRoot,
    service,
    cache,
    markFresh: () => {
      outdated = false
    },
  }
}

function relocateTarget(options: NpmBuildOptions) {
  const outDir = options.build?.outDir
  if (!outDir) {
    throw new Error('Expected the final logical npm target')
  }
  return { ...options, build: { ...options.build, outDir: path.resolve(outDir, '../../custom-components', path.basename(outDir)) } }
}

afterEach(async () => {
  await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  tempDirs.length = 0
})

describe('local subpackage npm buildOptions boundaries', () => {
  it('keeps a fresh relocated output and restores it when only the resolved output is missing', async () => {
    const buildOptions = vi.fn((options: NpmBuildOptions) => relocateTarget(options))
    const fixture = await createFixture(buildOptions)
    const customPackageOutDir = path.join(fixture.outDir, 'customized/custom-components', packageName)
    const componentPath = path.join(customPackageOutDir, 'index.wxml')
    const defaultNpmOutDir = path.join(fixture.outDir, 'customized/miniprogram_npm')
    await fixture.service.build()
    expect(await fs.readFile(componentPath, 'utf8')).toBe('<view>selected card</view>')
    expect(await fs.pathExists(defaultNpmOutDir)).toBe(false)

    await fs.writeFile(componentPath, '<view>retained cached output</view>')
    fixture.markFresh()
    await fixture.service.build()
    expect(await fs.readFile(componentPath, 'utf8')).toBe('<view>retained cached output</view>')
    expect(await fs.pathExists(defaultNpmOutDir)).toBe(false)

    await fs.remove(customPackageOutDir)
    await fixture.service.build()
    expect(await fs.readFile(componentPath, 'utf8')).toBe('<view>selected card</view>')
    expect(buildOptions).toHaveBeenCalledTimes(3)
    expect(fixture.cache.writeDependenciesCache.mock.calls.filter(([key]) => key === 'customized')).toHaveLength(3)
    expect(await fs.pathExists(path.join(fixture.root, '.weapp-vite/npm-source'))).toBe(false)
  })

  it('resolves selected transitive dependencies from their parent without building unrelated or shared-source targets', async () => {
    const targets: Array<{ name: string, outDir: string | undefined }> = []
    const fixture = await createFixture((options, { name }) => {
      targets.push({ name, outDir: options.build?.outDir })
      return relocateTarget(options)
    })
    await fs.outputJson(path.join(fixture.packageRoot, 'package.json'), {
      name: packageName,
      version: '1.0.0',
      main: 'miniprogram/index.js',
      miniprogram: 'miniprogram',
      dependencies: { 'native-child': '1.0.0' },
    })
    await writeNativePackage(fixture.root, 'native-child', 'wrong root child')
    await writeNativePackage(fixture.packageRoot, 'native-child', 'parent local child')

    await fixture.service.build()

    for (const [name, marker] of Object.entries({ [packageName]: 'selected card', 'native-child': 'parent local child' })) {
      const componentPath = path.join(fixture.outDir, 'customized/custom-components', name, 'index.wxml')
      expect(await fs.readFile(componentPath, 'utf8')).toBe(`<view>${marker}</view>`)
      expect(targets.filter(target => target.name === name)).toEqual([
        { name, outDir: path.join(fixture.outDir, 'customized/miniprogram_npm', name) },
      ])
    }
    expect(targets).toHaveLength(2)
    expect(await fs.pathExists(path.join(fixture.outDir, 'miniprogram_npm'))).toBe(false)
    expect(await fs.pathExists(path.join(fixture.outDir, 'customized/custom-components/unrelated-card'))).toBe(false)
    expect(await fs.pathExists(path.join(fixture.root, '.weapp-vite/npm-source'))).toBe(false)
  })

  it('honors a skipped subpackage target without copying a fallback from another output', async () => {
    const buildOptions = vi.fn(() => false as const)
    const fixture = await createFixture(buildOptions)

    await fixture.service.build()

    expect(buildOptions).toHaveBeenCalledOnce()
    expect(await fs.pathExists(path.join(fixture.outDir, 'customized/miniprogram_npm', packageName))).toBe(false)
    expect(await fs.pathExists(path.join(fixture.root, '.weapp-vite/npm-source'))).toBe(false)
    expect(fixture.cache.writeDependenciesCache).toHaveBeenCalledWith('customized')
  })

  it('cleans empty configured targets and disabled main mirrors without invoking buildOptions', async () => {
    const buildOptions = vi.fn((options: NpmBuildOptions) => relocateTarget(options))
    const fixture = await createFixture(buildOptions, [])
    const npmTargets = ['miniprogram_npm', 'mirror/miniprogram_npm', 'customized/miniprogram_npm']
    for (const target of npmTargets) {
      await fs.outputFile(path.join(fixture.outDir, target, 'stale.js'), 'stale output')
    }

    await fixture.service.build()

    for (const target of npmTargets) {
      expect(await fs.pathExists(path.join(fixture.outDir, target))).toBe(false)
    }
    expect(buildOptions).not.toHaveBeenCalled()
    expect(fixture.cache.writeDependenciesCache).toHaveBeenCalledWith('customized')
    expect(await fs.pathExists(path.join(fixture.root, '.weapp-vite/npm-source'))).toBe(false)
  })
})
