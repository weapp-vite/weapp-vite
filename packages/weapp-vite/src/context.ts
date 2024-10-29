import type { App as AppJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { PackageJson } from 'pkg-types'
import type { RollupOutput, RollupWatcher } from 'rollup'
import type { OutputExtensions } from './defaults'
import type { AppEntry, CompilerContextOptions, Entry, EntryJsonFragment, MpPlatform, ProjectConfig, ResolvedAlias, SubPackage, SubPackageMetaValue, TsupOptions } from './types'
import { createRequire } from 'node:module'
import process from 'node:process'
import { addExtension, defu, get, isObject, objectHash, removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build, type InlineConfig, loadConfigFromFile } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { createDebugger } from './debugger'
import { defaultExcluded, getOutputExtensions } from './defaults'
import logger from './logger'
import { vitePluginWeapp } from './plugins'
import { createReadCommentJson, findJsEntry, findJsonEntry, getAliasEntries, getProjectConfig, resolveImportee } from './utils'
import './config'

const debug = createDebugger('weapp-vite:context')
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

  platform: MpPlatform

  outputExtensions: OutputExtensions
  readCommentJson: (filepath: string) => Promise<any>
  constructor(options?: CompilerContextOptions) {
    const { cwd, isDev, inlineConfig, projectConfig, mode, packageJson, platform } = defu<Required<CompilerContextOptions>, CompilerContextOptions[]>(options, {
      cwd: process.cwd(),
      isDev: false,
      projectConfig: {},
      inlineConfig: {},
      packageJson: {},
      platform: 'weapp',
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
    this.platform = platform
    this.outputExtensions = getOutputExtensions(platform)
    this.readCommentJson = createReadCommentJson(this)
  }

  // https://github.com/vitejs/vite/blob/192d555f88bba7576e8a40cc027e8a11e006079c/packages/vite/src/node/plugins/define.ts#L41
  get define() {
    const MP_PLATFORM = JSON.stringify(this.platform)
    const define: Record<string, any> = {
      'import.meta.env.MP_PLATFORM': MP_PLATFORM,
      // 'process.env.MP_PLATFORM': MP_PLATFORM,
    }
    return define
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

  get outDir() {
    return path.resolve(this.cwd, this.mpDistRoot ?? '')
  }

  async runDev() {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.('dev build watcher start')
    const watcher = (
      await build(
        this.getConfig(),
      )
    ) as RollupWatcher
    debug?.('dev build watcher end')
    debug?.('dev watcher listen start')
    await new Promise((resolve, reject) => {
      watcher.on('event', async (e) => {
        if (e.code === 'END') {
          debug?.('dev watcher listen end')
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

  getConfig(subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig>[]) {
    if (this.isDev) {
      return defu<InlineConfig, InlineConfig[]>(
        this.inlineConfig,
        ...configs,
        {
          root: this.cwd,
          mode: 'development',
          plugins: [vitePluginWeapp(this, subPackageMeta)],
          // https://github.com/vitejs/vite/blob/a0336bd5197bb4427251be4c975e30fb596c658f/packages/vite/src/node/config.ts#L1117
          define: this.define,
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
          define: this.define,
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
      await fs.emptyDir(this.outDir)
      logger.success(`已清空 ${this.mpDistRoot} 目录`)
    }
    debug?.('prod build start')
    const output = (await build(
      this.getConfig(),
    ))
    debug?.('prod build end')
    await this.buildSubPackage()
    logBuildAppFinish()
    return output as RollupOutput | RollupOutput[]
  }

  async build() {
    debug?.('build start')
    if (this.isDev) {
      await this.runDev()
    }
    else {
      await this.runProd()
    }
    debug?.('build end')
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
      logLevel: 'warn',
    })
    this.inlineConfig.plugins ??= []
    this.inlineConfig.plugins?.push(tsconfigPaths(this.inlineConfig.weapp?.tsconfigPaths))
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
    debug?.('buildNpm start')
    const { build: tsupBuild } = await import('tsup')
    const isDependenciesCacheOutdate = await this.checkDependenciesCacheOutdate()

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
                  config: false,
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
    debug?.('buildNpm end')
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
    debug?.('scanAppEntry start')
    this.resetEntries()
    const appDirname = path.resolve(this.cwd, this.srcRoot)
    const appBasename = path.resolve(appDirname, 'app')
    const appConfigFile = await findJsonEntry(appBasename)
    const appEntryPath = await findJsEntry(appBasename)
    // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
    // js + json
    if (appEntryPath && appConfigFile) {
      const config = await this.readCommentJson(appConfigFile) as unknown as AppJson & {
        // subpackages 的别名，2个都支持
        subpackages: SubPackage[]
        subPackages: SubPackage[]
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
          const sitemapJsonPath = await findJsonEntry(path.resolve(appDirname, sitemapLocation))
          if (sitemapJsonPath) {
            appEntry.sitemapJsonPath = sitemapJsonPath
            appEntry.sitemapJson = await this.readCommentJson(sitemapJsonPath) as SitemapJson
          }
        }
        // theme.json
        if (themeLocation) {
          const themeJsonPath = await findJsonEntry(path.resolve(appDirname, themeLocation))
          if (themeJsonPath) {
            appEntry.themeJsonPath = themeJsonPath
            appEntry.themeJson = await this.readCommentJson(themeJsonPath) as ThemeJson
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
          if (sub.independent || this.inlineConfig.weapp?.subPackages?.[sub.root]?.independent) {
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
        debug?.('scanAppEntry end')
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
    debug?.('scanComponentEntry start', componentEntry)
    const baseName = removeExtension(path.resolve(dirname, componentEntry))
    const jsEntry = await findJsEntry(baseName)
    const partialEntry: Entry = {
      path: jsEntry!,
    }
    if (jsEntry && !this.entriesSet.has(jsEntry)) {
      this.entriesSet.add(jsEntry)
      this.entries.push(partialEntry)
    }
    const configFile = await findJsonEntry(baseName)
    if (configFile) {
      const config = await this.readCommentJson(configFile) as unknown as {
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
    debug?.('scanComponentEntry end', componentEntry)
  }

  setRollupWatcher(watcher: RollupWatcher, root: string = '/') {
    const oldWatcher = this.rollupWatcherMap.get(root)
    oldWatcher?.close()
    this.rollupWatcherMap.set(root, watcher)
  }

  // 独立分包需要单独打包
  async buildSubPackage() {
    debug?.('buildSubPackage start')
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
        await new Promise((resolve, reject) => {
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
      }
      else {
        logBuildIndependentSubPackageFinish(root)
      }
    }
    debug?.('buildSubPackage end')
  }
}

export async function createCompilerContext(options?: CompilerContextOptions) {
  const ctx = new CompilerContext(options)
  await ctx.loadDefaultConfig()
  return ctx
}
