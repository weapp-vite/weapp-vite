// https://cn.vitejs.dev/guide/build.html#library-mode
// miniprogram_dist
// miniprogram

import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { ConfigService, ScanService } from '.'
import type { NpmBuildOptions } from '../../types'
import { isBuiltin } from 'node:module'
import { defu, isObject, objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import { getPackageInfo, resolveModule } from 'local-pkg'
import path from 'pathe'
import { regExpTest } from '../../utils'
import { debug, logger } from '../shared'
import { Symbols } from '../Symbols'

@injectable()
// https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
export class NpmService {
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
    @inject(Symbols.ScanService)
    private readonly scanService: ScanService,
  ) {

  }

  getDependenciesCacheFilePath(key: string = '/') {
    return path.resolve(this.configService.cwd, `node_modules/weapp-vite/.cache/${key.replaceAll('/', '-')}.json`)
  }

  get dependenciesCacheHash() {
    return objectHash(this.configService.packageJson.dependencies ?? {})
  }

  isMiniprogramPackage(pkg: PackageJson) {
    return Reflect.has(pkg, 'miniprogram') && typeof pkg.miniprogram === 'string'
  }

  async shouldSkipBuild(outDir: string, isOutdated: boolean) {
    return !isOutdated && await fs.exists(outDir)
  }

  writeDependenciesCache(root?: string) {
    if (this.configService.weappViteConfig?.npm?.cache) {
      return fs.outputJSON(this.getDependenciesCacheFilePath(root), {
        hash: this.dependenciesCacheHash,
      })
    }
  }

  async readDependenciesCache(root?: string) {
    const cachePath = this.getDependenciesCacheFilePath(root)
    if (await fs.exists(cachePath)) {
      return await fs.readJson(cachePath, { throws: false })
    }
  }

  async checkDependenciesCacheOutdate(root?: string) {
    if (this.configService.weappViteConfig?.npm?.cache) {
      const json = await this.readDependenciesCache(root)
      if (isObject(json)) {
        return this.dependenciesCacheHash !== json.hash
      }
      // 过期
      return true
    }
    // 过期
    return true
  }

  async bundleBuild({ entry, name, options, outDir }: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) {
    const { build: tsdownBuild } = await import('tsdown')
    const mergedOptions: NpmBuildOptions = defu<NpmBuildOptions, NpmBuildOptions[]>(options, {
      entry,
      format: ['cjs'],
      outDir,
      silent: true,
      shims: true,
      outExtensions: () => {
        return {
          js: '.js',
        }
      },
      outputOptions: {
        exports: 'named',
      },
      sourcemap: false,
      config: false,
      // https://tsup.egoist.dev/#compile-time-environment-variables
      env: {
        NODE_ENV: 'production',
      },
      minify: true,
      target: 'es6',
      external: [],
      // clean: false,
    })
    const resolvedOptions = this.configService.weappViteConfig?.npm?.buildOptions?.(
      mergedOptions,
      { name, entry },
    )
    let finalOptions: NpmBuildOptions | undefined
    if (resolvedOptions === undefined) {
      finalOptions = mergedOptions
    }
    else if (isObject(resolvedOptions)) {
      finalOptions = resolvedOptions
    }
    if (finalOptions) {
      await tsdownBuild(finalOptions)
    }
  }

  async copyBuild({ from, to }: { from: string, to: string, name: string }) {
    await fs.copy(
      from,
      to,
    )
  }

  async buildPackage(
    { dep, outDir, options, isDependenciesCacheOutdate }:
      { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean },
  ) {
    const packageInfo = await getPackageInfo(dep)
    if (!packageInfo) {
      return
    }
    const { packageJson: targetJson, rootPath } = packageInfo
    const dependencies = targetJson.dependencies ?? {}
    const keys = Object.keys(dependencies)
    // 判断是否 packageJson 有 "miniprogram": "xxx", 这样的 kv
    const destOutDir = path.resolve(outDir, dep)
    if (await this.shouldSkipBuild(destOutDir, isDependenciesCacheOutdate)) {
      logger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
      return
    }
    if (this.isMiniprogramPackage(targetJson)) {
      await this.copyBuild(
        {
          from: path.resolve(
            rootPath,
            targetJson.miniprogram,
          ),
          to: destOutDir,
          name: dep,
        },
      )
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
              },
            )
          }),
        )
      }
    }
    else {
      const index = resolveModule(dep)
      if (!index) {
        logger.warn(`[npm] 无法解析模块 \`${dep}\`，跳过处理!`)
        return
      }
      await this.bundleBuild(
        {
          entry: {
            index,
          },
          name: dep,
          options,
          outDir: destOutDir,
        },
      )
      if (keys.length > 0) {
        await Promise.all(
          keys.filter(x => isBuiltin(x)).map((x) => {
            return this.buildPackage(
              {
                dep: `${x}/`,
                // 这里需要打包到 miniprogram_npm 平级目录
                outDir,
                options,
                isDependenciesCacheOutdate,
              },
            )
          }),
        )
      }
    }

    logger.success(`[npm] \`${dep}\` 依赖处理完成!`)
  }

  getPackNpmRelationList() {
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
    return packNpmRelationList
  }

  async build(options?: NpmBuildOptions) {
    if (!this.configService.weappViteConfig?.npm?.enable) {
      return
    }

    debug?.('buildNpm start')

    const packNpmRelationList = this.getPackNpmRelationList()
    const [mainRelation, ...subRelations] = packNpmRelationList
    const packageJsonPath = path.resolve(this.configService.cwd, mainRelation.packageJsonPath)
    if (await fs.exists(packageJsonPath)) {
      const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
      const outDir = path.resolve(this.configService.cwd, mainRelation.miniprogramNpmDistDir, 'miniprogram_npm')
      if (pkgJson.dependencies) {
        const dependencies = Object.keys(pkgJson.dependencies)
        if (dependencies.length > 0) {
          const isDependenciesCacheOutdate = await this.checkDependenciesCacheOutdate()

          await Promise.all(
            dependencies.map((dep) => {
              return this.buildPackage(
                {
                  dep,
                  outDir,
                  options,
                  isDependenciesCacheOutdate,
                },
              )
            }),
          )
          await this.writeDependenciesCache()

          const targetDirs: {
            npmDistDir: string
            root?: string
            dependencies?: (string | RegExp)[]
          }[] = [
            ...subRelations.map((x) => {
              return {
                npmDistDir: path.resolve(this.configService.cwd, x.miniprogramNpmDistDir, 'miniprogram_npm'),
              }
            }),
            ...[...this.scanService.independentSubPackageMap.values()].map((x) => {
              const dependencies = x.subPackage.dependencies

              return {
                root: x.subPackage.root,
                dependencies,
                npmDistDir: path.resolve(this.configService.cwd, mainRelation.miniprogramNpmDistDir, x.subPackage.root, 'miniprogram_npm'),
              }
            }),
          ]
          await Promise.all(targetDirs.map(async (x) => {
            if (x.root) {
              const isDependenciesCacheOutdate = await this.checkDependenciesCacheOutdate(x.root)
              if (isDependenciesCacheOutdate || !(await fs.exists(x.npmDistDir))) {
                await fs.copy(outDir, x.npmDistDir, {
                  overwrite: true,
                  filter: (src) => {
                    if (Array.isArray(x.dependencies)) {
                      const relPath = path.relative(outDir, src)
                      if (relPath === '') {
                        return true
                      }
                      return regExpTest(x.dependencies, relPath)
                    }
                    return true
                  },
                })
              }
              await this.writeDependenciesCache(x.root)
            }
            else {
              await fs.copy(outDir, x.npmDistDir, {
                overwrite: true,
                filter: (src) => {
                  if (Array.isArray(x.dependencies)) {
                    const relPath = path.relative(outDir, src)
                    if (relPath === '') {
                      return true
                    }
                    return regExpTest(x.dependencies, relPath)
                  }
                  return true
                },
              })
            }
          }))
        }
      }
    }

    // if (Array.isArray(subPackage?.dependencies)) {
    //   if (!regExpTest(subPackage.dependencies, dep)) {
    //     continue
    //   }
    // }

    debug?.('buildNpm end')
  }
}
