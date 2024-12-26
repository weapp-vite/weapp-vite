import type { App as AppJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { PackageJson } from 'pkg-types'
import type { RollupOutput, RollupWatcher } from 'rollup'
import type { ResolvedValue } from '../auto-import-components/resolvers'
import type { OutputExtensions } from '../defaults'
import type { AppEntry, ComponentEntry, ComponentsMap, Entry, EntryJsonFragment, MpPlatform, ProjectConfig, ResolvedAlias, SubPackage, SubPackageMetaValue } from '../types'
import type { LoadConfigResult } from './loadConfig'
import type { NpmService } from './NpmService'
import type { WxmlService } from './WxmlService'
import process from 'node:process'
import { defu, get, isObject, removeExtension, removeExtensionDeep, set } from '@weapp-core/shared'
import { deleteAsync } from 'del'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import path from 'pathe'
import pm from 'picomatch'
import { build, type InlineConfig } from 'vite'
import { defaultExcluded, getOutputExtensions } from '../defaults'
import { vitePluginWeapp } from '../plugins'
import { findJsEntry, findJsonEntry, findTemplateEntry, resolveImportee } from '../utils'
import { buildSubPackage, readCommentJson } from './methods'
import { debug, logger } from './shared'
import { Symbols } from './Symbols'
import '../config'

@injectable()
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
  potentialComponentMap: Map<string, {
    entry: Entry
    value: ResolvedValue
  }>

  appEntry?: AppEntry

  subPackageMeta: Record<string, SubPackageMetaValue>

  aliasEntries: ResolvedAlias[]

  platform: MpPlatform

  outputExtensions: OutputExtensions

  /**
   * esbuild 定义的环境变量
   */
  defineEnv: Record<string, any>

  wxmlComponentsMap: Map<string, ComponentsMap>

  wxmlService: WxmlService

  npmService: NpmService
  /**
   * 构造函数用于初始化编译器上下文对象
   * @param options 可选的编译器上下文配置对象
   */
  constructor(
    options: LoadConfigResult,
    @inject(Symbols.NpmService)
    npmService: NpmService,
    @inject(Symbols.WxmlService)
    wxmlService: WxmlService,
  ) {
    // 使用defu函数合并默认配置和用户提供的配置，并解构赋值
    const opts = defu<Required<LoadConfigResult>, Partial<LoadConfigResult>[]>(options, {
      cwd: process.cwd(), // 当前工作目录，默认为进程的当前目录
      isDev: false, // 是否为开发模式，默认为false
      projectConfig: {}, // 项目配置对象，默认为空对象
      config: {}, // 内联配置对象，默认为空对象
      packageJson: {}, // package.json内容对象，默认为空对象
      platform: 'weapp', // 目标平台，默认为微信小程序平台
    })
    const { cwd, isDev, config, projectConfig, mode, packageJson, platform } = opts
    this.cwd = cwd // 设置当前工作目录
    this.inlineConfig = config // 设置内联配置
    this.isDev = isDev // 设置是否为开发模式
    this.projectConfig = projectConfig // 设置项目配置
    this.mode = mode // 设置模式
    this.packageJson = packageJson // 设置package.json内容
    this.rollupWatcherMap = new Map() // 初始化rollup监视器映射
    this.subPackageMeta = {} // 初始化子包元数据对象
    this.entriesSet = new Set() // 初始化入口文件集合
    this.entries = [] // 初始化入口文件数组
    this.potentialComponentMap = new Map() // 初始化潜在组件映射
    this.aliasEntries = [] // 初始化别名入口数组
    this.platform = platform // 设置目标平台
    this.outputExtensions = getOutputExtensions(platform) // 根据平台获取输出文件扩展名
    this.defineEnv = {} // 初始化定义的环境变量对象
    this.wxmlComponentsMap = new Map() // 初始化wxml组件映射
    this.wxmlService = wxmlService // 初始化入口文件集合
    this.npmService = npmService
  }

  // https://github.com/vitejs/vite/blob/192d555f88bba7576e8a40cc027e8a11e006079c/packages/vite/src/node/plugins/define.ts#L41
  /**
   * 插件真正计算出来的 define options
   */
  /**
   * 获取编译上下文中的环境变量定义，用于在小程序环境中暴露全局变量。
   * 该函数将当前平台、用户自定义的环境变量合并，并将其转换为 import.meta.env 对象的属性。
   * @returns {Record<string, any>} 包含所有环境变量的对象，键为 import.meta.env 下的属性名，值为对应的环境变量值。
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

  relativeCwd(p: string) {
    return path.relative(this.cwd, p)
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

  getPagesSet() {
    const set = new Set<string>()
    const pages = this.appEntry?.json?.pages
    pages?.forEach((x) => {
      set.add(x)
    })
    this.appEntry?.json?.subPackages?.forEach((subPkg) => {
      subPkg.pages?.forEach((page) => {
        set.add(`${subPkg.root}/${page}`)
      })
    })
    this.appEntry?.json?.subpackages?.forEach((subPkg) => {
      subPkg.pages?.forEach((page) => {
        set.add(`${subPkg.root}/${page}`)
      })
    })
    return set
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
    this.wxmlService.clear()
    this.entries.length = 0
    this.subPackageMeta = {}
  }

  resetAutoImport() {
    this.potentialComponentMap.clear()
    this.wxmlComponentsMap.clear()
  }

  resolvedComponentName(entry: string) {
    const base = path.basename(entry)
    if (base === 'index') {
      const dirName = path.dirname(entry)
      if (dirName === '.') {
        return
      }
      return path.basename(dirName)
    }
    return base
    // components/HelloWorld/index.ts => HelloWorld
    // components/HelloWorld/HelloWorld.ts => HelloWorld
  }

  // for auto import
  async scanPotentialComponentEntries(filePath: string) {
    const baseName = removeExtension(filePath)
    const jsEntry = await findJsEntry(baseName)
    if (!jsEntry) { // || this.entriesSet.has(jsEntry)
      return
    }
    if (jsEntry) {
      const jsonPath = await findJsonEntry(baseName)
      if (jsonPath) {
        const json = await this.readCommentJson(jsonPath)
        if (json?.component) { // json.component === true
          const partialEntry: Entry = {
            path: jsEntry,
            json,
            jsonPath,
            type: 'component',
            templatePath: filePath,
          }
          const componentName = this.resolvedComponentName(baseName)
          if (componentName) {
            if (this.potentialComponentMap.has(componentName)) {
              logger.warn(`发现组件重名! 跳过组件 ${this.relativeCwd(baseName)} 的自动引入`)
              return
            }
            this.potentialComponentMap.set(componentName, {
              entry: partialEntry,
              value: {
                name: componentName,
                from: `/${this.relativeSrcRoot(
                  this.relativeCwd(
                    removeExtensionDeep(partialEntry.jsonPath!),
                  ),
                )}`,
              },
            })
          }
        }
      }
    }
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
        // 全局组件
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
  /**
   * 扫描并处理组件入口文件。
   * @param componentEntry 组件入口文件名
   * @param dirname 当前目录路径
   * @param subPackageMeta 分包元信息（可选）
   * @returns Promise<void>
   *
   * 该函数用于扫描并处理组件入口文件，包括查找 JS 入口、JSON 配置文件、模板入口等。
   * 同时处理引入组件的情况，自动注入 usingComponents。
   */
  async scanComponentEntry(componentEntry: string, dirname: string, subPackageMeta?: SubPackageMetaValue) {
    const meta = subPackageMeta ?? {
      entriesSet: this.entriesSet,
      entries: this.entries,
    }
    debug?.('scanComponentEntry start', componentEntry)
    let baseName = removeExtension(path.resolve(dirname, componentEntry))
    // 处理引入最后忽略 index 的情况
    if (await fs.exists(baseName)) {
      const stat = await fs.stat(baseName)
      if (stat.isDirectory()) {
        baseName = path.join(baseName, 'index')
      }
    }

    const jsEntry = await findJsEntry(baseName)
    const partialEntry: Partial<Entry> = {
      path: jsEntry!,
    }
    if (jsEntry && !meta.entriesSet.has(jsEntry)) {
      meta.entriesSet.add(jsEntry)
      meta.entries.push(partialEntry as Entry)
    }
    const configFile = await findJsonEntry(baseName)
    if (configFile) {
      const config = await this.readCommentJson(configFile) as unknown as {
        usingComponents: Record<string, string>
        component?: boolean
      }
      const jsonFragment = {
        json: config,
        jsonPath: configFile,
      }

      // inject
      const hit = this.wxmlComponentsMap.get(baseName)

      if (hit) {
        const depComponentNames = Object.keys(hit)
        // jsonFragment 为目标
        debug?.(this.potentialComponentMap, jsonFragment.json.usingComponents)
        for (const depComponentName of depComponentNames) {
          // auto import globs
          const res = this.potentialComponentMap.get(depComponentName)
          if (res) {
            // componentEntry 为目标引入组件
            const { entry: componentEntry, value } = res
            if (componentEntry?.jsonPath) {
              if (isObject(jsonFragment.json.usingComponents) && Reflect.has(jsonFragment.json.usingComponents, value.name)) {
                continue
              }
              set(jsonFragment.json, `usingComponents.${value.name}`, value.from)
            }
          }
          // resolvers
          else if (Array.isArray(this.inlineConfig.weapp?.enhance?.autoImportComponents?.resolvers)) {
            for (const resolver of this.inlineConfig.weapp.enhance.autoImportComponents.resolvers) {
              const value = resolver(depComponentName, baseName)
              if (value) {
                // 重复
                if (!(isObject(jsonFragment.json.usingComponents) && Reflect.has(jsonFragment.json.usingComponents, value.name))) {
                  set(jsonFragment.json, `usingComponents.${value.name}`, value.from)
                }
              }
            }
          }
        }
      }

      if (jsEntry) {
        partialEntry.json = jsonFragment.json
        partialEntry.jsonPath = jsonFragment.jsonPath
      }
      const pagesSet = this.getPagesSet()
      const templatePath = await findTemplateEntry(baseName)
      if (templatePath) {
        (partialEntry as ComponentEntry).templatePath = templatePath

        if (isObject(config) && config.component === true) {
          partialEntry.type = 'component'
        }
        else {
          const pagePath = this.relativeSrcRoot(this.relativeCwd(baseName))
          // TODO 需要获取到所有的 pages 包括分包
          if (pagesSet.has(pagePath)) {
            partialEntry.type = 'page'
          }
        }
      }

      if (isObject(config)) {
        await this.usingComponentsHandler(jsonFragment as EntryJsonFragment, path.dirname(configFile), subPackageMeta)
      }
    }
    debug?.('scanComponentEntry end', componentEntry)
  }

  setRollupWatcher(watcher: RollupWatcher, root: string = '/') {
    const oldWatcher = this.rollupWatcherMap.get(root)
    oldWatcher?.close()
    this.rollupWatcherMap.set(root, watcher)
  }

  // eslint-disable-next-line ts/no-unused-vars
  autoImportFilter(id: string, meta?: SubPackageMetaValue): boolean {
    if (this.inlineConfig.weapp?.enhance?.autoImportComponents?.globs) {
      const isMatch = pm(this.inlineConfig.weapp.enhance.autoImportComponents.globs, {
        cwd: this.cwd,
        windows: true,
        posixSlashes: true,
      })
      return isMatch(id)
    }
    return false
  }

  // #region placeholder for class type
  async buildSubPackage(): Promise<void> { }

  /**
   * 不修改 ctx
   */
  // eslint-disable-next-line ts/no-unused-vars
  async readCommentJson(filepath: string): Promise<any> { }
  // https://cn.vitejs.dev/guide/build.html#library-mode
  // miniprogram_dist
  // miniprogram
  // https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
  // #endregion
}

CompilerContext.prototype.buildSubPackage = buildSubPackage
CompilerContext.prototype.readCommentJson = readCommentJson
// CompilerContext.prototype.buildNpm = buildNpm
// CompilerContext.prototype.loadDefaultConfig = loadDefaultConfig
// dependenciesCache(CompilerContext.prototype)
// const ctx = new CompilerContext()
// ctx.readCommentJson()
