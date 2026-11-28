import type { WebRuntimeDerivedGlobalTarget, WebRuntimeGlobalTarget } from '@weapp-core/constants'
import type { MiniProgramNetworkDefaults } from '@wevu/web-apis/network-defaults'
import type { InlineConfig } from 'vite'
import type { PageLayoutMeta, WevuConfigDefaults } from 'wevu/config'
import type { ImportMetaDefineRegistry } from '../../utils/importMeta'
import type {
  AlipayNpmMode,
  BuildNpmPackageMeta,
  MpPlatform,
  NpmBuildOptions,
  NpmDependencyPattern,
  NpmMainPackageConfig,
  NpmPackageFilesConfig,
  NpmPluginPackageConfig,
  NpmStrategy,
  NpmSubPackageConfig,
  StyleConfigEntry,
} from './foundation'
import type { MultiPlatformProjectConfigs } from './projectConfig'
import type { WxmlTransform } from './wxmlTransform'
import type { WxmlValidate } from './wxmlValidate'
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

/**
 * @description 实验性的 uni-app 源码兼容配置。
 */
export interface WeappUniAppConfig {
  /**
   * @description 允许参与兼容转换的 npm 包名。项目源码始终参与转换。
   */
  include: string[]
}

/** 最终模板中的标签限定属性删除规则，名称区分大小写并支持 `*`。 */
export interface WxmlRemoveAttrRule {
  tag: string | string[]
  name: string | string[]
}

/** 最终模板的可选清理；对象形式只执行显式配置，不叠加预设。 */
export interface WxmlRemoveOptions {
  attr?: Array<string | WxmlRemoveAttrRule>
  tag?: string[]
  comment?: boolean
}

export type EnhanceWxmlOptions = ScanWxmlOptions & Omit<HandleWxmlOptions, 'removeComment'> & {
  /** @deprecated 仅保留类型兼容，未接入编译流程；请使用 `weapp.wxml.remove.comment`。 */
  removeComment?: boolean
  /** `true` 删除四种测试属性及普通注释；环境由用户配置控制。 */
  remove?: boolean | WxmlRemoveOptions
  /** 在最终模板清理前按顺序执行同步或异步转换。 */
  transform?: WxmlTransform | WxmlTransform[]
  /** 在输出插件处理后、HMR 比较及发布前检查最终模板。 */
  validate?: WxmlValidate | WxmlValidate[]
}

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
  platform?: MpPlatform
  defineImportMetaEnv?: Record<string, any>
  importMetaDefineRegistry?: ImportMetaDefineRegistry
  importMetaRelativePath?: string
  importMetaExtension?: string
  removeComment?: boolean
  transformEvent?: boolean
  transformPlatformSyntax?: boolean
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
   * @description 各平台的原生项目配置；不可与 `projectConfigRoot` 同时设置。
   */
  projectConfigs?: MultiPlatformProjectConfigs
  /**
   * @description 多平台模式下允许参与构建/开发的目标平台集合；省略时从 `projectConfigs` 的平台键推断。
   */
  targets?: 'all' | readonly MpPlatform[]
}

/**
 * @description MCP 服务配置
 */
export interface WeappMcpConfig {
  enabled?: boolean
  autoStart?: boolean | 'ai'
  host?: string
  port?: number | 'auto'
  endpoint?: string
  /**
   * @description streamable-http 模式下的 DevTools runtime REST 入口；设为 false 可关闭。
   */
  restEndpoint?: string | false
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
  /** 页面入口扩展名（可带前导点）；未设置或为空时沿用默认解析。 */
  extensions?: string[]
  /**
   * @description 是否启用自动路由持久化缓存，或指定自定义缓存文件路径
   * @default false
   */
  persistentCache?: boolean | string
  watch?: boolean
}

/**
 * @description 局部构建范围配置。
 */
export interface WeappBuildScopeObjectConfig {
  /**
   * @description 是否包含主包页面。
   */
  includeMainPackage?: boolean
  /**
   * @description 参与构建的分包 root 列表。`main` 表示主包。
   */
  include?: string[]
  /**
   * @internal
   * @description CLI 注入来源标记。
   */
  __weappViteBuildScopeSource?: boolean
}

export type WeappBuildScopeConfig = string | string[] | WeappBuildScopeObjectConfig

/**
 * @description 由目标依赖展开自动安装的实现目标；native 可在 `globalTargets` 中显式声明。
 */
export type WeappInjectWebRuntimeDerivedGlobalTarget = WebRuntimeDerivedGlobalTarget

/** @description `globalTargets` 接受的公开目标集合：基础目标与依赖展开目标。 */
export type WeappInjectWebRuntimeDeclaredGlobalTarget = WeappInjectWebRuntimeGlobalsTarget | WeappInjectWebRuntimeDerivedGlobalTarget

