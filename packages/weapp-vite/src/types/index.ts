import type { App as AppJson, Component as ComponentJson, Page as PageJson, Sitemap, Theme } from '@weapp-core/schematics'
import type { PackageJson } from 'pkg-types'
import type { Options as TsupOptions } from 'tsup'
import type { InlineConfig, UserConfig as ViteUserConfig } from 'vite'
import type { PluginOptions as TsconfigPathsOptions } from 'vite-tsconfig-paths'
import type { Resolver } from '../auto-import-components/resolvers'

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
// https://nervjs.github.io/taro-docs/docs/GETTING-STARTED#%E7%BC%96%E8%AF%91%E8%BF%90%E8%A1%8C
export type MpPlatform = 'weapp' | 'alipay' | 'tt' // | 'swan' | 'qq' | 'jd' | 'kwai' | 'lark' | 'h5'

export interface SubPackage {
  pages: string[]
  root: string
  // 独立分包
  independent?: boolean
  // 入口文件，也要基于 root
  entry?: string
  name?: string
  // 扩展配置，用于决定独立分包，哪些依赖应该构建npm，哪些应该直接inline code
  // 默认 dependencies 的值同 pkgJson.dependencies
  // 可通过手动设置这个来进行更改
  dependencies?: (string | RegExp)[]
}

export type GenerateExtensionsOptions = Partial<{
  js: 'js' | 'ts' | (string & {})
  json: 'js' | 'ts' | 'json' | (string & {})
  wxml: 'wxml' | (string & {})
  wxss: 'wxss' | 'scss' | 'less' | (string & {})
}>

export type GenerateDirsOptions = Partial<{
  app: string
  page: string
  component: string
}>

export type GenerateFilenamesOptions = Partial<{
  app: string
  page: string
  component: string
}>

export interface GenerateOptions {
  extensions?: GenerateExtensionsOptions
  /**
   * 默认生成文件的相对路径
   */
  dirs?: GenerateDirsOptions
  /**
   * 默认生成文件的名称
   */
  filenames?: GenerateFilenamesOptions
}

export interface CopyOptions {
  include?: CopyGlobs
  exclude?: CopyGlobs
}

export type CopyGlobs = string[] | ((subPackageMeta?: SubPackageMetaValue | undefined) => string[])

export interface AutoImportComponents {
  // resolvers?: any[]
  globs?: string[]

  resolvers?: Resolver[]
}

export interface WxmlDep {
  tagName: string
  start: number
  end: number
  quote: string | null | undefined
  name: string
  value: string
  attrs: Record<string, string>
}

export interface ScanComponentItem {
  start: number
  end: number
}

export type ComponentsMap = Record<string, ScanComponentItem[]>

export interface ProcessWxmlOptions {
  excludeComponent?: (tagName: string) => boolean
  platform?: MpPlatform
  removeComment?: boolean
}

export interface EnhanceOptions {
  /**
   * wxml 增强
   */
  wxml?: boolean | (Partial<Pick<ProcessWxmlOptions, 'removeComment' | 'excludeComponent'>>)
  /**
   * wxs 增强
   */
  wxs?: boolean
  /**
   * 自动导入小程序组件
   */
  autoImportComponents?: AutoImportComponents
}

export interface BuildNpmPackageMeta {
  name: string
  entry: string
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
    tsup?: (options: TsupOptions, pkgMeta: BuildNpmPackageMeta) => TsupOptions | undefined
  }
  /**
   * weapp-vite generate 相关的配置
   */
  generate?: GenerateOptions
  /**
   * 传递给 vite-tsconfig-paths 插件的参数
   */
  tsconfigPaths?: TsconfigPathsOptions

  /**
   * 分包是否独立的 rollup 编译上下文
   * 默认情况下，当一个分包设置了 independent: true 之后会默认启用
   * 可以设置 key: 为 root, value: {independent:true} 来强制启用 独立的 rollup 编译上下文
   */
  subPackages?: Record<string, Pick<SubPackage, 'independent' | 'dependencies'> & {
    autoImportComponents?: AutoImportComponents
  }>

  /**
   * 需要被额外包括的资源
   * 默认情况下包括大部分的图片资源格式
   */
  copy?: CopyOptions

  /**
   * 编译目标平台
   */
  platform?: MpPlatform

  /**
   * 增强配置
   */
  enhance?: EnhanceOptions

}

export type UserConfig = ViteUserConfig & { weapp?: WeappViteConfig }

export interface BaseEntry {
  path: string
  jsonPath?: string
  json?: object
  type: 'app' | 'page' | 'component' | (string & {})
}

export type Entry = AppEntry | PageEntry | ComponentEntry

export interface AppEntry extends BaseEntry {
  type: 'app'
  themeJsonPath?: string
  themeJson?: Theme
  sitemapJsonPath?: string
  sitemapJson?: Sitemap
  json?: AppJson
}

export interface PageEntry extends BaseEntry {
  type: 'page'
  templatePath: string
  json?: PageJson
}

export interface ComponentEntry extends BaseEntry {
  type: 'component'
  templatePath: string
  json?: ComponentJson
}

export type EntryJsonFragment = Omit<BaseEntry, 'path' | 'type'>

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
  platform?: MpPlatform
}

export interface SubPackageMetaValue {
  entriesSet: Set<string>
  entries: Entry[]
  subPackage: SubPackage
}

export {
  TsupOptions,
}
