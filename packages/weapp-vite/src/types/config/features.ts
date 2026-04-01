import type { InlineConfig } from 'vite'
import type { PageLayoutMeta, WevuDefaults } from 'wevu'
import type {
  AlipayNpmMode,
  BuildNpmPackageMeta,
  MpPlatform,
  NpmBuildOptions,
  NpmMainPackageConfig,
  NpmPluginPackageConfig,
  NpmSubPackageConfig,
  SubPackageStyleConfigEntry,
} from './foundation'
import type { Resolver } from '@/auto-import-components/resolvers'

export { type Resolver }

/**
 * @description 自动导入组件配置
 */
export interface AutoImportComponents {
  /**
   * @description 组件扫描范围
   */
  globs?: string[]
  /**
   * @description 组件解析器列表
   */
  resolvers?: Resolver[]
  /**
   * @description 组件清单输出路径
   */
  output?: string | boolean
  /**
   * @description WXML 组件 props 类型声明输出路径
   */
  typedComponents?: boolean | string
  /**
   * @description VS Code HTML customData 输出路径
   */
  htmlCustomData?: boolean | string
  /**
   * @description Vue SFC 组件声明输出路径
   */
  vueComponents?: boolean | string
  /**
   * @description 生成 `components.d.ts` 时使用的运行时模块名
   */
  vueComponentsModule?: string
}

export type AutoImportComponentsOption = AutoImportComponents | boolean

export type EnhanceWxmlOptions = ScanWxmlOptions & HandleWxmlOptions

/**
 * @description WXML 扫描阶段配置
 */
export interface ScanWxmlOptions {
  excludeComponent?: (tagName: string) => boolean
  platform?: MpPlatform
}

/**
 * @description WXML 处理阶段配置
 */
export interface HandleWxmlOptions {
  removeComment?: boolean
  transformEvent?: boolean
  scriptModuleExtension?: string
  scriptModuleTag?: string
  templateExtension?: string
}

export interface EnhanceOptions {
  wxml?: boolean | Partial<Omit<EnhanceWxmlOptions, 'platform'>>
  wxs?: boolean
  autoImportComponents?: AutoImportComponentsOption
}

/**
 * @description 多平台 project.config 配置
 */
export interface MultiPlatformConfig {
  enabled?: boolean
  projectConfigRoot?: string
}

/**
 * @description MCP 服务配置
 */
export interface WeappMcpConfig {
  enabled?: boolean
  autoStart?: boolean
  host?: string
  port?: number
  endpoint?: string
}

/**
 * @description 自动路由配置
 */
export type WeappAutoRoutesIncludePattern = string | RegExp

/**
 * @description 自动路由包含规则
 */
export type WeappAutoRoutesInclude = WeappAutoRoutesIncludePattern | WeappAutoRoutesIncludePattern[]

/**
 * @description 自动路由配置
 */
export interface WeappAutoRoutesConfig {
  enabled?: boolean
  typedRouter?: boolean
  /**
   * @description 自动路由扫描规则，支持字符串 glob、正则以及它们的数组
   * @remarks 默认会扫描主包 `pages/**`，以及已声明分包 root 下的 `pages/**`
   */
  include?: WeappAutoRoutesInclude
  /**
   * @description 是否启用自动路由持久化缓存，或指定自定义缓存文件路径
   * @default false
   */
  persistentCache?: boolean | string
  watch?: boolean
}

/**
 * @description `@wevu/api` 注入配置
 */
export interface WeappInjectWeapiConfig {
  enabled?: boolean
  replaceWx?: boolean
  globalName?: string
}

export type WeappInjectRequestGlobalsTarget
  = | 'fetch'
    | 'Headers'
    | 'Request'
    | 'Response'
    | 'AbortController'
    | 'AbortSignal'
    | 'XMLHttpRequest'

/**
 * @description 请求相关全局对象注入配置
 */
export interface WeappInjectRequestGlobalsConfig {
  enabled?: boolean
  targets?: WeappInjectRequestGlobalsTarget[]
  dependencies?: (string | RegExp)[]
}

/**
 * @description 本地 npm 构建配置
 */
export interface WeappNpmConfig {
  enable?: boolean
  cache?: boolean
  mainPackage?: NpmMainPackageConfig
  pluginPackage?: NpmPluginPackageConfig
  subPackages?: Record<string, NpmSubPackageConfig>
  buildOptions?: (options: NpmBuildOptions, pkgMeta: BuildNpmPackageMeta) => NpmBuildOptions | undefined
  alipayNpmMode?: AlipayNpmMode
}

/**
 * @description 分包级额外配置
 */
export interface WeappSubPackageConfig {
  independent?: boolean
  inlineConfig?: Partial<InlineConfig>
  autoImportComponents?: AutoImportComponentsOption
  watchSharedStyles?: boolean
  styles?: SubPackageStyleConfigEntry | SubPackageStyleConfigEntry[]
}

/**
 * @description HMR 配置
 */
export interface WeappHmrConfig {
  sharedChunks?: 'full' | 'auto' | 'off'
  touchAppWxss?: boolean | 'auto'
}

/**
 * @description worker 构建配置
 */
export interface WeappWorkerConfig {
  entry?: string | string[]
}

/**
 * @description Vue 模板编译配置
 */
export interface WeappVueTemplateConfig {
  removeComments?: boolean
  simplifyWhitespace?: boolean
  scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
  scopedSlotsRequireProps?: boolean
  slotMultipleInstance?: boolean
  classStyleRuntime?: 'auto' | 'wxs' | 'js'
  objectLiteralBindMode?: 'runtime' | 'inline'
  mustacheInterpolation?: 'compact' | 'spaced'
  classStyleWxsShared?: boolean
}

/**
 * @description Vue 支持配置
 */
export interface WeappVueConfig {
  enable?: boolean
  template?: WeappVueTemplateConfig
  autoImport?: boolean
}

/**
 * @description wevu 编译期默认值配置
 */
export interface WeappWevuConfig {
  preset?: 'performance'
  defaults?: WevuDefaults
  autoSetDataPick?: boolean
}

export interface WeappRouteRule {
  appLayout?: PageLayoutMeta
}

export type WeappRouteRules = Record<string, WeappRouteRule>
