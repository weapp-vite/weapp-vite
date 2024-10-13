import type { PackageJson } from 'pkg-types'
import type { RollupOutput, RollupWatcher } from 'rollup'
import type { AppEntry, CompilerContextOptions, Entry, EntryJsonFragment, ProjectConfig, ResolvedAlias, SubPackage, SubPackageMetaValue, TsupOptions } from './types'
import { createRequire } from 'node:module'
import process from 'node:process'
import { addExtension, defu, get, isObject, objectHash, removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build, type InlineConfig, loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defaultExcluded } from './defaults'
import logger from './logger'
import { vitePluginWeapp } from './plugins'
import { changeFileExtension, findJsEntry, getAliasEntries, getProjectConfig, readCommentJson, resolveImportee } from './utils'
import './config'

const require = createRequire(import.meta.url)

let logBuildAppFinishOnlyShowOnce = false

function logBuildAppFinish() {
  if (!logBuildAppFinishOnlyShowOnce) {
    logger.success('应用构建完成！预览方式 ( `2` 种选其一即可)：')
    logger.info('执行 `npm run open` / `yarn open` / `pnpm open` 直接在 `微信开发者工具` 里打开当前应用')
    logger.info('或手动打开微信开发者工具,导入根目录(`project.config.json` 文件所在的目录),即可预览效果')
    logBuildAppFinishOnlyShowOnce = true
  }
}

function logBuildIndependentSubPackageFinish(root: string) {
  logger.success(`独立分包 ${root} 构建完成！`)
}
export class CompilerContext {
  /**
   * loadDefaultConfig 的时候会被重新赋予
   */
  inlineConfig: InlineConfig
  cwd: string
  isDev: boolean
  projectConfig: ProjectConfig
  mode: string
  packageJson: PackageJson

  private rollupWatcherMap: Map<string, RollupWatcher>

  entriesSet: Set<string>
  entries: Entry[]

  appEntry?: AppEntry

  subPackageMeta: Record<string, SubPackageMetaValue>

  aliasEntries: ResolvedAlias[]

  constructor(options?: CompilerContextOptions) {
    const { cwd, isDev, inlineConfig, projectConfig, mode, packageJson } = defu<Required<CompilerContextOptions>, CompilerContextOptions[]>(options, {
      cwd: process.cwd(),
      isDev: false,
      projectConfig: {},
      inlineConfig: {},
      packageJson: {},
    })
    this.cwd = cwd
    this.inlineConfig = inlineConfig
    this.isDev = isDev
    this.projectConfig = projectConfig
    this.mode = mode
    this.packageJson = packageJson
    this.rollupWatcherMap = new Map()
    this.subPackageMeta = {}
    this.entriesSet = new Set()
    this.entries = []
    this.aliasEntries = []
  }

  get srcRoot() {
    return this.inlineConfig?.weapp?.srcRoot ?? ''
  }

  relativeSrcRoot(p: string) {
    if (this.srcRoot) {
      return path.relative(this.srcRoot, p)
    }
    return p
  }

  /**
   * @description 写在 projectConfig 里面的 miniprogramRoot / srcMiniprogramRoot
   * 默认为 'dist'
   *
   */
  get mpDistRoot(): string | undefined {
    return this.projectConfig.miniprogramRoot || this.projectConfig.srcMiniprogramRoot
  }

  private async internalDev(inlineConfig: InlineConfig) {
    const watcher = (
      await build(
        inlineConfig,
      )
    ) as RollupWatcher
    await new Promise((resolve, reject) => {
      watcher.on('event', async (e) => {
        if (e.code === 'END') {
          await this.buildSubPackage()
          logBuildAppFinish()
          resolve(e)
        }
        else if (e.code === 'ERROR') {
          reject(e)
        }
      })
    })
    this.setRollupWatcher(watcher)
    return watcher
  }

  async runDev() {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }

    const inlineConfig = this.getConfig()

    const watcher = await this.internalDev(inlineConfig)

