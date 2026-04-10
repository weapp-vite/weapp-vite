import type { PackageJson } from 'pkg-types'
import type { NpmBuildOptions } from '../../../types'
import type { NpmBuildServiceOptions } from './types'
import { fs } from '@weapp-core/shared'
import { getPackageInfo } from 'local-pkg'
import path from 'pathe'
import { debug } from '../../../context/shared'
import { getPackNpmRelationList } from '../relations'
import {
  dedupeNpmDependencies,
  hasLocalSubPackageNpmConfig,
  resolveConfiguredNpmDependencyPatterns,
  resolveDeclaredNpmDependencies,
  resolveMainBuildDependencyPatterns,
  resolveNpmBuildCandidateDependenciesSync,
  resolveNpmDistDirName,
  resolveNpmStrategyMode,
  resolveTargetDependencies,
} from './dependencies'
import { matchDependencyCopyPath, resolveCopyFilterRelativePath, resolveNpmSourceCacheOutDir } from './paths'

function hasSameDependencySet(source: string[], target: string[]) {
  if (source.length !== target.length) {
    return false
  }

  return source.every(dep => target.includes(dep))
}

export function createNpmBuildService(options: NpmBuildServiceOptions) {
  const { ctx, builder, cache } = options

  async function resolveMiniprogramCandidateDependencies(allDependencies: string[], cwd?: string) {
    const miniprogramDependencies = await Promise.all(
      allDependencies.map(async (dep) => {
        let packageInfo: Awaited<ReturnType<typeof getPackageInfo>> | null = null
        try {
          packageInfo = await getPackageInfo(dep, cwd ? { paths: [cwd] } : undefined)
        }
        catch {
          packageInfo = null
        }
        if (packageInfo && builder.isMiniprogramPackage(packageInfo.packageJson)) {
          return dep
        }
        return null
      }),
    )

    return miniprogramDependencies.filter((dep): dep is string => typeof dep === 'string')
  }

  async function resolveBuildCandidateDependencies(pkgJson: PackageJson) {
    const syncCandidates = resolveNpmBuildCandidateDependenciesSync(ctx, pkgJson)
    if (resolveNpmStrategyMode(ctx) === 'legacy') {
      return syncCandidates
    }

    const declaredDependencies = resolveDeclaredNpmDependencies(pkgJson)
    const miniprogramDependencies = await resolveMiniprogramCandidateDependencies(declaredDependencies, ctx.configService?.cwd)
    const configuredPatterns = resolveConfiguredNpmDependencyPatterns(ctx)
    const explicitlyIncludedDependencies = resolveTargetDependencies(declaredDependencies, configuredPatterns)

    return dedupeNpmDependencies([
      ...miniprogramDependencies,
      ...explicitlyIncludedDependencies,
    ])
  }

  async function buildTargetDependencies(args: {
    dependencies: string[]
    npmDistDir: string
    options?: NpmBuildOptions
    cacheKey?: string
  }) {
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
          options: args.options,
          isDependenciesCacheOutdate,
        })
      }),
    )

    await cache.writeDependenciesCache(args.cacheKey)
  }

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
      const pkgJson = ((await fs.readJson(packageJsonPath)) ?? {}) as PackageJson
      const npmDistDirName = resolveNpmDistDirName(ctx.configService)
      const outDir = path.resolve(ctx.configService.cwd, mainRelation.miniprogramNpmDistDir, npmDistDirName)
      const cachedSourceOutDir = resolveNpmSourceCacheOutDir(ctx.configService.cwd, npmDistDirName)
      const localSubPackageOutRoot = ctx.configService.outDir || path.resolve(ctx.configService.cwd, mainRelation.miniprogramNpmDistDir)
      const allDependencies = await resolveBuildCandidateDependencies(pkgJson)
      const mainDependencies = resolveTargetDependencies(allDependencies, resolveMainBuildDependencyPatterns(ctx))
      const sourceOutDir = hasSameDependencySet(allDependencies, mainDependencies) ? outDir : cachedSourceOutDir
      const localSubPackageMetas = [...ctx.scanService?.subPackageMap.values() ?? []]
        .filter(meta => Array.isArray(meta.subPackage.dependencies) && meta.subPackage.dependencies.length > 0)

      if (sourceOutDir !== outDir) {
        await buildTargetDependencies({
          cacheKey: '__all__',
          dependencies: allDependencies,
          npmDistDir: sourceOutDir,
          options,
        })
      }

      await buildTargetDependencies({
        cacheKey: ctx.configService.pluginOnly ? '__plugin__' : undefined,
        dependencies: mainDependencies,
        npmDistDir: outDir,
        options,
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
                return matchDependencyCopyPath(meta.subPackage.dependencies, relPath)
              }
              return true
            },
          })
        }
        await cache.writeDependenciesCache(meta.subPackage.root)
      }
    }

    debug?.('buildNpm end')
  }

  return {
    build,
  }
}