/**
 * @description `@wevu/api` 注入配置
 */
export interface WeappInjectWeapiConfig {
  enabled?: boolean
  replaceWx?: boolean
  globalName?: string
}

export type WeappInjectWebRuntimeGlobalsTarget = WebRuntimeGlobalTarget

export type WeappInjectRequestGlobalsTarget = WeappInjectWebRuntimeGlobalsTarget

/**
 * @description Web Runtime 全局对象注入配置
 */
export interface WeappInjectWebRuntimeGlobalsConfig {
  enabled?: boolean
  targets?: WeappInjectWebRuntimeGlobalsTarget[]
  dependencies?: (string | RegExp)[]
  /**
   * @description 是否强制在业务入口前安装 Web Runtime。
   * @description `native` 的自动匹配与 `appPrelude.webRuntime` 默认 false，按实际引用延迟安装；显式启用默认 false，旧模式的自动匹配与嵌套配置保持原有默认时机。
   */
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
 * @description `appPrelude.mode: 'native'` 中的 Web Runtime 注入配置。
 * @description 行为固定为精确最优解，无策略开关：自由标识符与全局对象点号访问由 Rolldown `transform.inject` 精确绑定（按需导入、可 tree-shake）；
 *              字符串计算属性、全局解构、别名与 `globalTargets` 声明的目标生成宿主优先的幂等桥接；分包交给打包器自然分组。
 *              不全量安装未用实现；用户通过 `targets` 选择作用域、`globalTargets` 精确补充隐藏访问。
 */
export interface WeappNativeWebRuntimeConfig extends Omit<WeappInjectWebRuntimeGlobalsConfig, 'dependencies' | 'prelude'> {
  /** @description native 不使用依赖包名匹配。 */
  dependencies?: never
  /**
   * @description 需要额外安装到全局对象的 Web Runtime 目标；用于源码里静态推断不到的隐藏计算访问。
   * @description 精确补充：只安装声明的目标，不会全量安装未用实现。
   */
  globalTargets?: WeappInjectWebRuntimeDeclaredGlobalTarget[]
}

/**
 * @description 已废弃，请迁移到 `WeappWebRuntimeConfig`
 */
export interface WeappRequestRuntimeConfig extends WeappWebRuntimeConfig {}

/**
 * @description 已废弃，请迁移到 `WeappNativeWebRuntimeConfig`
 */
export interface WeappNativeRequestRuntimeConfig extends WeappNativeWebRuntimeConfig {}

/**
 * @description App Prelude 注入模式。
 * @description `native` 使用 Rolldown 原生注入建立 Web Runtime 精确绑定，并按不可点号注入的显式全局语义加载最小全局桥接。
 */
export type WeappAppPreludeMode = 'inline' | 'entry' | 'require' | 'native'

interface WeappAppPreludeBaseConfig {
  enabled?: boolean
}

/**
 * @description 旧 App Prelude 模式配置；嵌套 Web Runtime 始终提前安装。
 */
export interface WeappLegacyAppPreludeConfig extends WeappAppPreludeBaseConfig {
  mode?: Exclude<WeappAppPreludeMode, 'native'>
  webRuntime?: boolean | WeappWebRuntimeConfig
  /**
   * @deprecated 已废弃，请迁移到 `weapp.appPrelude.webRuntime`。
   */
  requestRuntime?: boolean | WeappRequestRuntimeConfig
}

/**
 * @description `app.prelude.mode: 'native'` 配置；Web Runtime 使用精确绑定与按需全局桥接，无 installer 启动时机。
 */
export interface WeappNativeAppPreludeConfig extends WeappAppPreludeBaseConfig {
  mode: 'native'
  webRuntime?: boolean | WeappNativeWebRuntimeConfig
  /**
   * @deprecated 已废弃，请迁移到 `weapp.appPrelude.webRuntime`。
   */
  requestRuntime?: boolean | WeappNativeRequestRuntimeConfig
}

/**
 * @description `app.prelude` 前置注入配置
 */
export type WeappAppPreludeConfig = WeappLegacyAppPreludeConfig | WeappNativeAppPreludeConfig

/**
 * @description 本地 npm 构建配置
 */
export interface WeappNpmConfig {
  enable?: boolean
  cache?: boolean
  /** 基于最终产物引用闭包裁剪原生小程序 npm 包内未使用文件 */
  pruneUnusedFiles?: boolean
  strategy?: NpmStrategy
  include?: NpmDependencyPattern[]
  mainPackage?: NpmMainPackageConfig
  pluginPackage?: NpmPluginPackageConfig
  subPackages?: Record<string, NpmSubPackageConfig>
  /** 按包名限制原生小程序 npm 包复制到产物中的文件 */
  packageFiles?: Record<string, NpmPackageFilesConfig>
  buildOptions?: (options: NpmBuildOptions, pkgMeta: BuildNpmPackageMeta) => NpmBuildOptions | false | undefined
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
  styles?: StyleConfigEntry | StyleConfigEntry[]
}

/**
 * @description HMR 配置
 */
export interface WeappHmrConfig {
  /**
   * @description 微信开发者工具热更新运行时。stateful-experimental 使用实验性的状态保持协议。
   */
  runtime?: 'auto' | 'classic' | 'stateful-experimental'
  sharedChunks?: 'full' | 'auto' | 'off'
  /**
   * @description 额外刷新已存在的全局样式；auto 仅用于非内置 Tailwind 的实际内容失效，内置集成由原生输出刷新。false 不影响样式编译。
   */
  touchAppWxss?: boolean | 'auto'
  /**
   * @description HMR 终端日志档位：默认仅输出总耗时，显式开启 concise/verbose 后再展示阶段诊断。
   */
  logLevel?: 'default' | 'concise' | 'verbose'
  /**
   * @description 是否输出 HMR 结构化 profile，或指定自定义 JSONL 输出路径
   */
  profileJson?: boolean | string
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
  /** @deprecated 仅保留类型兼容，未接入编译流程；请使用 `weapp.wxml.remove.comment`。 */
  removeComments?: boolean
  simplifyWhitespace?: boolean
  formatWxml?: boolean | 'auto'
  htmlTagToWxml?: boolean | Record<string, string>
  htmlTagToWxmlTagClass?: boolean
  scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
  scopedSlotsRequireProps?: boolean
  /** 是否启用微信原生插槽的 provide/inject 上下文协议，默认关闭；需同时开启 scopedSlotsRequireProps。 */
  nativeSlotContext?: boolean
  slotSingleRootNoWrapper?: boolean
  slotFallbackWrapperStrategy?: 'view' | 'virtual-host'
  slotFallbackWrapper?: string | {
    tag?: string
    attrs?: Record<string, string>
    singleRootNoWrapper?: boolean
    rules?: Array<{
      component?: string | RegExp | Array<string | RegExp>
      componentName?: string | RegExp | Array<string | RegExp>
      slot?: string | RegExp | Array<string | RegExp>
      tag?: string
      attrs?: Record<string, string>
      singleRootNoWrapper?: boolean
    }>
  }
  slotMultipleInstance?: boolean
  classStyleRuntime?: 'auto' | 'wxs' | 'js'
  objectLiteralBindMode?: 'runtime' | 'inline'
  mustacheInterpolation?: 'compact' | 'spaced'
  /**
   * @description Vue `<Teleport>` 映射为小程序 `root-portal` 的配置；`unsupported` 默认 `warn`。
   */
  teleport?: {
    /** @description 是否启用映射，默认 `true`；关闭后剥掉 Teleport 标签并原位渲染子节点。 */
    enabled?: boolean
    /** @description 不可映射时的诊断级别，默认 `warn`。 */
    unsupported?: 'warn' | 'error'
  }
  classStyleWxsShared?: boolean
  functionPropNames?: Array<string | RegExp>
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
  /** 可选原生 DOM renderer，默认 legacy；auto 仅在 TT V2 能力命中时启用。 */
  renderer?: 'legacy' | 'auto' | 'native-dom'
  /**
   * @description 是否启用 setup 首帧渲染屏障，默认 `true`。
   * @description 关闭后按静态初值直接渲染首帧，依赖 setup 的组件属性可能提前收到空值。
   */
  setupInitialRenderBarrier?: boolean
  preset?: 'performance'
  defaults?: WevuConfigDefaults
  autoSetDataPick?: boolean
  /**
   * @description 是否压缩 wevu 相关脚本输出。
   * @description 默认保持当前可读输出行为，开启后仅影响 wevu 编译生成的脚本代码。
   */
  minify?: boolean
  /**
   * @description wevu 运行时入口版本。`auto` 表示开发模式使用 `dist/dev`，构建模式使用 `dist`。
   */
  runtime?: 'auto' | 'dev' | 'build'
}

export interface WeappReactCompilerConfig {
  compilationMode?: 'infer' | 'syntax' | 'annotation' | 'all'
  engine?: 'swc'
}

export interface WeappReactConfig {
  compiler?: boolean | WeappReactCompilerConfig
  renderMode?: 'auto' | 'dynamic' | 'static'
  renderer?: 'legacy' | 'auto' | 'native-dom'
  devWarnings?: boolean
}

export type WeappPreloadNetwork = 'all' | 'wifi'

/**
 * @description 页面进入后的分包预下载规则。
 */
export interface WeappPreloadRule {
  packages: string[]
  network?: WeappPreloadNetwork
}

export interface WeappRouteRule {
  appLayout?: PageLayoutMeta
  preload?: WeappPreloadRule
}

export type WeappRouteRules = Record<string, WeappRouteRule>
