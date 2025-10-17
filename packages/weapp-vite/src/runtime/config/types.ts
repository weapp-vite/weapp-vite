import type { WeappWebPluginOptions } from '@weapp-vite/web'
import type { DetectResult } from 'package-manager-detector'
import type { PackageJson } from 'pkg-types'
import type { InlineConfig } from 'vite'
import type { OutputExtensions } from '../../platforms/types'
import type { MpPlatform, ResolvedAlias, SubPackageMetaValue, WeappWebConfig } from '../../types'

export interface LoadConfigOptions {
  cwd: string
  isDev: boolean
  mode: string
  inlineConfig?: InlineConfig
  configFile?: string
}

export interface LoadConfigResult {
  config: InlineConfig
  aliasEntries: ResolvedAlias[]
  outputExtensions: OutputExtensions
  packageJson: PackageJson
  relativeSrcRoot: (p: string) => string
  cwd: string
  isDev: boolean
  mode: string
  projectConfig: Record<string, any>
  mpDistRoot: string
  packageJsonPath: string
  platform: MpPlatform
  srcRoot: string
  configFilePath?: string
  currentSubPackageRoot?: string
  weappWeb?: ResolvedWeappWebConfig
}

export interface PackageInfo {
  name: string
  version: string | undefined
  rootPath: string
  packageJsonPath: string
  packageJson: PackageJson
}

export interface ConfigService {
  options: LoadConfigResult
  outputExtensions: OutputExtensions
  defineEnv: Record<string, any>
  packageManager: DetectResult
  packageInfo: PackageInfo
  setDefineEnv: (key: string, value: any) => void
  load: (options?: Partial<LoadConfigOptions>) => Promise<LoadConfigResult>
  mergeWorkers: (...configs: Partial<InlineConfig>[]) => InlineConfig
  merge: (subPackageMeta?: SubPackageMetaValue, ...configs: Partial<InlineConfig | undefined>[]) => InlineConfig
  mergeWeb: (...configs: Partial<InlineConfig | undefined>[]) => InlineConfig | undefined
  readonly defineImportMetaEnv: Record<string, any>
  readonly cwd: string
  readonly isDev: boolean
  readonly mpDistRoot: string
  readonly outDir: string
  readonly inlineConfig: InlineConfig
  readonly weappViteConfig: NonNullable<InlineConfig['weapp']>
  readonly packageJson: PackageJson
  readonly projectConfig: Record<string, any>
  readonly srcRoot: string
  readonly pluginRoot: string | undefined
  readonly absolutePluginRoot: string | undefined
  readonly absoluteSrcRoot: string
  readonly mode: string
  readonly aliasEntries: ResolvedAlias[]
  readonly platform: MpPlatform
  readonly configFilePath?: string
  readonly weappWebConfig?: ResolvedWeappWebConfig
  relativeCwd: (p: string) => string
  relativeSrcRoot: (p: string) => string
  relativeAbsoluteSrcRoot: (p: string) => string
  readonly currentSubPackageRoot?: string
}

export interface ResolvedWeappWebConfig {
  enabled: boolean
  root: string
  srcDir: string
  outDir: string
  pluginOptions: Omit<WeappWebPluginOptions, 'srcDir'> & { srcDir: string }
  userConfig?: InlineConfig
  source?: WeappWebConfig
}
