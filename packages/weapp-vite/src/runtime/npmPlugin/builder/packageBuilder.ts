import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import type { NpmBuildOptions } from '../../../types'
import { copyFile } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import process from 'node:process'
import { defu, isObject } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { getPackageInfo, resolveModule } from 'local-pkg'
import path from 'pathe'
import { build as viteBuild } from 'vite'
import { logger } from '../../../context/shared'
import {
  getPlatformNpmDistDirName,
  shouldCopyEsModuleDirectory,
  shouldHoistNestedMiniprogramDependencies,
  shouldNormalizeMiniprogramPackage,
  shouldRebuildCachedMiniprogramPackage,
} from '../../../platform'
import {
  copyEsModuleDirectoryForAlipay,
  hoistNestedMiniprogramDependenciesForAlipay,
  normalizeMiniprogramPackageForAlipay,
  shouldRebuildCachedAlipayMiniprogramPackage,
} from './alipay'
import { normalizeMiniprogramPackageJsModules } from './jsModule'
import { resolvePreferredPackageEntry } from './shared'

export interface PackageBuilder {
  isMiniprogramPackage: (pkg: PackageJson) => boolean
  shouldSkipBuild: (outDir: string, isOutdated: boolean) => Promise<boolean>
  bundleBuild: (args: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) => Promise<void>
  copyBuild: (args: { from: string, to: string, name: string }) => Promise<void>
  buildPackage: (args: { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean }) => Promise<void>
}

interface BuildPackageArgs {
  dep: string
  outDir: string
  options?: NpmBuildOptions
  isDependenciesCacheOutdate: boolean
}

interface ResolvePackageBuildTargetArgs {
  entry: InputOption
  name: string
  options?: NpmBuildOptions
  outDir: string
}

interface ResolvedPackageBuildTarget {
  outDir: string
  options?: NpmBuildOptions
}

function toPluginArray(plugins: NpmBuildOptions['plugins']): Plugin[] {
  const queue: unknown[] = []
  const result: Plugin[] = []
  if (plugins) {
    queue.push(plugins)
  }
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }
    if (Array.isArray(current)) {
      queue.unshift(...current)
      continue
    }
    result.push(current as Plugin)
  }
  return result
}

async function copyDirectory(sourceDir: string, targetDir: string) {
  await fs.ensureDir(targetDir)
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.resolve(sourceDir, entry.name)
    const targetPath = path.resolve(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath)
      continue
    }

    await fs.ensureDir(path.dirname(targetPath))
    await copyFile(sourcePath, targetPath)
  }
}

