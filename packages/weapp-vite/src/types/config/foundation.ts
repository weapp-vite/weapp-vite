import type { GenerateType } from '@weapp-core/schematics'
import type { WeappWebPluginOptions } from '@weapp-vite/web/plugin'
import type { InputOption } from 'rolldown'
import type { Options as RolldownDtsOptions } from 'rolldown-plugin-dts'
import type { CompilerOptions } from 'typescript'
import type { InlineConfig } from 'vite'

export type NpmBuildOptions = InlineConfig

/**
 * @description 支付宝平台本地 npm 输出模式
 */
export type AlipayNpmMode = 'miniprogram_npm' | 'node_modules'

export interface Alias {
  /**
   * @description 被匹配的原始路径或正则
   */
  find: string | RegExp
  /**
   * @description 命中后的替换路径
   */
  replacement: string
}

export interface ResolvedAlias {
  /**
   * @description 解析后的匹配条件
   */
  find: string | RegExp
  /**
   * @description 解析后的替换路径
   */
  replacement: string
}

export interface AliasOptions {
  /**
   * @example
   * ```ts
   * entries: [
   *   {
   *     find: '@',
   *     replacement: path.resolve(import.meta.dirname, 'components'),
   *   },
   * ]
   * ```
   */
  entries?: readonly Alias[] | { [find: string]: string }
}

// 参考：https://nervjs.github.io/taro-docs/docs/GETTING-STARTED#%E7%BC%96%E8%AF%91%E8%BF%90%E8%A1%8C
export type MpPlatform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'

export interface SubPackage {
  /**
   * @description 分包内页面列表，路径相对于分包 root
   */
  pages: string[]
  /**
   * @description 分包根目录
   */
  root: string
  /**
   * @description 是否为独立分包
   */
  independent?: boolean
  /**
   * @description 分包入口文件，也基于 root 解析
   */
  entry?: string
  /**
   * @description 分包名称
   */
  name?: string
  /**
   * @description 分包依赖范围控制
   */
  dependencies?: (string | RegExp)[]
  /**
   * @description 分包级额外 inline Vite 配置
   */
  inlineConfig?: Partial<InlineConfig>
}

export type SubPackageStyleScope = 'all' | 'pages' | 'components'

export interface SubPackageStyleConfigObject {
  /** 样式文件路径，可以是相对分包 root、相对 `srcRoot` 或绝对路径 */
  source: string
  /**
   * @description 作用范围快捷配置
   */
  scope?: SubPackageStyleScope
  /** 自定义包含路径，支持传入单个 glob 或数组，默认覆盖分包内所有文件 */
  include?: string | string[]
  /** 自定义排除路径，支持传入单个 glob 或数组 */
  exclude?: string | string[]
}

export type SubPackageStyleConfigEntry = string | SubPackageStyleConfigObject

export interface SubPackageStyleEntry {
  source: string
  absolutePath: string
  outputRelativePath: string
  inputExtension: string
  scope: SubPackageStyleScope
  include: string[]
  exclude: string[]
}

