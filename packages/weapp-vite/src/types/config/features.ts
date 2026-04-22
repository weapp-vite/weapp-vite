import type { MiniProgramNetworkDefaults } from '@wevu/web-apis'
import type { InlineConfig } from 'vite'
import type { PageLayoutMeta, WevuDefaults } from 'wevu'
import type { ImportMetaDefineRegistry } from '../../utils/importMeta'
import type {
  AlipayNpmMode,
  BuildNpmPackageMeta,
  MpPlatform,
  NpmBuildOptions,
  NpmDependencyPattern,
  NpmMainPackageConfig,
  NpmPluginPackageConfig,
  NpmStrategy,
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
  defineImportMetaEnv?: Record<string, any>
  importMetaDefineRegistry?: ImportMetaDefineRegistry
  importMetaRelativePath?: string
  importMetaExtension?: string
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
  /**
   * @description 多平台模式下允许参与构建/开发的目标平台集合
   */
  targets?: 'all' | readonly MpPlatform[]
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

export type WeappInjectWebRuntimeGlobalsTarget
  = | 'fetch'
    | 'Headers'
    | 'Request'
    | 'Response'
    | 'TextEncoder'
    | 'TextDecoder'
    | 'AbortController'
    | 'AbortSignal'
    | 'XMLHttpRequest'
    | 'WebSocket'
    | 'atob'
    | 'btoa'
    | 'queueMicrotask'
    | 'performance'
    | 'crypto'
    | 'Event'
    | 'CustomEvent'

export type WeappInjectRequestGlobalsTarget = WeappInjectWebRuntimeGlobalsTarget

/**
 * @description Web Runtime 全局对象注入配置
 */
export interface WeappInjectWebRuntimeGlobalsConfig {
  enabled?: boolean
  targets?: WeappInjectWebRuntimeGlobalsTarget[]
  dependencies?: (string | RegExp)[]
  prelude?: boolean
  /**
   * @description Web Runtime 网络兼容层的宿主默认参数。
   * @description 会透传给 `fetch` / `XMLHttpRequest` / `WebSocket` 对应的小程序底层能力。
   * @description 显式调用时传入的 `miniProgram` / `miniprogram` 参数优先级更高。
   */
  networkDefaults?: MiniProgramNetworkDefaults
}

/**
 * @description 已废弃，请迁移到 `WeappInjectWebRuntimeGlobalsConfig`
 */
export interface WeappInjectRequestGlobalsConfig extends WeappInjectWebRuntimeGlobalsConfig {}

/**
 * @description `app.prelude` 中的 Web Runtime 安装配置
 */
export interface WeappWebRuntimeConfig extends Omit<WeappInjectWebRuntimeGlobalsConfig, 'prelude'> {}

/**
 * @description 已废弃，请迁移到 `WeappWebRuntimeConfig`
 */
export interface WeappRequestRuntimeConfig extends WeappWebRuntimeConfig {}

export type WeappAppPreludeMode = 'inline' | 'entry' | 'require'

/**
 * @description `app.prelude` 前置注入配置
 */
export interface WeappAppPreludeConfig {
  enabled?: boolean
  mode?: WeappAppPreludeMode
  webRuntime?: boolean | WeappWebRuntimeConfig
  /**
   * @deprecated 已废弃，请迁移到 `weapp.appPrelude.webRuntime`。
   */
  requestRuntime?: boolean | WeappRequestRuntimeConfig
}

/**
 * @description 本地 npm 构建配置
 */
export interface WeappNpmConfig {
  enable?: boolean
  cache?: boolean
  strategy?: NpmStrategy
  include?: NpmDependencyPattern[]
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
  htmlTagToWxml?: boolean | Record<string, string>
  htmlTagToWxmlTagClass?: boolean
  scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
  scopedSlotsRequireProps?: boolean
  slotSingleRootNoWrapper?: boolean
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