export function createPackageBuilder(
  ctx: MutableCompilerContext,
  oxcVitePlugin?: Plugin,
): PackageBuilder {
  const npmLogger = typeof logger.withTag === 'function' ? logger.withTag('npm') : logger
  const packageBuildInFlight = new Map<string, Promise<void>>()

  function isMiniprogramPackage(pkg: PackageJson) {
    return Reflect.has(pkg, 'miniprogram') && typeof pkg.miniprogram === 'string'
  }

  async function shouldSkipBuild(outDir: string, isOutdated: boolean) {
    return !isOutdated && await fs.pathExists(outDir)
  }

  function resolveBuildOutDir(options: NpmBuildOptions | undefined, fallbackOutDir: string) {
    const rawOutDir = options?.build?.outDir
    if (typeof rawOutDir !== 'string' || !rawOutDir.trim()) {
      return fallbackOutDir
    }

    if (path.isAbsolute(rawOutDir)) {
      return rawOutDir
    }

    const root = typeof options?.root === 'string' && options.root
      ? options.root
      : ctx.configService?.cwd ?? process.cwd()

    return path.resolve(root, rawOutDir)
  }

  function resolvePackageBuildTarget({ entry, name, options, outDir }: ResolvePackageBuildTargetArgs): ResolvedPackageBuildTarget {
    const defineImportMetaEnv = ctx.configService?.defineImportMetaEnv ?? {}
    const mergedOptions: NpmBuildOptions = defu<NpmBuildOptions, NpmBuildOptions[]>(options, {
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      root: ctx.configService?.cwd ?? process.cwd(),
      define: {
        ...defineImportMetaEnv,
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      plugins: [],
      build: {
        lib: {
          entry,
          formats: ['cjs'],
          fileName: (_format, entryName) => `${entryName}.js`,
        },
        outDir,
        emptyOutDir: true,
        sourcemap: false,
        minify: false,
        target: 'es6',
        rolldownOptions: {
          external: [],
          output: {
            exports: 'named',
          },
        },
      },
    })
    const resolvedOptions = ctx.configService?.weappViteConfig?.npm?.buildOptions?.(
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

    return {
      outDir: resolveBuildOutDir(finalOptions ?? mergedOptions, outDir),
      options: finalOptions,
    }
  }

  async function runResolvedBundleBuild(finalOptions: NpmBuildOptions | undefined) {
    if (!finalOptions) {
      return
    }

    if (oxcVitePlugin) {
      const existing = toPluginArray(finalOptions.plugins)
      const hasPlugin = existing.includes(oxcVitePlugin)
      finalOptions.plugins = hasPlugin ? existing : [oxcVitePlugin, ...existing]
    }

    await viteBuild(finalOptions)
  }

  async function bundleBuild({ entry, name, options, outDir }: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) {
    const resolvedTarget = resolvePackageBuildTarget({
      entry,
      name,
      options,
      outDir,
    })

    await runResolvedBundleBuild(resolvedTarget.options)
  }

  async function copyBuild({ from, to }: { from: string, to: string, name: string }) {
    await fs.remove(to)
    await copyDirectory(from, to)
  }

  let buildPackage: PackageBuilder['buildPackage']

  async function runBuildPackage(
    { dep, outDir, options, isDependenciesCacheOutdate }:
    BuildPackageArgs,
  ) {
    const packageInfo = await getPackageInfo(dep)
    if (!packageInfo || !ctx.configService) {
      return
    }
    const { packageJson: targetJson, rootPath } = packageInfo
    const dependencies = targetJson.dependencies ?? {}
    const keys = Object.keys(dependencies)
    if (isMiniprogramPackage(targetJson)) {
      const sourceDir = path.resolve(rootPath, targetJson.miniprogram)
      const resolvedTarget = resolvePackageBuildTarget({
        entry: {
          index: sourceDir,
        },
        name: dep,
        options,
        outDir: path.resolve(outDir, dep),
      })
      const destOutDir = resolvedTarget.outDir

      if (!resolvedTarget.options) {
        npmLogger.info(`[npm] 依赖 \`${dep}\` 被 npm.buildOptions 跳过处理!`)
        return
      }

      if (await shouldSkipBuild(destOutDir, isDependenciesCacheOutdate)) {
        await normalizeMiniprogramPackageJsModules(destOutDir, {
          markEsModule: true,
        })
        const platformNpmDistDirName = getPlatformNpmDistDirName(ctx.configService.platform, {
          alipayNpmMode: ctx.configService.weappViteConfig?.npm?.alipayNpmMode,
        }) as 'miniprogram_npm' | 'node_modules'
        const shouldRebuildPackage = shouldRebuildCachedMiniprogramPackage(ctx.configService.platform)
          ? await shouldRebuildCachedAlipayMiniprogramPackage(destOutDir, outDir, rootPath, platformNpmDistDirName)
          : false
        if (!shouldRebuildPackage) {
          npmLogger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
          return
        }
      }
      await copyBuild({
        from: sourceDir,
        to: destOutDir,
        name: dep,
      })
      await normalizeMiniprogramPackageJsModules(destOutDir, {
        markEsModule: true,
      })

      if (shouldNormalizeMiniprogramPackage(ctx.configService.platform)) {
        const platformNpmDistDirName = getPlatformNpmDistDirName(ctx.configService.platform, {
          alipayNpmMode: ctx.configService.weappViteConfig?.npm?.alipayNpmMode,
        })
        if (shouldCopyEsModuleDirectory(ctx.configService.platform) && platformNpmDistDirName === 'node_modules') {
          await copyEsModuleDirectoryForAlipay(rootPath, destOutDir)
        }
        await normalizeMiniprogramPackageForAlipay(destOutDir)
        if (shouldHoistNestedMiniprogramDependencies(ctx.configService.platform)) {
          await hoistNestedMiniprogramDependenciesForAlipay(destOutDir, outDir)
        }
      }

      if (keys.length > 0) {
        await Promise.all(
          keys.map((x) => {
            return buildPackage({
              dep: x,
              outDir,
              options,
              isDependenciesCacheOutdate,
            })
          }),
        )
      }
    }
    else {
      const index = await resolvePreferredPackageEntry(rootPath, targetJson) ?? resolveModule(dep)
      if (!index) {
        npmLogger.warn(`[npm] 无法解析模块 \`${dep}\`，跳过处理!`)
        return
      }
      const resolvedTarget = resolvePackageBuildTarget({
        entry: {
          index,
        },
        name: dep,
        options,
        outDir: path.resolve(outDir, dep),
      })
      const destOutDir = resolvedTarget.outDir

      if (!resolvedTarget.options) {
        npmLogger.info(`[npm] 依赖 \`${dep}\` 被 npm.buildOptions 跳过处理!`)
        return
      }

      if (!isDependenciesCacheOutdate && await fs.pathExists(destOutDir)) {
        const destEntry = path.resolve(destOutDir, 'index.js')
        if (await fs.pathExists(destEntry)) {
          const [srcStat, destStat] = await Promise.all([fs.stat(index), fs.stat(destEntry)])
          if (srcStat.mtimeMs <= destStat.mtimeMs) {
            npmLogger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
            return
          }
        }
      }
      await runResolvedBundleBuild(resolvedTarget.options)
      if (keys.length > 0) {
        await Promise.all(
          keys.filter(x => isBuiltin(x)).map((x) => {
            return buildPackage({
              dep: `${x}/`,
              outDir,
              options,
              isDependenciesCacheOutdate,
            })
          }),
        )
      }
    }

    npmLogger.success(`[npm] \`${dep}\` 依赖处理完成!`)
  }

  buildPackage = async (
    { dep, outDir, options, isDependenciesCacheOutdate }: BuildPackageArgs,
  ) => {
    const taskKey = `${path.resolve(outDir)}::${dep}`
    const pending = packageBuildInFlight.get(taskKey)
    if (pending) {
      return pending
    }

    const task = runBuildPackage({
      dep,
      outDir,
      options,
      isDependenciesCacheOutdate,
    }).finally(() => {
      if (packageBuildInFlight.get(taskKey) === task) {
        packageBuildInFlight.delete(taskKey)
      }
    })

    packageBuildInFlight.set(taskKey, task)
    return task
  }

  return {
    isMiniprogramPackage,
    shouldSkipBuild,
    bundleBuild,
    copyBuild,
    buildPackage,
  }
}
