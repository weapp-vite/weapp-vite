// https://cn.vitejs.dev/guide/build.html#library-mode
// miniprogram_dist
// miniprogram

import type { SubPackage, TsupOptions } from '@/types'
import type { PackageJson } from 'pkg-types'
import type { ConfigService } from '.'
import { regExpTest } from '@/utils'
import { defu, isObject, objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import { getPackageInfo, resolveModule } from 'local-pkg'
import path from 'pathe'
import { debug, logger } from '../shared'
import { Symbols } from '../Symbols'

@injectable()
// https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
export class NpmService {
  // 分包的情况也要考虑
  builtDepSetMap: Map<string | symbol, Set<string>> = new Map()
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
  ) {

  }

  get dependenciesCacheFilePath() {
    return path.resolve(this.configService.cwd, 'node_modules/weapp-vite/.cache/npm.json')
  }

  get dependenciesCacheHash() {
    return objectHash(this.configService.packageJson.dependencies ?? {})
  }

  writeDependenciesCache() {
    return fs.outputJSON(this.dependenciesCacheFilePath, {
      '/': this.dependenciesCacheHash,
    })
  }

  async readDependenciesCache() {
    if (await fs.exists(this.dependenciesCacheFilePath)) {
      return await fs.readJson(this.dependenciesCacheFilePath, { throws: false })
    }
  }

  async checkDependenciesCacheOutdate() {
    const json = await this.readDependenciesCache()
    if (isObject(json)) {
      return this.dependenciesCacheHash !== json['/']
    }
    return true
  }

  async bundleBuild({ index, name, options, outDir, subPackage }: { index: string, name: string, options?: TsupOptions, outDir: string, subPackage?: SubPackage }) {
    const builtSet = this.builtDepSetMap.get(subPackage?.root ?? Symbols.NpmMainPackageBuiltDepToken) ?? new Set()
    if (builtSet.has(name)) {
      return
    }
    const { build: tsupBuild } = await import('tsup')
    const mergedOptions: TsupOptions = defu<TsupOptions, TsupOptions[]>(options, {
      entry: {
        index,
      },
      format: ['cjs'],
      outDir,
      silent: true,
      shims: true,
      outExtension: () => {
        return {
          js: '.js',
        }
      },
      sourcemap: false,
      config: false,
      // https://tsup.egoist.dev/#compile-time-environment-variables
      env: {
        NODE_ENV: 'production',
      },
      minify: true,
      target: 'es6',
      // external: [],
      // clean: false,
    })
    const resolvedOptions = this.configService.weappViteConfig?.npm?.tsup?.(mergedOptions, { entry: index, name })
    let finalOptions: TsupOptions | undefined
    if (resolvedOptions === undefined) {
      finalOptions = mergedOptions
    }
    else if (isObject(resolvedOptions)) {
      finalOptions = resolvedOptions
    }
    if (finalOptions) {
      await tsupBuild(finalOptions)
      builtSet.add(name)
    }
  }

  async copyBuild({ from, to, name, subPackage }: { from: string, to: string, name: string, subPackage?: SubPackage }) {
    const builtSet = this.builtDepSetMap.get(subPackage?.root ?? Symbols.NpmMainPackageBuiltDepToken) ?? new Set()
    if (builtSet.has(name)) {
      return
    }
    await fs.copy(
      from,
      to,
    )
    builtSet.add(name)
  }

  async buildPackage(
    { dep, outDir, options, isDependenciesCacheOutdate, heading, subPackage }:
      { dep: string, outDir: string, options?: TsupOptions, isDependenciesCacheOutdate: boolean, heading: string, subPackage?: SubPackage },
  ) {
    const packageInfo = await getPackageInfo(dep)
    if (!packageInfo) {
      return
    }
    const { packageJson: targetJson, rootPath } = packageInfo
    // 判断是否 packageJson 有 "miniprogram": "xxx", 这样的 kv
    if (Reflect.has(targetJson, 'miniprogram') && targetJson.miniprogram) {
      const destOutDir = path.join(outDir, dep)
      if (!isDependenciesCacheOutdate && await fs.exists(destOutDir)) {
        logger.info(`${heading} ${dep} 依赖未发生变化，跳过处理!`)
        return
      }
      await this.copyBuild(
        {
          from: path.resolve(
            rootPath,
            targetJson.miniprogram,
          ),
          to: destOutDir,
          name: dep,
          subPackage,
        },
      )
      const dependencies = targetJson.dependencies ?? {}
      const keys = Object.keys(dependencies)
      if (keys.length > 0) {
        await Promise.all(
          keys.map((x) => {
            return this.buildPackage(
              {
                dep: x,
                // 这里需要打包到 miniprogram_npm 平级目录
                outDir,
                options,
                isDependenciesCacheOutdate,
                heading,
                subPackage,
              },
            )
          }),
        )
      }
    }
    else {
      const destOutDir = path.join(outDir, dep)
      if (!isDependenciesCacheOutdate && await fs.exists(destOutDir)) {
        logger.info(`${heading} ${dep} 依赖未发生变化，跳过处理!`)
        return
      }
      const index = resolveModule(dep)
      if (!index) {
        return
      }
      await this.bundleBuild(
        {
          index,
          name: dep,
          options,
          outDir: destOutDir,
          subPackage,
        },
      )
    }
    logger.success(`${heading} ${dep} 依赖处理完成!`)
  }

  async build(subPackage?: SubPackage, options?: TsupOptions) {
    // this.builtDepSetMap.clear()
    debug?.('buildNpm start')
    const isDependenciesCacheOutdate = await this.checkDependenciesCacheOutdate()

    let packNpmRelationList: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[] = []
    if (this.configService.projectConfig.setting?.packNpmManually && Array.isArray(this.configService.projectConfig.setting.packNpmRelationList)) {
      packNpmRelationList = this.configService.projectConfig.setting.packNpmRelationList
    }
    else {
      packNpmRelationList = [
        {
          miniprogramNpmDistDir: '.',
          packageJsonPath: './package.json',
        },
      ]
    }
    const heading = subPackage?.root ? `分包[${subPackage.root}]:` : ''
    if (subPackage && subPackage.root) {
      this.builtDepSetMap.set(subPackage.root, new Set())
    }
    else {
      this.builtDepSetMap.set(Symbols.NpmMainPackageBuiltDepToken, new Set())
    }
    for (const relation of packNpmRelationList) {
      const packageJsonPath = path.resolve(this.configService.cwd, relation.packageJsonPath)
      if (await fs.exists(packageJsonPath)) {
        const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
        const outDir = path.resolve(this.configService.cwd, relation.miniprogramNpmDistDir, subPackage?.root ?? '', 'miniprogram_npm')
        if (pkgJson.dependencies) {
          const dependencies = Object.keys(pkgJson.dependencies)
          if (dependencies.length > 0) {
            for (const dep of dependencies) {
              if (Array.isArray(subPackage?.dependencies)) {
                if (!regExpTest(subPackage.dependencies, dep)) {
                  continue
                }
              }
              await this.buildPackage(
                {
                  dep,
                  outDir,
                  options,
                  isDependenciesCacheOutdate,
                  heading,
                  subPackage,
                },
              )
            }
          }
        }
      }
    }
    await this.writeDependenciesCache()
    debug?.('buildNpm end')
  }
}
