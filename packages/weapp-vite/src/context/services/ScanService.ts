import type { AppEntry, ComponentEntry, Entry, EntryJsonFragment, SubPackage, SubPackageMetaValue } from '@/types'
import type { App as AppJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { AutoImportService, ConfigService, JsonService, SubPackageService, WxmlService } from '.'
import { changeFileExtension, findJsEntry, findJsonEntry, findTemplateEntry, resolveImportee } from '@/utils'
import { get, isObject, removeExtension, set } from '@weapp-core/shared'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import path from 'pathe'
import { debug } from '../shared'
import { Symbols } from '../Symbols'

export interface JsonFragment {
  json: {
    usingComponents?: Record<string, string>
    component?: boolean
  }
  jsonPath?: string
  virtualJson?: boolean
}

@injectable()
export class ScanService {
  entriesSet: Set<string>
  entries: Entry[]
  appEntry?: AppEntry
  pagesSet!: Set<string>
  // 处理循环依赖
  componentEntrySet: Set<string>

  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
    @inject(Symbols.JsonService)
    private readonly jsonService: JsonService,
    @inject(Symbols.SubPackageService)
    private readonly subPackageService: SubPackageService,
    @inject(Symbols.AutoImportService)
    private readonly autoImportService: AutoImportService,
    @inject(Symbols.WxmlService)
    private readonly wxmlService: WxmlService,
  ) {
    // 初始化配置服务
    this.entries = [] // 初始化入口文件数组
    this.entriesSet = new Set() // 初始化入口文件集合
    this.componentEntrySet = new Set()
  }

  // https://github.com/vitejs/vite/blob/192d555f88bba7576e8a40cc027e8a11e006079c/packages/vite/src/node/plugins/define.ts#L41

  initPagesSet() {
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

  /**
   * 扫描 usingComponents 字段进行解析
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
        if (tokens[0] && isObject(this.configService.packageJson.dependencies) && Reflect.has(this.configService.packageJson.dependencies, tokens[0])) {
          continue
        }
        // start with '/' 表述默认全局别名
        else if (tokens[0] === '') {
          await this.scanComponentEntry(componentUrl.substring(1), path.resolve(this.configService.cwd, this.configService.srcRoot), subPackageMeta)
        }
        else {
          // 处理别名
          const importee = resolveImportee(componentUrl, entry, this.configService.aliasEntries)
          // 扫描组件
          await this.scanComponentEntry(importee, relDir, subPackageMeta)
        }
      }
    }
  }

  resetEntries() {
    this.entriesSet.clear()
    this.componentEntrySet.clear()
    this.wxmlService.clear()
    this.entries.length = 0
    this.subPackageService.metaMap = {}
  }

  resetAutoImport() {
    this.autoImportService.potentialComponentMap.clear()
    this.wxmlService.wxmlComponentsMap.clear()
  }

  async loadAppEntry() {
    const appDirname = path.resolve(this.configService.cwd, this.configService.srcRoot)
    const appBasename = path.resolve(appDirname, 'app')
    const appConfigFile = await findJsonEntry(appBasename)
    const appEntryPath = await findJsEntry(appBasename)
    // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
    // js + json
    if (appEntryPath && appConfigFile) {
      const config = await this.jsonService.read(appConfigFile) as unknown as AppJson & {
        // subpackages 的别名，2个都支持
        subpackages: SubPackage[]
        subPackages: SubPackage[]
      }
      if (isObject(config)) {
        const appEntry: AppEntry = {
          path: appEntryPath,
          json: config,
          jsonPath: appConfigFile,
          type: 'app',
        }

        this.appEntry = appEntry

        const { sitemapLocation = 'sitemap.json', themeLocation = 'theme.json' } = config
        // sitemap.json
        if (sitemapLocation) {
          const sitemapJsonPath = await findJsonEntry(path.resolve(appDirname, sitemapLocation))
          if (sitemapJsonPath) {
            appEntry.sitemapJsonPath = sitemapJsonPath
            appEntry.sitemapJson = await this.jsonService.read(sitemapJsonPath) as SitemapJson
          }
        }
        // theme.json
        if (themeLocation) {
          const themeJsonPath = await findJsonEntry(path.resolve(appDirname, themeLocation))
          if (themeJsonPath) {
            appEntry.themeJsonPath = themeJsonPath
            appEntry.themeJson = await this.jsonService.read(themeJsonPath) as ThemeJson
          }
        }

        return appEntry
      }
    }
    else {
      throw new Error(`在 ${appDirname} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
    }
  }

  async scanAppEntry() {
    debug?.('scanAppEntry start')
    this.resetEntries()
    const appDirname = path.resolve(this.configService.cwd, this.configService.srcRoot)
    // https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
    // js + json
    if (this.appEntry) {
      const { path: appEntryPath, json: config } = this.appEntry

      if (this.entriesSet.has(appEntryPath)) {
        return
      }
      this.entriesSet.add(appEntryPath)
      this.entries.push(this.appEntry)
      this.pagesSet = this.initPagesSet()

      const { pages, subpackages = [], subPackages = [] } = config! as unknown as AppJson & {
        // subpackages 的别名，2个都支持
        subpackages: SubPackage[]
        subPackages: SubPackage[]
      }

      // https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html
      // 优先 subPackages
      const subs: SubPackage[] = [...subpackages, ...subPackages]
      // 全局组件
      await this.usingComponentsHandler(this.appEntry, appDirname)
      // 页面
      if (Array.isArray(pages)) {
        for (const page of pages) {
          await this.scanComponentEntry(page, appDirname)
        }
      }
      // 分包
      for (const sub of subs) {
        // 独立分包
        if (sub.independent || this.configService.inlineConfig.weapp?.subPackages?.[sub.root]?.independent) {
          const meta: SubPackageMetaValue = {
            entries: [],
            entriesSet: new Set(),
            // 合并选项
            subPackage: {
              ...sub,
              dependencies: this.configService.inlineConfig.weapp?.subPackages?.[sub.root].dependencies,
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
          this.subPackageService.metaMap[sub.root] = meta
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
      if (get(this.appEntry, 'json.tabBar.custom')) {
        await this.scanComponentEntry('custom-tab-bar/index', appDirname)
      }
      // 全局工具栏
      // https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/appbar.html
      if (get(this.appEntry, 'json.appBar')) {
        await this.scanComponentEntry('app-bar/index', appDirname)
      }
      debug?.('scanAppEntry end')
    }
    else {
      throw new Error(`没有先执行 loadAppEntry 方法加载全局 app.json 配置`)
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
    // 处理循环依赖
    if (this.componentEntrySet.has(componentEntry)) {
      debug?.(`${componentEntry} 已经被扫描过`)
      // 请确认是否存在循环依赖的情况，这会导致开发者工具死循环白屏
      return
    }
    const meta = subPackageMeta ?? {
      entriesSet: this.entriesSet,
      entries: this.entries,
    }
    debug?.('scanComponentEntry start', componentEntry)

    let baseName = removeExtension(path.resolve(dirname, componentEntry))
    // 处理引入最后忽略 index 的情况
    // 处理文件夹的引入情况
    if (await fs.exists(baseName)) {
      const stat = await fs.stat(baseName)
      if (stat.isDirectory()) {
        baseName = path.join(baseName, 'index')
      }
    }
    // 找 js 入口
    const jsEntry = await findJsEntry(baseName)
    // 有可能是走自动引入
    // if (!jsEntry) {
    //   logger.warn(`没有找到 ${baseName} 的 js 入口文件!`)
    // }

    const partialEntry: Partial<Entry> = {
      path: jsEntry!,
    }

    // 添加到 meta.entries 中去，最终进行 dump
    if (jsEntry && !meta.entriesSet.has(jsEntry)) {
      meta.entriesSet.add(jsEntry)
      meta.entries.push(partialEntry as Entry)
    }
    // 找 json
    const configFile = await findJsonEntry(baseName)
    // 默认 config, 假如 json 不存在也是允许的，此时自动导入也会生效, 会塞一个 json 在产物中
    const config: JsonFragment['json'] = {}

    const jsonFragment: JsonFragment = {
      json: config,
      jsonPath: configFile,
    }
    // 是否存在可观测的 json
    if (configFile) {
      jsonFragment.json = await this.jsonService.read(configFile) as unknown as {
        usingComponents: Record<string, string>
        component?: boolean
      }
    }
    else {
      // 创建虚拟  json
      jsonFragment.jsonPath = changeFileExtension(baseName, '.json')
      jsonFragment.virtualJson = true
    }

    if (jsEntry) {
      partialEntry.json = jsonFragment.json
      partialEntry.jsonPath = jsonFragment.jsonPath
    }
    // 找模板
    const templatePath = await findTemplateEntry(baseName)
    if (templatePath) {
      (partialEntry as ComponentEntry).templatePath = templatePath
      const res = await this.wxmlService.scan(templatePath)
      if (res) {
        const { components } = res
        this.wxmlService.setWxmlComponentsMap(templatePath, components)
      }

      if (isObject(config) && config.component === true) {
        partialEntry.type = 'component'
      }

      else {
        const pagePath = this.configService.relativeSrcRoot(this.configService.relativeCwd(baseName))
        // TODO 需要获取到所有的 pages 包括分包
        if (this.pagesSet.has(pagePath)) {
          partialEntry.type = 'page'
        }
      }
    }
    // #region 自动导入组件添加组件到 json 里
    const hit = this.wxmlService.wxmlComponentsMap.get(baseName)

    if (hit) {
      const depComponentNames = Object.keys(hit)
      // jsonFragment 为目标
      debug?.(this.autoImportService.potentialComponentMap, jsonFragment.json.usingComponents)
      for (const depComponentName of depComponentNames) {
        // auto import globs
        const res = this.autoImportService.potentialComponentMap.get(depComponentName)
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
        else if (Array.isArray(this.configService.inlineConfig.weapp?.enhance?.autoImportComponents?.resolvers)) {
          for (const resolver of this.configService.inlineConfig.weapp.enhance.autoImportComponents.resolvers) {
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
    // #endregion
    // 处理循环依赖
    this.componentEntrySet.add(componentEntry)
    if (isObject(config)) {
      await this.usingComponentsHandler(jsonFragment as EntryJsonFragment, path.dirname(baseName), subPackageMeta)
    }

    debug?.('scanComponentEntry end', componentEntry, partialEntry)
  }

  // https://developers.weixin.qq.com/miniprogram/dev/framework/workers.html
  get workersOptions() {
    return this.appEntry?.json?.workers
  }

  get workersDir() {
    return typeof this.workersOptions === 'object' ? this.workersOptions.path : this.workersOptions
  }

  // https://cn.vitejs.dev/guide/build.html#library-mode
  // miniprogram_dist
  // miniprogram
  // https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6%E7%9B%B8%E5%85%B3%E7%A4%BA%E4%BE%8B
  // #endregion
}
