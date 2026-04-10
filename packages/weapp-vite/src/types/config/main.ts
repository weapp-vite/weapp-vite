import type { UserConfig as ViteUserConfig } from 'vite'
import type { WrapPluginOptions } from 'vite-plugin-performance'
import type { PluginOptions as TsconfigPathsOptions } from 'vite-tsconfig-paths'
import type {
  AutoImportComponentsOption,
  EnhanceOptions,
  MultiPlatformConfig,
  WeappAppPreludeConfig,
  WeappAutoRoutesConfig,
  WeappHmrConfig,
  WeappInjectRequestGlobalsConfig,
  WeappInjectWeapiConfig,
  WeappMcpConfig,
  WeappNpmConfig,
  WeappRouteRules,
  WeappSubPackageConfig,
  WeappVueConfig,
  WeappWevuConfig,
  WeappWorkerConfig,
} from './features'
import type {
  AliasOptions,
  ChunksConfig,
  CopyOptions,
  GenerateOptions,
  JsFormat,
  JsonConfig,
  MpPlatform,
  SubPackage,
  SubPackageStyleEntry,
  WeappLibConfig,
  WeappManagedTypeScriptConfig,
  WeappWebConfig,
} from './foundation'
import type { WeappAstConfig } from '@/ast'
import type { LoggerConfig } from '@/logger'

/**
 * @description 分包元信息
 */
export interface SubPackageMetaValue {
  entries: string[]
  subPackage: SubPackage
  autoImportComponents?: AutoImportComponentsOption
  styleEntries?: SubPackageStyleEntry[]
  watchSharedStyles?: boolean
}

/**
 * @description 调试输出配置
 */
export interface WeappDebugConfig {
  watchFiles?: (watchFiles: string[], subPackageMeta?: SubPackageMetaValue) => void
  resolveId?: (id: string, subPackageMeta?: SubPackageMetaValue) => void
  load?: (id: string, subPackageMeta?: SubPackageMetaValue) => void
  vueTransformTiming?: (timing: {
    id: string
    isPage: boolean
    totalMs: number
    stages: Record<string, number>
  }) => void
  inspect?: WrapPluginOptions
}

export type WeappForwardConsoleLogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error'

/**
 * @description 微信开发者工具日志转发配置。
 */
export interface WeappForwardConsoleConfig {
  /**
   * 是否启用日志转发。
   * - `true`: 始终开启
   * - `false`: 始终关闭
   * - `'auto'`: 仅在检测到 AI 终端时开启
   */
  enabled?: boolean | 'auto'
  /**
   * 允许转发的日志级别。
   */
  logLevels?: WeappForwardConsoleLogLevel[]
  /**
   * 是否同时转发未捕获异常。
   */
  unhandledErrors?: boolean
}

/**
 * @description weapp-vite 主配置
 */
export interface WeappViteConfig {
  /**
   * 开发态是否在启动构建前清空输出目录。
   * 开发态默认 `true`，设置为 `false` 可跳过每次 dev 启动前的全量输出目录清理。
   * 生产构建始终会清空输出目录。
   */
  cleanOutputsInDev?: boolean
  /**
   * 应用入口目录（`app.json` 所在目录）。
   */
  srcRoot?: string
  /**
   * 自动路由模块配置。
   * - `undefined` / `false`: 默认关闭
   * - `true`: 启用默认自动路由配置
   * - `object`: 启用自动路由并允许细粒度控制
   */
  autoRoutes?: boolean | WeappAutoRoutesConfig
  /**
   * 插件入口目录（`plugin.json` 所在目录）。
   */
  pluginRoot?: string
  /**
   * 日志输出配置。
   */
  logger?: LoggerConfig
  /**
   * AST 引擎配置。
   */
  ast?: WeappAstConfig
  /**
   * 主包/分包体积告警阈值（字节）。
   */
  packageSizeWarningBytes?: number
  jsonAlias?: AliasOptions
  npm?: WeappNpmConfig
  generate?: GenerateOptions
  tsconfigPaths?: TsconfigPathsOptions | false
  subPackages?: Record<string, WeappSubPackageConfig>
  copy?: CopyOptions
  web?: WeappWebConfig
  typescript?: WeappManagedTypeScriptConfig
  lib?: WeappLibConfig
  isAdditionalWxml?: (wxmlFilePath: string) => boolean
  platform?: MpPlatform
  multiPlatform?: boolean | MultiPlatformConfig
  jsFormat?: JsFormat
  /**
   * @deprecated 已废弃，不建议继续使用。请改为保持 `build.target >= es2020`，并在开发者工具中开启“将 JS 编译成 ES5”功能。
   * 该选项依赖 `@swc/core` 做额外 ES5 降级，后续版本将移除。
   */
  es5?: boolean
  wxml?: EnhanceOptions['wxml']
  wxs?: EnhanceOptions['wxs']
  autoImportComponents?: AutoImportComponentsOption
  enhance?: EnhanceOptions
  debug?: WeappDebugConfig
  hmr?: WeappHmrConfig
  worker?: WeappWorkerConfig
  vue?: WeappVueConfig
  wevu?: WeappWevuConfig
  routeRules?: WeappRouteRules
  appPrelude?: boolean | WeappAppPreludeConfig
  injectWeapi?: boolean | WeappInjectWeapiConfig
  injectRequestGlobals?: boolean | WeappInjectRequestGlobalsConfig
  mcp?: boolean | WeappMcpConfig
  forwardConsole?: boolean | WeappForwardConsoleConfig
  chunks?: ChunksConfig
  json?: JsonConfig
}

export type UserConfig = ViteUserConfig & { weapp?: WeappViteConfig }

/**
 * @description 小程序 project.config 结构
 */
export interface ProjectConfig {
  miniprogramRoot?: string
  srcMiniprogramRoot?: string
  smartProgramRoot?: string
  setting?: {
    packNpmManually?: boolean
    packNpmRelationList?: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[]
  }
}
