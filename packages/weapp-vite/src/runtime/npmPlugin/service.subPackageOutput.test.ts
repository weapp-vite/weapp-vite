import type { CompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import type { PreparedNpmOutput } from '../../vite/npm'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareNpmAssets } from '../../vite/npm'
import { createPackageBuilder } from './builder'
import { createNpmBuildService } from './service/build'

const tempDirs: string[] = []
const packageName = 'native-card'
const componentSources = {
  js: 'Component({ data: { marker: "npm-output-marker" } })\n',
  json: '{"component":true}',
  wxml: '<view>npm-output-marker</view>',
  wxss: 'view { color: #123456; }',
}

afterEach(async () => {
  await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  tempDirs.length = 0
})

describe.each(['cli', 'vite'] as const)('local subpackage npm output (%s)', (host) => {
  it('applies buildOptions to the final subpackage target and resolves component references to its contents', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-npm-subpackage-output-'))
    tempDirs.push(root)
    const outDir = path.join(root, 'dist')
    const defaultPackageOutDir = path.join(outDir, 'customized/miniprogram_npm', packageName)
    const customPackageOutDir = path.join(outDir, 'customized/custom-components', packageName)
    const packageRoot = path.join(root, 'node_modules', packageName)
    await fs.outputJson(path.join(root, 'package.json'), { dependencies: { [packageName]: '1.0.0' } })
    await fs.outputJson(path.join(packageRoot, 'package.json'), {
      name: packageName,
      version: '1.0.0',
      main: 'miniprogram/button/button.js',
      miniprogram: 'miniprogram',
    })
    for (const [extension, source] of Object.entries(componentSources)) {
      await fs.outputFile(path.join(packageRoot, 'miniprogram/button', `button.${extension}`), source)
    }

    const callbackTargets: Array<{ root?: string, outDir?: string }> = []
    const buildOptions = (options: NpmBuildOptions, { name }: { name: string }) => {
      callbackTargets.push({ root: options.root, outDir: options.build?.outDir })
      if (name === packageName && options.build?.outDir === defaultPackageOutDir) {
        return { ...options, build: { ...options.build, outDir: customPackageOutDir } }
      }
      return options
    }
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
              { packageJsonPath: './package.json', miniprogramNpmDistDir: './dist/manual-output' },
            ],
          },
        },
        weappViteConfig: {
          npm: { enable: true, subPackages: { customized: { dependencies: [packageName] } }, buildOptions },
        },
      },
      scanService: {
        loadSubPackages: vi.fn(),
        subPackageMap: new Map([['customized', { subPackage: { root: 'customized', dependencies: [packageName] } }]]),
      },
    } as unknown as CompilerContext
    let prepared: PreparedNpmOutput | undefined
    if (host === 'vite') {
      prepared = await prepareNpmAssets(ctx)
      expect(prepared.external.size).toBe(0)
    }
    else {
      const service = createNpmBuildService({
        ctx,
        builder: createPackageBuilder(ctx),
        cache: {
          checkDependenciesCacheOutdate: vi.fn(async () => true),
          writeDependenciesCache: vi.fn(async () => {}),
        },
      })
      await service.build()
    }

    expect(callbackTargets).toContainEqual({ root, outDir: defaultPackageOutDir })
    const readOutput = async (fileName: string) => {
      if (!prepared) {
        return await fs.readFile(path.join(outDir, fileName), 'utf8')
      }
      const asset = prepared.assets.find(item => item.fileName === fileName)
      expect(asset, fileName).toBeDefined()
      return typeof asset!.source === 'string' ? asset!.source : new TextDecoder().decode(asset!.source)
    }
    // 与真实 IDE fixture 相同：分包引用回调输出，手工关联引用主 npm 目录的镜像。
    const usingComponents = {
      'callback-button': `/customized/custom-components/${packageName}/button/button`,
      'mapped-button': `/manual-output/miniprogram_npm/${packageName}/button/button`,
    }
    expect(path.join(outDir, usingComponents['callback-button'].slice(1))).toBe(path.join(customPackageOutDir, 'button/button'))
    for (const componentPath of [...Object.values(usingComponents), `/miniprogram_npm/${packageName}/button/button`]) {
      for (const [extension, source] of Object.entries(componentSources)) {
        expect(await readOutput(`${componentPath.slice(1)}.${extension}`)).toBe(source)
      }
    }
    const obsoleteFile = path.relative(outDir, path.join(defaultPackageOutDir, 'button/button.js'))
    const hasObsoleteFile = prepared
      ? prepared.assets.some(item => item.fileName === obsoleteFile)
      : await fs.pathExists(path.join(outDir, obsoleteFile))
    expect(hasObsoleteFile).toBe(false)
  })
})
