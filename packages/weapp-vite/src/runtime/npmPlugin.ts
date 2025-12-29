import type { PackageJson } from 'pkg-types'
import type { InputOption } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { NpmBuildOptions } from '../types'
import { isBuiltin } from 'node:module'
import process from 'node:process'
import { defu, isObject, objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import { getPackageInfo, resolveModule } from 'local-pkg'
import path from 'pathe'
import { build as viteBuild } from 'vite'
import { debug, logger } from '../context/shared'
import { regExpTest } from '../utils'
import { createOxcRuntimeSupport } from './oxcRuntime'

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

function createNpmService(ctx: MutableCompilerContext): NpmService {
  const oxcRuntimeSupport = createOxcRuntimeSupport()
  const oxcVitePlugin = oxcRuntimeSupport.vitePlugin

  function getDependenciesCacheFilePath(key: string = '/') {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before generating npm cache path')
    }
    return path.resolve(ctx.configService.cwd, `node_modules/weapp-vite/.cache/${key.replaceAll('/', '-')}.json`)
  }

  function dependenciesCacheHash() {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before accessing dependencies cache hash')
    }
    return objectHash(ctx.configService.packageJson.dependencies ?? {})
  }

  function isMiniprogramPackage(pkg: PackageJson) {
    return Reflect.has(pkg, 'miniprogram') && typeof pkg.miniprogram === 'string'
  }

  async function shouldSkipBuild(outDir: string, isOutdated: boolean) {
    return !isOutdated && await fs.exists(outDir)
  }

  async function writeDependenciesCache(root?: string) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before writing npm cache')
    }
    if (ctx.configService.weappViteConfig?.npm?.cache) {
      await fs.outputJSON(getDependenciesCacheFilePath(root), {
        hash: dependenciesCacheHash(),
      })
    }
  }

  async function readDependenciesCache(root?: string) {
    const cachePath = getDependenciesCacheFilePath(root)
    if (await fs.exists(cachePath)) {
      return await fs.readJson(cachePath, { throws: false })
    }
  }

  async function checkDependenciesCacheOutdate(root?: string) {
    if (ctx.configService?.weappViteConfig?.npm?.cache) {
      const json = await readDependenciesCache(root)
      if (isObject(json)) {
        return dependenciesCacheHash() !== json.hash
      }
      return true
    }
    return true
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
      if (!isDependenciesCacheOutdate && await fs.exists(destOutDir)) {
        const destEntry = path.resolve(destOutDir, 'index.js')
        if (await fs.exists(destEntry)) {
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

  function getPackNpmRelationList() {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before resolving npm relation list')
    }
    let packNpmRelationList: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[] = []
    if (ctx.configService.projectConfig.setting?.packNpmManually && Array.isArray(ctx.configService.projectConfig.setting.packNpmRelationList)) {
      packNpmRelationList = ctx.configService.projectConfig.setting.packNpmRelationList
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

  async function build(options?: NpmBuildOptions) {
    if (!ctx.configService?.weappViteConfig?.npm?.enable) {
      return
    }

    debug?.('buildNpm start')

    const packNpmRelationList = getPackNpmRelationList()
    const [mainRelation, ...subRelations] = packNpmRelationList
    const packageJsonPath = path.resolve(ctx.configService.cwd, mainRelation.packageJsonPath)
    if (await fs.exists(packageJsonPath)) {
      const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
      const outDir = path.resolve(ctx.configService.cwd, mainRelation.miniprogramNpmDistDir, 'miniprogram_npm')
      if (pkgJson.dependencies) {
        const dependencies = Object.keys(pkgJson.dependencies)
        if (dependencies.length > 0) {
          const isDependenciesCacheOutdate = await checkDependenciesCacheOutdate()

          await Promise.all(
            dependencies.map((dep) => {
              return buildPackage({
                dep,
                outDir,
                options,
                isDependenciesCacheOutdate,
              })
            }),
          )
          await writeDependenciesCache()

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
              const isDependenciesCacheOutdate = await checkDependenciesCacheOutdate(x.root)
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
              await writeDependenciesCache(x.root)
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
    getDependenciesCacheFilePath,
    get dependenciesCacheHash() {
      return dependenciesCacheHash()
    },
    isMiniprogramPackage,
    shouldSkipBuild,
    writeDependenciesCache,
    readDependenciesCache,
    checkDependenciesCacheOutdate,
    bundleBuild,
    copyBuild,
    buildPackage,
    getPackNpmRelationList,
    build,
  }
}

export function createNpmServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createNpmService(ctx)
  ctx.npmService = service

  return {
    name: 'weapp-runtime:npm-service',
  }
}
