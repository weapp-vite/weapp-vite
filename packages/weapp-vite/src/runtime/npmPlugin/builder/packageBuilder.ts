import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import type { NpmBuildOptions } from '../../../types'
import type { PackageBuildOutput } from './output'
import type { PlannedPackage } from './packagePlan'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { defu, isObject } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { build as viteBuild } from 'vite'
import { logger } from '../../../context/shared'
import { getPlatformNpmDistDirName } from '../../../platform'
import { prepareMiniPackage } from './miniPackage'
import { arePackageEntriesCurrent, createPackageEntryAssetPlugin, PACKAGE_ASSET_ENTRY, packageEntryFileName, resolvePlannedPackageEntries } from './packageEntries'
import { createNpmPackageCopyFilter } from './packageFiles'
import { createPackageBatchQueue, runPackageBuildPlan } from './packagePlan'

export interface PackageBuilder {
  isMiniprogramPackage: (pkg: PackageJson) => boolean
  shouldSkipBuild: (outDir: string, isOutdated: boolean) => Promise<boolean>
  bundleBuild: (args: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) => Promise<void>
  copyBuild: (args: { from: string, to: string, name: string }) => Promise<void>
  buildPackage: (args: BuildPackageArgs) => Promise<void>
  buildPackages: (args: BuildPackageArgs[]) => Promise<void>
}

export interface BuildPackageArgs {
  dep: string
  outDir: string
  resolveFrom?: string
  options?: NpmBuildOptions
  isDependenciesCacheOutdate: boolean
}

