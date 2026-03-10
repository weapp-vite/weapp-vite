import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import fs from 'fs-extra'
import path from 'pathe'
import { debug } from '../../context/shared'
import { regExpTest } from '../../utils'
import { getAlipayNpmDistDirName } from '../../utils/alipayNpm'
import { toPosixPath } from '../../utils/path'
import { createOxcRuntimeSupport } from '../oxcRuntime'
import { createPackageBuilder } from './builder'
import { createDependenciesCache } from './cache'
import { getPackNpmRelationList } from './relations'

function matchDependencyName(patterns: (string | RegExp)[], dep: string) {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return pattern === dep
    }

    pattern.lastIndex = 0
    return pattern.test(dep)
  })
}

function resolveTargetDependencies(
  allDependencies: string[],
  patterns?: false | (string | RegExp)[],
) {
  if (patterns === false) {
    return []
  }

  if (!Array.isArray(patterns)) {
    return allDependencies
  }

  const selected = new Set<string>()
  for (const dep of allDependencies) {
    if (matchDependencyName(patterns, dep)) {
      selected.add(dep)
    }
  }

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      selected.add(pattern)
    }
  }

  return [...selected]
}

function hasSameDependencySet(source: string[], target: string[]) {
  if (source.length !== target.length) {
    return false
  }

  return source.every(dep => target.includes(dep))
}

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

  function getNpmDistDirName() {
    if (ctx.configService?.platform === 'alipay') {
      return getAlipayNpmDistDirName(ctx.configService.weappViteConfig?.npm?.alipayNpmMode)
    }
    return 'miniprogram_npm'
  }

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
      const npmDistDirName = getNpmDistDirName()
      const outDir = path.resolve(ctx.configService.cwd, mainRelation.miniprogramNpmDistDir, npmDistDirName)
      const cachedSourceOutDir = path.resolve(ctx.configService.cwd, 'node_modules/weapp-vite/.cache/npm-source', npmDistDirName)
      if (pkgJson.dependencies) {
        const allDependencies = Object.keys(pkgJson.dependencies)
        const mainDependencyPatterns = ctx.configService.weappViteConfig?.npm?.mainPackageDependencies
        const mainDependencies = resolveTargetDependencies(allDependencies, mainDependencyPatterns)
        const sourceOutDir = hasSameDependencySet(allDependencies, mainDependencies) ? outDir : cachedSourceOutDir

        const buildTargetDependencies = async (args: {
          dependencies: string[]
          npmDistDir: string
          cacheKey?: string
        }) => {
          const isDependenciesCacheOutdate = await cache.checkDependenciesCacheOutdate(args.cacheKey)
          if (isDependenciesCacheOutdate) {
            await fs.remove(args.npmDistDir)
          }

          if (args.dependencies.length === 0) {
            await fs.remove(args.npmDistDir)
            await cache.writeDependenciesCache(args.cacheKey)
            return
          }

          await Promise.all(
            args.dependencies.map((dep) => {
              return builder.buildPackage({
                dep,
                outDir: args.npmDistDir,
                options,
                isDependenciesCacheOutdate,
              })
            }),
          )

          await cache.writeDependenciesCache(args.cacheKey)
        }

        if (sourceOutDir !== outDir) {
          await buildTargetDependencies({
            cacheKey: '__all__',
            dependencies: allDependencies,
            npmDistDir: sourceOutDir,
          })
        }

        await buildTargetDependencies({
          dependencies: mainDependencies,
          npmDistDir: outDir,
        })

        if (mainDependencies.length === 0) {
          await Promise.all(subRelations.map((relation) => {
            return fs.remove(path.resolve(ctx.configService!.cwd, relation.miniprogramNpmDistDir, npmDistDirName))
          }))
        }
        else {
          await Promise.all(subRelations.map(async (relation) => {
            const targetDir = path.resolve(ctx.configService!.cwd, relation.miniprogramNpmDistDir, npmDistDirName)
            await fs.remove(targetDir)
            await fs.copy(outDir, targetDir, {
              overwrite: true,
            })
          }))
        }

        await Promise.all(Array.from(ctx.scanService!.independentSubPackageMap.values(), async (meta) => {
          const targetDir = path.resolve(ctx.configService!.cwd, mainRelation.miniprogramNpmDistDir, meta.subPackage.root, npmDistDirName)
          const isDependenciesCacheOutdate = await cache.checkDependenciesCacheOutdate(meta.subPackage.root)
          if (isDependenciesCacheOutdate || !(await fs.pathExists(targetDir))) {
            await fs.remove(targetDir)
            await fs.copy(sourceOutDir, targetDir, {
              overwrite: true,
              filter: (src) => {
                if (Array.isArray(meta.subPackage.dependencies)) {
                  const relPath = toPosixPath(path.relative(sourceOutDir, src))
                  if (relPath === '') {
                    return true
                  }
                  return regExpTest(meta.subPackage.dependencies, relPath)
                }
                return true
              },
            })
          }
          await cache.writeDependenciesCache(meta.subPackage.root)
        }))
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