    return watcher
  }

  getConfig(subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig>[]) {
    if (this.isDev) {
      return defu<InlineConfig, InlineConfig[]>(
        this.inlineConfig,
        ...configs,
        {
          root: this.cwd,
          mode: 'development',
          plugins: [vitePluginWeapp(this, subPackageMeta)],
          build: {
            watch: {
              exclude: [
                ...defaultExcluded,
                this.mpDistRoot ? path.join(this.mpDistRoot, '**') : 'dist/**',
              ],
              chokidar: {
                ignored: [...defaultExcluded],
              },
            },
            minify: false,
            emptyOutDir: false,
          },
        },
      )
    }
    else {
      const inlineConfig = defu<InlineConfig, InlineConfig[]>(
        this.inlineConfig,
        ...configs,
        {
          root: this.cwd,
          plugins: [vitePluginWeapp(this, subPackageMeta)],
          mode: 'production',
          build: {
            emptyOutDir: false,
          },
        },
      )
      inlineConfig.logLevel = 'info'
      return inlineConfig
    }
  }

  async runProd() {
    if (this.mpDistRoot) {
      await fs.emptyDir(path.resolve(this.cwd, this.mpDistRoot))
      logger.success(`已清空 ${this.mpDistRoot} 目录`)
    }
    const output = (await build(
      this.getConfig(),
    ))
    await this.buildSubPackage()
    logBuildAppFinish()
    return output as RollupOutput | RollupOutput[]
  }

  async build() {
    if (this.isDev) {
      await this.runDev()
    }
    else {
      await this.runProd()
    }
  }

  async loadDefaultConfig() {
    const projectConfig = await getProjectConfig(this.cwd)
    this.projectConfig = projectConfig
    if (!this.mpDistRoot) {
      logger.error('请在 `project.config.json` 里设置 `miniprogramRoot`, 比如可以设置为 `dist/` ')
      return
    }
    const packageJsonPath = path.resolve(this.cwd, 'package.json')
    const external: string[] = []
    if (await fs.exists(packageJsonPath)) {
      const localPackageJson: PackageJson = await fs.readJson(packageJsonPath, {
        throws: false,
      }) || {}
      this.packageJson = localPackageJson
      if (localPackageJson.dependencies) {
        external.push(...Object.keys(localPackageJson.dependencies))
      }
    }

    const loaded = await loadConfigFromFile({
      command: this.isDev ? 'serve' : 'build',
      mode: this.mode,
    }, undefined, this.cwd)

    this.inlineConfig = defu<InlineConfig, (InlineConfig | undefined)[]>({
      configFile: false,
    }, loaded?.config, {
      build: {
        rollupOptions: {
          output: {
            format: 'cjs',
            strict: false,
            entryFileNames: (chunkInfo) => {
              const name = this.relativeSrcRoot(chunkInfo.name)
              if (name.endsWith('.ts')) {
                const baseFileName = removeExtension(name)
                if (baseFileName.endsWith('.wxs')) {
                  return baseFileName
                }
                return addExtension(baseFileName, '.js')
              }
              return name
            },
          },
          external,
        },
        assetsDir: '.',
        commonjsOptions: {
          transformMixedEsModules: true,
          include: undefined,
        },
      },
      plugins: [
        tsconfigPaths(),
      ],
      logLevel: 'warn',
    })
    // this.inlineConfig.plugins?.push(
    //   viteStaticCopy({
    //     targets: [
    //       {
    //         src: path.join(this.inlineConfig.weapp?.srcRoot ?? '', this.projectConfig.sitemapLocation),
    //         dest: '.',
    //       },
    //     ],
    //   }),
    // )
    this.aliasEntries = getAliasEntries(this.inlineConfig.weapp?.jsonAlias)
  }

  get dependenciesCacheFilePath() {
    return path.resolve(this.cwd, 'node_modules/weapp-vite/.cache/npm.json')
  }

  get dependenciesCacheHash() {
    return objectHash(this.packageJson.dependencies ?? {})
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

  // https://cn.vitejs.dev/guide/build.html#library-mode
  // miniprogram_dist
  // miniprogram
  // https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
  async buildNpm(options?: TsupOptions) {
    const { build: tsupBuild } = await import('tsup')
    const isDependenciesCacheOutdate = await this.checkDependenciesCacheOutdate()
    // if (!await this.isDependenciesCacheOutdate()) {
    //   logger.success(`依赖未发生变化，跳过处理!`)

    // }

    let packNpmRelationList: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[] = []
    if (this.projectConfig.setting?.packNpmManually && Array.isArray(this.projectConfig.setting.packNpmRelationList)) {
      packNpmRelationList = this.projectConfig.setting.packNpmRelationList
    }
    else {
      packNpmRelationList = [
        {
          miniprogramNpmDistDir: '.',
          packageJsonPath: './package.json',
        },
      ]
    }
    for (const relation of packNpmRelationList) {
      const packageJsonPath = path.resolve(this.cwd, relation.packageJsonPath)
      if (await fs.exists(packageJsonPath)) {
        const pkgJson: PackageJson = await fs.readJson(packageJsonPath)
        const outDir = path.resolve(this.cwd, relation.miniprogramNpmDistDir, 'miniprogram_npm')
        if (pkgJson.dependencies) {
          const dependencies = Object.keys(pkgJson.dependencies)
          if (dependencies.length > 0) {
            for (const dep of dependencies) {
              const id = `${dep}/package.json`
              const targetJson = require(id)

              if (Reflect.has(targetJson, 'miniprogram') && targetJson.miniprogram) {
                const targetJsonPath = require.resolve(id)
                const dest = path.join(outDir, dep)
                if (!isDependenciesCacheOutdate && await fs.exists(dest)) {
                  logger.success(`${dep} 依赖未发生变化，跳过处理!`)
                  continue
                }
                await fs.copy(
                  path.resolve(
                    path.dirname(targetJsonPath),
                    targetJson.miniprogram,
                  ),
                  dest,
                )
              }
              else {
                const destOutDir = path.join(outDir, dep)
                if (!isDependenciesCacheOutdate && await fs.exists(destOutDir)) {
                  logger.success(`${dep} 依赖未发生变化，跳过处理!`)
                  continue
                }

                const mergedOptions: TsupOptions = defu<TsupOptions, TsupOptions[]>(options, {
                  entry: {
                    index: require.resolve(dep),
                  },
                  format: ['cjs'],
                  outDir: destOutDir,
                  silent: true,
                  shims: true,
                  outExtension: () => {
                    return {
                      js: '.js',
                    }
                  },
                  sourcemap: false,
                  // clean: false,
                })
                const resolvedOptions = this.inlineConfig.weapp?.npm?.tsup?.(mergedOptions)
                let finalOptions: TsupOptions | undefined
                if (resolvedOptions === undefined) {
                  finalOptions = mergedOptions
                }
                else if (isObject(resolvedOptions)) {
                  finalOptions = resolvedOptions
                }
                finalOptions && await tsupBuild(finalOptions)
              }
              logger.success(`${dep} 依赖处理完成!`)
            }
          }
        }
      }
    }
    await this.writeDependenciesCache()
  }

  private async usingComponentsHandler(entry: EntryJsonFragment, relDir: string) {
    // this.packageJson.dependencies
    const { usingComponents } = entry.json as unknown as {
      usingComponents: Record<string, string>
    }
    if (usingComponents) {
      for (const [, componentUrl] of Object.entries(usingComponents)) {
        if (/plugin:\/\//.test(componentUrl)) {
          // console.log(`发现插件 ${usingComponent}`)
          continue
        }
        const tokens = componentUrl.split('/')
        // 来自 dependencies 的依赖直接跳过
        if (tokens[0] && isObject(this.packageJson.dependencies) && Reflect.has(this.packageJson.dependencies, tokens[0])) {
          continue
        }
        // start with '/' 表述默认全局别名
        else if (tokens[0] === '') {
          await this.scanComponentEntry(componentUrl.substring(1), path.resolve(this.cwd, this.srcRoot))
        }
        else {
          const importee = resolveImportee(componentUrl, entry, this.aliasEntries)
          await this.scanComponentEntry(importee, relDir)
        }
      }
    }
  }

  resetEntries() {
    this.entriesSet.clear()
    this.entries.length = 0
    this.subPackageMeta = {}
  }

  async scanAppEntry() {
    this.resetEntries()
    const appDirname = path.resolve(this.cwd, this.srcRoot)
    const appConfigFile = path.resolve(appDirname, 'app.json')
    const appEntryPath = await findJsEntry(appConfigFile)
    // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
    // js + json
    if (appEntryPath && await fs.exists(appConfigFile)) {
      const config = await readCommentJson(appConfigFile) as unknown as {
        pages: string[]
        usingComponents: Record<string, string>
        subpackages: SubPackage[]
        subPackages: SubPackage[]
        themeLocation?: string
        sitemapLocation?: string
      }
      if (isObject(config)) {
        if (this.entriesSet.has(appEntryPath)) {
          return
        }
        this.entriesSet.add(appEntryPath)
        const appEntry: AppEntry = {
          path: appEntryPath,
          json: config,
          jsonPath: appConfigFile,
          type: 'app',
        }
        this.entries.push(appEntry)
        this.appEntry = appEntry

        const { pages, subpackages = [], subPackages = [], sitemapLocation = 'sitemap.json', themeLocation = 'theme.json' } = config
        // sitemap.json
        if (sitemapLocation) {
          const sitemapJsonPath = path.resolve(appDirname, sitemapLocation)
          if (await fs.exists(sitemapJsonPath)) {
            appEntry.sitemapJsonPath = sitemapJsonPath
            appEntry.sitemapJson = await readCommentJson(sitemapJsonPath) as unknown as object
          }
        }
        // theme.json
        if (themeLocation) {
          const themeJsonPath = path.resolve(appDirname, themeLocation)
          if (await fs.exists(themeJsonPath)) {
            appEntry.themeJsonPath = themeJsonPath
            appEntry.themeJson = await readCommentJson(themeJsonPath) as unknown as object
          }
        }
        // https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html
        // 优先 subPackages
        const subs: SubPackage[] = [...subpackages, ...subPackages]
        // 组件
        await this.usingComponentsHandler(appEntry, appDirname)
        // 页面
        if (Array.isArray(pages)) {
          for (const page of pages) {
            await this.scanComponentEntry(page, appDirname)
          }
        }
        // 分包
        for (const sub of subs) {
          // 独立分包
          if (sub.independent) {
            const meta: SubPackageMetaValue = {
              entries: [],
              entriesSet: new Set(),
              subPackage: sub,
            }
            const scanComponentEntry = this.scanComponentEntry.bind(meta)
            if (Array.isArray(sub.pages)) {
              for (const page of sub.pages) {
                await scanComponentEntry(path.join(sub.root, page), appDirname)
              }
            }
            if (sub.entry) {
              await scanComponentEntry(path.join(sub.root, sub.entry), appDirname)
            }
            this.subPackageMeta[sub.root] = meta
          }
          else {
            // 普通分包
            if (Array.isArray(sub.pages)) {
              for (const page of sub.pages) {
                await this.scanComponentEntry(path.join(sub.root, page), appDirname)
              }
            }
            if (sub.entry) {
              await this.scanComponentEntry(path.join(sub.root, sub.entry), appDirname)
            }
          }
        }
        // 自定义 tabBar
        // https://developers.weixin.qq.com/miniprogram/dev/framework/ability/custom-tabbar.html
        if (get(appEntry, 'json.tabBar.custom')) {
          await this.scanComponentEntry('custom-tab-bar/index', appDirname)
        }
        return appEntry
      }
    }
    else {
      throw new Error(`在 ${appDirname} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
    }
  }

  // usingComponents
  // subpackages / subPackages
  // pages
  // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
  // 页面可以没有 JSON
  async scanComponentEntry(componentEntry: string, dirname: string) {
    const entry = path.resolve(dirname, componentEntry)
    const jsEntry = await findJsEntry(entry)
    const partialEntry: Entry = {
      path: jsEntry!,
    }
    if (jsEntry && !this.entriesSet.has(jsEntry)) {
      this.entriesSet.add(jsEntry)
      this.entries.push(partialEntry)
    }
    const configFile = changeFileExtension(entry, 'json')
    if (await fs.exists(configFile)) {
      const config = await readCommentJson(configFile) as unknown as {
        usingComponents: Record<string, string>
      }
      const jsonFragment = {
        json: config,
        jsonPath: configFile,
      }
      if (jsEntry) {
        partialEntry.json = jsonFragment.json
        partialEntry.jsonPath = jsonFragment.jsonPath
      }
      if (isObject(config)) {
        await this.usingComponentsHandler(jsonFragment, path.dirname(configFile))
      }
    }
  }

  setRollupWatcher(watcher: RollupWatcher, root: string = '/') {
    const oldWatcher = this.rollupWatcherMap.get(root)
    oldWatcher?.close()
    this.rollupWatcherMap.set(root, watcher)
  }

  // 独立分包需要单独打包
  async buildSubPackage() {
    for (const [root, meta] of Object.entries(this.subPackageMeta)) {
      const inlineConfig = this.getConfig(meta, {
        build: {
          rollupOptions: {
            output: {
              chunkFileNames() {
                return `${root}/[name]-[hash].js`
              },
            },
          },
        },
      })
      const output = (await build(
        inlineConfig,
      ))
      if (this.isDev) {
        const watcher = output as RollupWatcher
        this.setRollupWatcher(watcher, root)
        const e = await new Promise((resolve, reject) => {
          watcher.on('event', (e) => {
            if (e.code === 'END') {
              logBuildIndependentSubPackageFinish(root)
              resolve(e)
            }
            else if (e.code === 'ERROR') {
              reject(e)
            }
          })
        })
        return e
      }
      else {
        logBuildIndependentSubPackageFinish(root)
      }
    }
  }
}

export async function createCompilerContext(options?: CompilerContextOptions) {
  const ctx = new CompilerContext(options)
  await ctx.loadDefaultConfig()
  return ctx
}
