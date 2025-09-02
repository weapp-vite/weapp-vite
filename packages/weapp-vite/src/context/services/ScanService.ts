import type { App as AppJson, Plugin as PluginJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { ConfigService, JsonService } from '.'
import type { AppEntry, EntryJsonFragment, SubPackage, SubPackageMetaValue } from '../../types'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import { inject, injectable } from 'inversify'
import path from 'pathe'
import { findJsEntry, findJsonEntry } from '../../utils'
import { Symbols } from '../Symbols'

export interface JsonFragment {
  json: {
    usingComponents?: Record<string, string>
    component?: boolean
  }
  jsonPath?: string
  virtualJson?: boolean
}

export interface ScanComponentEntryParams {
  componentEntry: string
  dirname: string
  subPackageMeta?: SubPackageMetaValue
}

export interface UsingComponentsHandlerParams {
  entry: EntryJsonFragment
  dirname: string
  subPackageMeta?: SubPackageMetaValue
}

@injectable()
export class ScanService {
  appEntry?: AppEntry

  subPackageMap: Map<string, SubPackageMetaValue>
  independentSubPackageMap: Map<string, SubPackageMetaValue>

  pluginJson?: PluginJson

  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
    @inject(Symbols.JsonService)
    private readonly jsonService: JsonService,
  ) {
    this.subPackageMap = new Map()
    this.independentSubPackageMap = new Map()
  }

  async loadAppEntry() {
    const appDirname = this.configService.absoluteSrcRoot
    const appBasename = path.resolve(appDirname, 'app')
    const { path: appConfigFile } = await findJsonEntry(appBasename)
    const { path: appEntryPath } = await findJsEntry(appBasename)

    if (this.configService.absolutePluginRoot) {
      const pluginBasename = path.resolve(this.configService.absolutePluginRoot, 'plugin')
      const { path: pluginConfigFile } = await findJsonEntry(pluginBasename)
      if (pluginConfigFile) {
        const pluginJson = await this.jsonService.read(pluginConfigFile) as unknown as PluginJson
        this.pluginJson = pluginJson
      }
    }
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
          const { path: sitemapJsonPath } = await findJsonEntry(path.resolve(appDirname, sitemapLocation))
          if (sitemapJsonPath) {
            appEntry.sitemapJsonPath = sitemapJsonPath
            appEntry.sitemapJson = await this.jsonService.read(sitemapJsonPath) as SitemapJson
          }
        }
        // theme.json
        if (themeLocation) {
          const { path: themeJsonPath } = await findJsonEntry(path.resolve(appDirname, themeLocation))
          if (themeJsonPath) {
            appEntry.themeJsonPath = themeJsonPath
            appEntry.themeJson = await this.jsonService.read(themeJsonPath) as ThemeJson
          }
        }

        return appEntry
      }
      else {
        throw new Error(`\`app.json\` 解析失败，请确保 \`app.json\` 文件格式正确`)
      }
    }
    else {
      throw new Error(`在 ${appDirname} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
    }
  }

  loadSubPackages(): SubPackageMetaValue[] {
    const metas: SubPackageMetaValue[] = []
    const json = this.appEntry?.json
    if (json) {
      const independentSubPackages = [
        ...json.subPackages ?? [],
        ...json.subpackages ?? [],
      ] as SubPackage[]
      for (const subPackage of independentSubPackages) {
        const entries: string[] = []

        entries.push(...(subPackage.pages ?? []).map(x => `${subPackage.root}/${x}`))
        if (subPackage.entry) {
          entries.push(`${subPackage.root}/${removeExtensionDeep(subPackage.entry)}`)
        }
        const meta: SubPackageMetaValue = {
          subPackage,
          entries,
        }
        const subPackageConfig = this.configService.weappViteConfig?.subPackages?.[subPackage.root!]
        meta.subPackage.dependencies = subPackageConfig?.dependencies
        meta.subPackage.configFile = subPackageConfig?.configFile
        metas.push(meta)
        // 收集独立分包依赖
        this.subPackageMap.set(subPackage.root!, meta)
        if (subPackage.independent) {
          this.independentSubPackageMap.set(subPackage.root!, meta)
        }
      }

      return metas
    }
    else {
      throw new Error(`在 ${this.configService.absoluteSrcRoot} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
    }
  }

  isMainPackageFileName(fileName: string) {
    return Array.from(this.independentSubPackageMap.keys()).every((root) => {
      return !fileName.startsWith(root)
    })
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
