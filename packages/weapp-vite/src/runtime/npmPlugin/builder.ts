import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { NpmBuildOptions } from '../../types'
import { isBuiltin } from 'node:module'
import process from 'node:process'
import { defu, isObject } from '@weapp-core/shared'
import fs from 'fs-extra'
import { getPackageInfo, resolveModule } from 'local-pkg'
import path from 'pathe'
import { build as viteBuild } from 'vite'
import { logger } from '../../context/shared'

export interface PackageBuilder {
  isMiniprogramPackage: (pkg: PackageJson) => boolean
  shouldSkipBuild: (outDir: string, isOutdated: boolean) => Promise<boolean>
  bundleBuild: (args: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) => Promise<void>
  copyBuild: (args: { from: string, to: string, name: string }) => Promise<void>
  buildPackage: (args: { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean }) => Promise<void>
}

export function createPackageBuilder(
  ctx: MutableCompilerContext,
  oxcVitePlugin?: Plugin,
): PackageBuilder {
  function isMiniprogramPackage(pkg: PackageJson) {
    return Reflect.has(pkg, 'miniprogram') && typeof pkg.miniprogram === 'string'
  }

  async function shouldSkipBuild(outDir: string, isOutdated: boolean) {
    return !isOutdated && await fs.pathExists(outDir)
  }

  async function bundleBuild({ entry, name, options, outDir }: { entry: InputOption, name: string, options?: NpmBuildOptions, outDir: string }) {
    const mergedOptions: NpmBuildOptions = defu<NpmBuildOptions, NpmBuildOptions[]>(options, {
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      root: ctx.configService?.cwd ?? process.cwd(),
      define: {
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
        minify: true,
        target: 'es6',
        rollupOptions: {
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
    if (finalOptions) {
      if (oxcVitePlugin) {
        const toPluginArray = (plugins: NpmBuildOptions['plugins']): Plugin[] => {
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
        const existing = toPluginArray(finalOptions.plugins)
        const hasPlugin = existing.includes(oxcVitePlugin)
        const nextPlugins = hasPlugin ? existing : [oxcVitePlugin, ...existing]
        finalOptions.plugins = nextPlugins
      }

      await viteBuild(finalOptions)
    }
  }

  async function copyBuild({ from, to }: { from: string, to: string, name: string }) {
    await fs.copy(
      from,
      to,
    )
  }

  async function buildPackage(
    { dep, outDir, options, isDependenciesCacheOutdate }:
    { dep: string, outDir: string, options?: NpmBuildOptions, isDependenciesCacheOutdate: boolean },
  ) {
    const packageInfo = await getPackageInfo(dep)
    if (!packageInfo || !ctx.configService) {
      return
    }
    const { packageJson: targetJson, rootPath } = packageInfo
    const dependencies = targetJson.dependencies ?? {}
    const keys = Object.keys(dependencies)
    const destOutDir = path.resolve(outDir, dep)
    if (isMiniprogramPackage(targetJson)) {
      if (await shouldSkipBuild(destOutDir, isDependenciesCacheOutdate)) {
        logger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
        return
      }
      await copyBuild({
        from: path.resolve(
          rootPath,
          targetJson.miniprogram,
        ),
        to: destOutDir,
        name: dep,
      })
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
      const index = resolveModule(dep)
      if (!index) {
        logger.warn(`[npm] 无法解析模块 \`${dep}\`，跳过处理!`)
        return
      }
      if (!isDependenciesCacheOutdate && await fs.pathExists(destOutDir)) {
        const destEntry = path.resolve(destOutDir, 'index.js')
        if (await fs.pathExists(destEntry)) {
          const [srcStat, destStat] = await Promise.all([fs.stat(index), fs.stat(destEntry)])
          if (srcStat.mtimeMs <= destStat.mtimeMs) {
            logger.info(`[npm] 依赖 \`${dep}\` 未发生变化，跳过处理!`)
            return
          }
        }
      }
      await bundleBuild({
        entry: {
          index,
        },
        name: dep,
        options,
        outDir: destOutDir,
      })
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

    logger.success(`[npm] \`${dep}\` 依赖处理完成!`)
  }

  return {
    isMiniprogramPackage,
    shouldSkipBuild,
    bundleBuild,
    copyBuild,
    buildPackage,
  }
}
