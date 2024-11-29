import type { App as AppJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { PackageJson } from 'pkg-types'
import type { RollupOutput, RollupWatcher } from 'rollup'
import type { OutputExtensions } from '../defaults'
import type { AppEntry, BaseEntry, CompilerContextOptions, Entry, EntryJsonFragment, MpPlatform, ProjectConfig, ResolvedAlias, SubPackage, SubPackageMetaValue, TsupOptions } from '../types'
import process from 'node:process'
import { defu, get, isObject, objectHash, removeExtension } from '@weapp-core/shared'
import { deleteAsync } from 'del'
import fs from 'fs-extra'
import path from 'pathe'
import { build, type InlineConfig } from 'vite'
import { defaultExcluded, getOutputExtensions } from '../defaults'
import { vitePluginWeapp } from '../plugins'
import { findJsEntry, findJsonEntry, resolveImportee } from '../utils'
import { buildNpm, buildSubPackage, loadDefaultConfig, readCommentJson } from './methods'
import { debug, logger } from './shared'
import '../config'

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
  // for auto import
  potentialComponentEntries: Entry[]

  appEntry?: AppEntry

  subPackageMeta: Record<string, SubPackageMetaValue>

  aliasEntries: ResolvedAlias[]

  platform: MpPlatform

  outputExtensions: OutputExtensions

  /**
   * esbuild 定义的环境变量
   */
  defineEnv: Record<string, any>

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
    this.potentialComponentEntries = []
    this.aliasEntries = []
    this.platform = platform
    this.outputExtensions = getOutputExtensions(platform)
    this.defineEnv = {}
  }

  // https://github.com/vitejs/vite/blob/192d555f88bba7576e8a40cc027e8a11e006079c/packages/vite/src/node/plugins/define.ts#L41
  /**
   * 插件真正计算出来的 define options
   */
  get defineImportMetaEnv() {
    const env = {
      MP_PLATFORM: this.platform,
      ...this.defineEnv,
    }
    const define: Record<string, any> = {}
    for (const [key, value] of Object.entries(env)) {
      define[`import.meta.env.${key}`] = JSON.stringify(value)
    }

    define[`import.meta.env`] = JSON.stringify(env)
    return define
  }

  setDefineEnv(key: string, value: any) {
    this.defineEnv[key] = value
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

  private async runDev() {
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
          define: this.defineImportMetaEnv,
          build: {
            watch: {
              exclude: [
                ...defaultExcluded,
                this.mpDistRoot ? path.join(this.mpDistRoot, '**') : 'dist/**',
              ],
              include: [path.join(this.srcRoot, '**')],
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
          define: this.defineImportMetaEnv,
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
    debug?.('prod build start')
    const output = (await build(
      this.getConfig(),
    ))
    debug?.('prod build end')
    await this.buildSubPackage()
    return output as RollupOutput | RollupOutput[]
  }

  async build() {
    if (this.mpDistRoot) {
      const deletedFilePaths = await deleteAsync(
        [
          path.resolve(this.outDir, '**'),
        ],
        {
          ignore: ['**/miniprogram_npm/**'],
        },
      )
      debug?.('deletedFilePaths', deletedFilePaths)
      logger.success(`已清空 ${this.mpDistRoot} 目录`)
    }
    debug?.('build start')
    if (this.isDev) {
      await this.runDev()
    }
    else {
      await this.runProd()
    }
    debug?.('build end')
  }

  async loadDefaultConfig() {}

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

  /**
   * @deps [this.scanComponentEntry]
   * @param entry
   * @param relDir
   */
  private async usingComponentsHandler(entry: EntryJsonFragment, relDir: string, subPackageMeta?: SubPackageMetaValue) {
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
          await this.scanComponentEntry(componentUrl.substring(1), path.resolve(this.cwd, this.srcRoot), subPackageMeta)
        }
        else {
          // 处理别名
          const importee = resolveImportee(componentUrl, entry, this.aliasEntries)
          // 扫描组件
          await this.scanComponentEntry(importee, relDir, subPackageMeta)
        }
      }
    }
  }

  resetEntries() {
    this.entriesSet.clear()
    this.entries.length = 0
    this.subPackageMeta = {}
  }

  // for auto import
  async scanPotentialComponentEntries(baseName: string) {
    const jsEntry = await findJsEntry(baseName)
    if (!jsEntry || this.entriesSet.has(jsEntry)) {
      return
    }
    if (jsEntry) {
      const jsonPath = await findJsonEntry(baseName)
      if (jsonPath) {
        const json = await fs.readJson(jsonPath, { throws: false })
        if (json && json.component) { // json.component === true
          const partialEntry: BaseEntry = {
            path: jsEntry,
            json,
            jsonPath,
            // type: 'component',
          }
          this.potentialComponentEntries.push(partialEntry)
        }
      }
    }
    // return false
    // const jsEntry = await findJsEntry(baseName)
    // const partialEntry: Entry = {
    //   path: jsEntry!,
    // }
    // const configFile = await findJsonEntry(baseName)
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
              // 合并选项
              subPackage: {
                ...sub,
                dependencies: this.inlineConfig.weapp?.subPackages?.[sub.root].dependencies,
              },
            }

            if (Array.isArray(sub.pages)) {
              for (const page of sub.pages) {
                await this.scanComponentEntry(path.join(sub.root, page), appDirname, meta)
              }
            }
            if (sub.entry) {
              await this.scanComponentEntry(path.join(sub.root, sub.entry), appDirname, meta)
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
        // 全局工具栏
        // https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/appbar.html
        if (get(appEntry, 'json.appBar')) {
          await this.scanComponentEntry('app-bar/index', appDirname)
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
  async scanComponentEntry(componentEntry: string, dirname: string, subPackageMeta?: SubPackageMetaValue) {
    const meta = subPackageMeta ?? {
      entriesSet: this.entriesSet,
      entries: this.entries,
    }
    debug?.('scanComponentEntry start', componentEntry)
    let baseName = removeExtension(path.resolve(dirname, componentEntry))
    if (await fs.exists(baseName)) {
      const stat = await fs.stat(baseName)
      if (stat.isDirectory()) {
        baseName = path.join(baseName, 'index')
      }
    }

    const jsEntry = await findJsEntry(baseName)
    const partialEntry: Entry = {
      path: jsEntry!,
    }
    if (jsEntry && !meta.entriesSet.has(jsEntry)) {
      meta.entriesSet.add(jsEntry)
      meta.entries.push(partialEntry)
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
        await this.usingComponentsHandler(jsonFragment, path.dirname(configFile), subPackageMeta)
      }
    }
    debug?.('scanComponentEntry end', componentEntry)
  }

  setRollupWatcher(watcher: RollupWatcher, root: string = '/') {
    const oldWatcher = this.rollupWatcherMap.get(root)
    oldWatcher?.close()
    this.rollupWatcherMap.set(root, watcher)
  }

  async buildSubPackage(): Promise<void> { }

  /**
   * 不修改 ctx
   */
  // eslint-disable-next-line ts/no-unused-vars
  async readCommentJson(filepath: string): Promise<any> { }
  // eslint-disable-next-line ts/no-unused-vars
  autoImportFilter(id: string, meta?: SubPackageMetaValue): boolean {
    return false
  }

  // https://cn.vitejs.dev/guide/build.html#library-mode
  // miniprogram_dist
  // miniprogram
  // https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
  // eslint-disable-next-line ts/no-unused-vars
  async buildNpm(subPackage?: SubPackage, options?: TsupOptions) { }
}

CompilerContext.prototype.buildSubPackage = buildSubPackage
CompilerContext.prototype.readCommentJson = readCommentJson
CompilerContext.prototype.buildNpm = buildNpm
CompilerContext.prototype.loadDefaultConfig = loadDefaultConfig
// const ctx = new CompilerContext()
// ctx.readCommentJson()