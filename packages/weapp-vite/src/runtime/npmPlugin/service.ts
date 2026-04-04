import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import { win32 as pathWin32, relative as relativeNative } from 'node:path'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { debug } from '../../context/shared'
import { getPlatformNpmDistDirName } from '../../platform'
import { resolveNpmDependencyId } from '../../utils/npmImport'
import { normalizePath, toPosixPath } from '../../utils/path'
import { createOxcRuntimeSupport } from '../oxcRuntime'
import { createPackageBuilder } from './builder'
import { createDependenciesCache } from './cache'
import { getPackNpmRelationList } from './relations'

const LEADING_SLASHES_RE = /^\/+/
const WINDOWS_PATH_RE = /\\|^[A-Z]:[\\/]/i
const TRAILING_SLASHES_RE = /\/+$/

function matchDependencyName(patterns: (string | RegExp)[], dep: string) {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return pattern === dep
    }

    pattern.lastIndex = 0
    return pattern.test(dep)
  })
}

function matchDependencyPath(patterns: (string | RegExp)[], value: string) {
  const dependencyId = resolveNpmDependencyId(toPosixPath(value).replace(LEADING_SLASHES_RE, ''))
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return dependencyId === pattern || value === pattern || value.startsWith(`${pattern}/`)
    }

    pattern.lastIndex = 0
    if (pattern.test(dependencyId)) {
      return true
    }

    pattern.lastIndex = 0
    return pattern.test(value)
  })
}

export function resolveCopyFilterRelativePath(sourceRoot: string, sourcePath: string) {
  const normalizedRoot = normalizePath(sourceRoot).replace(TRAILING_SLASHES_RE, '')
  const normalizedPath = normalizePath(sourcePath)
  if (normalizedPath === normalizedRoot) {
    return ''
  }
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1)
  }

  const relativePath = WINDOWS_PATH_RE.test(sourceRoot) || WINDOWS_PATH_RE.test(sourcePath)
    ? pathWin32.relative(sourceRoot, sourcePath)
    : relativeNative(sourceRoot, sourcePath)

  return toPosixPath(relativePath)
}

export function resolveTargetDependencies(
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

function resolveMainPackageDependencyPatterns(ctx: MutableCompilerContext) {
  return ctx.configService?.weappViteConfig?.npm?.mainPackage?.dependencies
}

function resolvePluginPackageDependencyPatterns(ctx: MutableCompilerContext) {
  return ctx.configService?.weappViteConfig?.npm?.pluginPackage?.dependencies
}

export function hasLocalSubPackageNpmConfig(ctx: MutableCompilerContext) {
  const npmSubPackages = ctx.configService?.weappViteConfig?.npm?.subPackages
  if (npmSubPackages && Object.values(npmSubPackages).some(config => Array.isArray(config?.dependencies) && config.dependencies.length > 0)) {
    return true
  }
  return false
}

export function resolveNpmDistDirName(configService?: MutableCompilerContext['configService']) {
  if (configService?.platform) {
    return getPlatformNpmDistDirName(configService.platform, {
      alipayNpmMode: configService.weappViteConfig?.npm?.alipayNpmMode,
    })
  }
  return getPlatformNpmDistDirName('weapp')
}

export function resolveNpmSourceCacheOutDir(cwd: string, npmDistDirName: string) {
  return path.resolve(cwd, '.weapp-vite/npm-source', npmDistDirName)
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

  async function build(options?: NpmBuildOptions) {
    if (!ctx.configService?.weappViteConfig?.npm?.enable) {
      return
    }

    debug?.('buildNpm start')

    if (ctx.scanService && hasLocalSubPackageNpmConfig(ctx) && typeof ctx.scanService.loadAppEntry === 'function') {
      await ctx.scanService.loadAppEntry()
      if (typeof ctx.scanService.loadSubPackages === 'function') {
        ctx.scanService.loadSubPackages()
      }
    }

    const packNpmRelationList = getPackNpmRelationList(ctx)
    const [mainRelation, ...subRelations] = packNpmRelationList
    const packageJsonPath = path.resolve(ctx.configService.cwd, mainRelation.packageJsonPath)
    if (await fs.pathExists(packageJsonPath)) {
      const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
      const npmDistDirName = resolveNpmDistDirName(ctx.configService)
      const outDir = path.resolve(ctx.configService.cwd, mainRelation.miniprogramNpmDistDir, npmDistDirName)
      const cachedSourceOutDir = resolveNpmSourceCacheOutDir(ctx.configService.cwd, npmDistDirName)
      const localSubPackageOutRoot = ctx.configService.outDir || path.resolve(ctx.configService.cwd, mainRelation.miniprogramNpmDistDir)
      if (pkgJson.dependencies) {
        const allDependencies = Object.keys(pkgJson.dependencies)
        const mainDependencyPatterns = ctx.configService.pluginOnly
          ? resolvePluginPackageDependencyPatterns(ctx)
          : resolveMainPackageDependencyPatterns(ctx)
        const mainDependencies = resolveTargetDependencies(allDependencies, mainDependencyPatterns)
        const sourceOutDir = hasSameDependencySet(allDependencies, mainDependencies) ? outDir : cachedSourceOutDir
        const localSubPackageMetas = [...ctx.scanService?.subPackageMap.values() ?? []]
          .filter(meta => Array.isArray(meta.subPackage.dependencies) && meta.subPackage.dependencies.length > 0)

        const buildTargetDependencies = async (args: {
          dependencies: string[]
          npmDistDir: string
          cacheKey?: string
        }) => {
          const isNpmDistMissing = !(await fs.pathExists(args.npmDistDir))
          const isDependenciesCacheOutdate = isNpmDistMissing || await cache.checkDependenciesCacheOutdate(args.cacheKey)
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
          cacheKey: ctx.configService.pluginOnly ? '__plugin__' : undefined,
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

        for (const meta of localSubPackageMetas) {
          const targetDir = path.resolve(localSubPackageOutRoot, meta.subPackage.root, npmDistDirName)
          const isDependenciesCacheOutdate = await cache.checkDependenciesCacheOutdate(meta.subPackage.root)
          if (isDependenciesCacheOutdate || !(await fs.pathExists(targetDir))) {
            await fs.remove(targetDir)
            await fs.copy(sourceOutDir, targetDir, {
              overwrite: true,
              filter: (src) => {
                if (Array.isArray(meta.subPackage.dependencies)) {
                  const relPath = resolveCopyFilterRelativePath(sourceOutDir, String(src))
                  if (relPath === '') {
                    return true
                  }
                  return matchDependencyPath(meta.subPackage.dependencies, relPath)
                }
                return true
              },
            })
          }
          await cache.writeDependenciesCache(meta.subPackage.root)
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
