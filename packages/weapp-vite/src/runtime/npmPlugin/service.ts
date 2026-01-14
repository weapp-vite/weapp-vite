import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import fs from 'fs-extra'
import path from 'pathe'
import { debug } from '../../context/shared'
import { regExpTest } from '../../utils'
import { createOxcRuntimeSupport } from '../oxcRuntime'
import { createPackageBuilder } from './builder'
import { createDependenciesCache } from './cache'
import { getPackNpmRelationList } from './relations'

export interface NpmService {
  getDependenciesCacheFilePath: (key?: string) => string
  readonly dependenciesCacheHash: string
  isMiniprogramPackage: (pkg: PackageJson) => boolean
  shouldSkipBuild: (outDir: string, isOutdated: boolean) => Promise<boolean>
  writeDependenciesCache: (root?: string) => Promise<void>
  readDependenciesCache: (root?: string) => Promise<any>
  checkDependenciesCacheOutdate: (root?: string) => Promise<boolean>
  bundleBuild: (args: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) => Promise<void>
  copyBuild: (args: { from: string, to: string, name: string }) => Promise<void>
  buildPackage: (args: { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean }) => Promise<void>
  getPackNpmRelationList: () => { packageJsonPath: string, miniprogramNpmDistDir: string }[]
  build: (options?: NpmBuildOptions) => Promise<void>
}

export function createNpmService(ctx: MutableCompilerContext): NpmService {
  const oxcRuntimeSupport = createOxcRuntimeSupport()
  const oxcVitePlugin = oxcRuntimeSupport.vitePlugin
  const cache = createDependenciesCache(ctx)
  const builder = createPackageBuilder(ctx, oxcVitePlugin as Plugin | undefined)

  async function build(options?: NpmBuildOptions) {
    if (!ctx.configService?.weappViteConfig?.npm?.enable) {
      return
    }

    debug?.('buildNpm start')

    const packNpmRelationList = getPackNpmRelationList(ctx)
    const [mainRelation, ...subRelations] = packNpmRelationList
    const packageJsonPath = path.resolve(ctx.configService.cwd, mainRelation.packageJsonPath)
    if (await fs.pathExists(packageJsonPath)) {
      const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
      const outDir = path.resolve(ctx.configService.cwd, mainRelation.miniprogramNpmDistDir, 'miniprogram_npm')
      if (pkgJson.dependencies) {
        const dependencies = Object.keys(pkgJson.dependencies)
        if (dependencies.length > 0) {
          const isDependenciesCacheOutdate = await cache.checkDependenciesCacheOutdate()

          await Promise.all(
            dependencies.map((dep) => {
              return builder.buildPackage({
                dep,
                outDir,
                options,
                isDependenciesCacheOutdate,
              })
            }),
          )
          await cache.writeDependenciesCache()

          const targetDirs: {
            npmDistDir: string
            root?: string
            dependencies?: (string | RegExp)[]
          }[] = [
            ...subRelations.map((x) => {
              return {
                npmDistDir: path.resolve(ctx.configService!.cwd, x.miniprogramNpmDistDir, 'miniprogram_npm'),
              }
            }),
            ...[...ctx.scanService!.independentSubPackageMap.values()].map((x) => {
              const dependencies = x.subPackage.dependencies

              return {
                root: x.subPackage.root,
                dependencies,
                npmDistDir: path.resolve(ctx.configService!.cwd, mainRelation.miniprogramNpmDistDir, x.subPackage.root, 'miniprogram_npm'),
              }
            }),
          ]
          await Promise.all(targetDirs.map(async (x) => {
            if (x.root) {
              const isDependenciesCacheOutdate = await cache.checkDependenciesCacheOutdate(x.root)
              if (isDependenciesCacheOutdate || !(await fs.pathExists(x.npmDistDir))) {
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
              await cache.writeDependenciesCache(x.root)
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

    debug?.('buildNpm end')
  }

  return {
    getDependenciesCacheFilePath: cache.getDependenciesCacheFilePath,
    get dependenciesCacheHash() {
      return cache.dependenciesCacheHash()
    },
    isMiniprogramPackage: builder.isMiniprogramPackage,
    shouldSkipBuild: builder.shouldSkipBuild,
    writeDependenciesCache: cache.writeDependenciesCache,
    readDependenciesCache: cache.readDependenciesCache,
    checkDependenciesCacheOutdate: cache.checkDependenciesCacheOutdate,
    bundleBuild: builder.bundleBuild,
    copyBuild: builder.copyBuild,
    buildPackage: builder.buildPackage,
    getPackNpmRelationList: () => getPackNpmRelationList(ctx),
    build,
  }
}
