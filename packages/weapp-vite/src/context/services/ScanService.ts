import type { AppEntry, EntryJsonFragment, SubPackage, SubPackageMetaValue } from '@/types'
import type { App as AppJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { AutoImportService, ConfigService, JsonService, WxmlService } from '.'
import { findJsEntry, findJsonEntry } from '@/utils'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import { inject, injectable } from 'inversify'
import path from 'pathe'
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

  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
    @inject(Symbols.JsonService)
    private readonly jsonService: JsonService,
    @inject(Symbols.AutoImportService)
    private readonly autoImportService: AutoImportService,
    @inject(Symbols.WxmlService)
    private readonly wxmlService: WxmlService,
  ) {
    this.subPackageMap = new Map()
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

  resetEntries() {
    this.wxmlService.clearAll()
    this.autoImportService.potentialComponentMap.clear()
  }

  async loadAppEntry() {
    const appDirname = this.configService.absoluteSrcRoot
    const appBasename = path.resolve(appDirname, 'app')
    const { path: appConfigFile } = await findJsonEntry(appBasename)
    const { path: appEntryPath } = await findJsEntry(appBasename)
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

  loadIndependentSubPackage(): SubPackageMetaValue[] {
    const metas: SubPackageMetaValue[] = []
    const json = this.appEntry?.json
    if (json) {
      for (const subPackage of [...json.subPackages ?? [], ...json.subpackages ?? []].filter(x => x.independent)) {
        const entries: string[] = []

        entries.push(...(subPackage.pages ?? []).map(x => `${subPackage.root}/${x}`))
        if (subPackage.entry) {
          entries.push(`${subPackage.root}/${removeExtensionDeep(subPackage.entry)}`)
        }
        const meta = {
          subPackage: subPackage as SubPackage,
          entries,
        }
        metas.push(meta)
        // 收集独立分包依赖
        this.subPackageMap.set(subPackage.root!, meta)
      }

      return metas
    }
    else {
      throw new Error(`在 ${this.configService.absoluteSrcRoot} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
    }
  }

  // isSubPackagePath(p: string, root: string = '') {
  //   const subPackageMeta = this.subPackageMap.get(root)
  //   if (subPackageMeta) {
  //     return p.startsWith(subPackageMeta.subPackage.root)
  //   }
  //   return false
  // }

  isMainPackageFileName(fileName: string) {
    return Array.from(this.subPackageMap.keys()).every((root) => {
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