interface ResolvePackageBuildTargetArgs {
  entry: InputOption
  name: string
  options?: NpmBuildOptions
  outDir: string
  assetPlugin?: Plugin
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

function resolveDefaultNpmBuildTsconfig(cwd: string) {
  const appTsconfig = path.resolve(cwd, '.weapp-vite/tsconfig.app.json')
  if (existsSync(appTsconfig)) {
    return appTsconfig
  }

  const rootTsconfig = path.resolve(cwd, 'tsconfig.json')
  if (existsSync(rootTsconfig)) {
    return rootTsconfig
  }

  return false
}

export function createPackageBuilder(
  ctx: MutableCompilerContext,
  oxcVitePlugin?: Plugin,
  output?: PackageBuildOutput,
): PackageBuilder {
  const npmLogger = typeof logger.withTag === 'function' ? logger.withTag('npm') : logger

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

  function resolvePackageBuildTarget({ entry, name, options, outDir, assetPlugin }: ResolvePackageBuildTargetArgs): ResolvedPackageBuildTarget {
    const importMetaDefineEntries = ctx.configService?.importMetaDefineEntries ?? {}
    const cwd = ctx.configService?.cwd ?? process.cwd()
    const defaultTsconfig = resolveDefaultNpmBuildTsconfig(cwd)
    const mergedOptions: NpmBuildOptions = defu<NpmBuildOptions, NpmBuildOptions[]>(options, {
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      root: cwd,
      define: {
        ...importMetaDefineEntries,
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      oxc: {
        tsconfig: false,
      } as NpmBuildOptions['oxc'],
      plugins: assetPlugin ? [assetPlugin] : [],
      build: {
        lib: {
          entry,
          formats: ['cjs'],
          fileName: (_format, entryName) => packageEntryFileName(entryName),
        },
        outDir,
        emptyOutDir: true,
        sourcemap: false,
        minify: false,
        target: 'es6',
        rolldownOptions: {
          external: [],
          tsconfig: defaultTsconfig,
          transform: {
            tsconfig: false,
          },
          output: {
            exports: 'named',
          },
        } as any,
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

  async function runResolvedBundleBuild(finalOptions: NpmBuildOptions | undefined, outDir: string) {
    if (!finalOptions) {
      return
    }

    if (oxcVitePlugin) {
      const existing = toPluginArray(finalOptions.plugins)
      const hasPlugin = existing.includes(oxcVitePlugin)
      finalOptions.plugins = hasPlugin ? existing : [oxcVitePlugin, ...existing]
    }

    if (output) {
      await output.bundle(finalOptions, outDir)
    }
    else {
      await viteBuild(finalOptions)
    }
  }

  async function bundleBuild({ entry, name, options, outDir }: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) {
    const resolvedTarget = resolvePackageBuildTarget({
      entry,
      name,
      options,
      outDir,
    })

    await runResolvedBundleBuild(resolvedTarget.options, resolvedTarget.outDir)
  }

  async function copyBuild({ from, to, name }: { from: string, to: string, name: string }) {
    await fs.remove(to)
    await fs.copy(from, to, {
      filter: createNpmPackageCopyFilter(
        from,
        ctx.configService?.weappViteConfig?.npm?.packageFiles?.[name],
      ),
      overwrite: true,
      // 宿主 staging 保存独立内容，后续 normalize 不能经符号链接改写依赖源文件。
      dereference: Boolean(output),
    })
  }

  const buildPackages = createPackageBatchQueue(async (args) => {
    if (!ctx.configService) {
      return
    }
    const owners = new Map<string, string>()
    const resolveTarget = (node: PlannedPackage, targetArgs: ResolvePackageBuildTargetArgs) => {
      const target = resolvePackageBuildTarget(targetArgs)
      if (target.options) {
        const key = path.resolve(target.outDir)
        const identity = `${path.resolve(node.args.outDir)}\0${node.packageInfo.rootPath}\0${node.args.dep}`
        if (owners.has(key) && owners.get(key) !== identity) {
          throw new Error(`[npm] 多个逻辑依赖目标映射到同一输出目录：${node.args.dep}`)
        }
        owners.set(key, identity)
      }
      return target
    }
    await runPackageBuildPlan(args.map(input => ({ ...input, resolveFrom: input.resolveFrom ?? ctx.configService?.cwd })), {
      output,
      npmDirectories: [...new Set([
        getPlatformNpmDistDirName(ctx.configService.platform, { alipayNpmMode: ctx.configService.weappViteConfig.npm?.alipayNpmMode }),
        getPlatformNpmDistDirName(ctx.configService.platform, { alipayNpmMode: 'miniprogram_npm' }),
      ])],
      isMiniprogramPackage,
      prepareMini: node => prepareMiniPackage(node, {
        ctx,
        output,
        resolveTarget: target => resolveTarget(node, target),
        copyBuild,
        shouldSkipBuild,
        skip: dep => npmLogger.info(`[npm] 依赖 \`${dep}\` 被 npm.buildOptions 跳过处理!`),
      }),
      async buildOrdinary(node) {
        const { args: { dep, outDir, options, isDependenciesCacheOutdate } } = node
        const { entries, assets } = await resolvePlannedPackageEntries(node)
        if (!Object.keys(entries).length && !assets.length) {
          npmLogger.warn(`[npm] 无法解析模块 \`${dep}\`，跳过处理!`)
          return false
        }
        for (const file of [...Object.values(entries), ...assets.map(asset => asset.input)]) {
          output?.watchFile?.(file)
        }
        const anchor = !Object.keys(entries).length
        const entry = anchor ? { index: PACKAGE_ASSET_ENTRY } : entries
        const target = resolveTarget(node, { entry, name: dep, options, outDir: path.resolve(outDir, dep), assetPlugin: assets.length ? createPackageEntryAssetPlugin(assets, anchor) : undefined })
        if (!target.options) {
          npmLogger.info(`[npm] 依赖 \`${dep}\` 被 npm.buildOptions 跳过处理!`)
          return false
        }
        if (!output && !isDependenciesCacheOutdate && await arePackageEntriesCurrent(target.outDir, entries, assets)) {
          npmLogger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
          return false
        }
        await runResolvedBundleBuild(target.options, target.outDir)
        return true
      },
      complete: dep => npmLogger.success(`[npm] \`${dep}\` 依赖处理完成!`),
    })
  })
  const buildPackage: PackageBuilder['buildPackage'] = args => buildPackages([args])

  return {
    isMiniprogramPackage,
    shouldSkipBuild,
    bundleBuild,
    copyBuild,
    buildPackage,
    buildPackages,
  }
}
