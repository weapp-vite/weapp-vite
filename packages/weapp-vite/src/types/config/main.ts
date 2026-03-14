import type { UserConfig as ViteUserConfig } from 'vite'
import type { WrapPluginOptions } from 'vite-plugin-performance'
import type { PluginOptions as TsconfigPathsOptions } from 'vite-tsconfig-paths'
import type {
  AutoImportComponentsOption,
  EnhanceOptions,
  MultiPlatformConfig,
  WeappAutoRoutesConfig,
  WeappHmrConfig,
  WeappInjectWeapiConfig,
  WeappMcpConfig,
  WeappNpmConfig,
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
  WeappWebConfig,
} from './foundation'
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
  inspect?: WrapPluginOptions
}

/**
 * @description weapp-vite 主配置
 */
export interface WeappViteConfig {
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
  injectWeapi?: boolean | WeappInjectWeapiConfig
  mcp?: boolean | WeappMcpConfig
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