export type GenerateExtensionsOptions = Partial<{
  js: 'js' | 'ts' | (string & {})
  json: 'js' | 'ts' | 'json' | (string & {})
  wxml: 'wxml' | (string & {})
  wxss: 'wxss' | 'scss' | 'less' | 'css' | (string & {})
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

export type GenerateFileType = 'js' | 'json' | 'wxml' | 'wxss'

export interface GenerateTemplateContext {
  type: GenerateType
  fileType: GenerateFileType
  fileName: string
  outDir: string
  extension: string
  cwd: string
  defaultCode?: string
}

export interface GenerateTemplateFileSource {
  path: string
}

export interface GenerateTemplateInlineSource {
  content: string
}

export type GenerateTemplateFactory = (context: GenerateTemplateContext) => string | Promise<string> | undefined

export type GenerateTemplate = string | GenerateTemplateFileSource | GenerateTemplateInlineSource | GenerateTemplateFactory

export type GenerateTemplateEntry = Partial<Record<GenerateFileType, GenerateTemplate>>

export type GenerateTemplateScope = GenerateType | 'shared'

export type GenerateTemplatesConfig = Partial<Record<GenerateTemplateScope, GenerateTemplateEntry>>

export interface GenerateOptions {
  extensions?: GenerateExtensionsOptions
  dirs?: GenerateDirsOptions
  filenames?: GenerateFilenamesOptions
  templates?: GenerateTemplatesConfig
}

export interface CopyOptions {
  include?: CopyGlobs
  exclude?: CopyGlobs
  filter?: (filePath: string, index: number, array: string[]) => boolean
}

/**
 * @description 资源复制使用的 glob 列表
 */
export type CopyGlobs = string[]

export interface WeappWebConfig {
  enable?: boolean
  root?: string
  srcDir?: string
  outDir?: string
  pluginOptions?: Partial<Omit<WeappWebPluginOptions, 'srcDir'>>
  vite?: InlineConfig
}

export interface WeappLibEntryContext {
  name: string
  input: string
}

export type WeappLibFileName = string | ((context: WeappLibEntryContext) => string)

export type WeappLibComponentJson = boolean | 'auto' | ((context: WeappLibEntryContext) => Record<string, any>)

export interface WeappLibInternalDtsOptions {
  tsconfig?: string | false
  compilerOptions?: CompilerOptions
  vueCompilerOptions?: Record<string, any>
}

export interface WeappLibVueTscOptions {
  tsconfig?: Record<string, any>
  compilerOptions?: CompilerOptions
  vueCompilerOptions?: Record<string, any>
}

export interface WeappLibDtsOptions {
  enabled?: boolean
  mode?: 'internal' | 'vue-tsc'
  internal?: WeappLibInternalDtsOptions
  rolldown?: RolldownDtsOptions
  vueTsc?: WeappLibVueTscOptions
}

export interface WeappLibConfig {
  entry: string | string[] | Record<string, string>
  root?: string
  outDir?: string
  preservePath?: boolean
  fileName?: WeappLibFileName
  componentJson?: WeappLibComponentJson
  dts?: boolean | WeappLibDtsOptions
}

export interface BuildNpmPackageMeta {
  name: string
  entry: InputOption
}

export interface NpmSubPackageConfig {
  dependencies?: (string | RegExp)[]
}

export interface NpmMainPackageConfig {
  dependencies?: false | (string | RegExp)[]
}

export type JsFormat = 'cjs' | 'esm'

export type SharedChunkStrategy = 'hoist' | 'duplicate'

export type SharedChunkMode = 'common' | 'path' | 'inline'

export type SharedChunkDynamicImports = 'preserve' | 'inline'

export interface SharedChunkOverride {
  test: string | RegExp
  mode: SharedChunkMode
}

export type JsonMergeStage
  = | 'defaults'
    | 'json-block'
    | 'auto-using-components'
    | 'component-generics'
    | 'macro'
    | 'emit'
    | 'merge-existing'

export interface JsonMergeContext {
  filename?: string
  kind?: 'app' | 'page' | 'component' | 'unknown'
  stage: JsonMergeStage
}

export type JsonMergeFunction = (
  target: Record<string, any>,
  source: Record<string, any>,
  context: JsonMergeContext,
) => Record<string, any> | void

export type JsonMergeStrategy = 'deep' | 'assign' | 'replace' | JsonMergeFunction

export interface JsonConfig {
  defaults?: {
    app?: Record<string, any>
    page?: Record<string, any>
    component?: Record<string, any>
  }
  mergeStrategy?: JsonMergeStrategy
}

export interface ChunksConfig {
  sharedStrategy?: SharedChunkStrategy
  sharedMode?: SharedChunkMode
  sharedOverrides?: SharedChunkOverride[]
  sharedPathRoot?: string
  dynamicImports?: SharedChunkDynamicImports
  logOptimization?: boolean
  forceDuplicatePatterns?: (string | RegExp)[]
  duplicateWarningBytes?: number
}
