import type { PackageJson } from 'pkg-types'
import type { Options as TsupOptions } from 'tsup'
import type { InlineConfig, UserConfig as ViteUserConfig } from 'vite'

export interface Alias {
  find: string | RegExp
  replacement: string
}

export interface ResolvedAlias {
  find: string | RegExp
  replacement: string
}

export interface AliasOptions {
  entries?: readonly Alias[] | { [find: string]: string }
}
export interface SubPackage {
  pages: string[]
  root: string
  // 独立分包
  independent?: boolean
  // 入口文件，也要基于 root
  entry?: string
  name?: string
}

export interface WeappViteConfig {
  /**
   * @description 应用入口目录 (app.json 所在的目录)
   * 默认 js 模板在根目录，ts 模板在 miniprogram 目录
   */
  srcRoot?: string
  /**
   * json 配置文件别名
   */
  jsonAlias?: AliasOptions
  /**
   * 构建 npm 相关的配置
   */
  npm?: {
    tsup?: (options: TsupOptions) => TsupOptions | undefined
  }
  /**
   * weapp-vite generate 相关的配置
   */
  generate?: {
    extensions?: Partial<{
      js: string
      json: string
      wxml: string
      wxss: string
    }>
  }
}

export type UserConfig = ViteUserConfig & { weapp?: WeappViteConfig }

export interface BaseEntry {
  path: string
  jsonPath?: string
  json?: object
  type?: string
}

export type Entry = BaseEntry | AppEntry

export interface AppEntry extends BaseEntry {
  type: 'app'
  themeJsonPath?: string
  themeJson?: object
  sitemapJsonPath?: string
  sitemapJson?: object
}

export type EntryJsonFragment = Omit<BaseEntry, 'path'>

export interface ProjectConfig {
  miniprogramRoot?: string
  srcMiniprogramRoot?: string
  setting?: {
    // https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html#%E4%B8%80%E7%BA%A7%E5%AD%97%E6%AE%B5
    packNpmManually?: boolean
    // https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html
    packNpmRelationList?: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[]
  }
}

export interface CompilerContextOptions {
  cwd: string
  inlineConfig?: InlineConfig
  isDev?: boolean
  projectConfig?: ProjectConfig
  mode?: string
  packageJson?: PackageJson
}

export interface SubPackageMetaValue {
  entriesSet: Set<string>
  entries: Entry[]
  subPackage: SubPackage
}

export {
  TsupOptions,
}
