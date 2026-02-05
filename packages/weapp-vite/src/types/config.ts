import type { GenerateType } from '@weapp-core/schematics'
import type { WeappWebPluginOptions } from '@weapp-vite/web'
import type { InputOption } from 'rolldown'
import type { Options as RolldownDtsOptions } from 'rolldown-plugin-dts'
import type { CompilerOptions } from 'typescript'
import type { InlineConfig, UserConfig as ViteUserConfig } from 'vite'
import type { WrapPluginOptions } from 'vite-plugin-performance'
import type { PluginOptions as TsconfigPathsOptions } from 'vite-tsconfig-paths'
import type { WevuDefaults } from 'wevu'
import type { Resolver } from '@/auto-import-components/resolvers'
import type { LoggerConfig } from '@/logger'

export type {
  Resolver,
}

export type NpmBuildOptions = InlineConfig

export interface Alias {
  find: string | RegExp
  replacement: string
}

export interface ResolvedAlias {
  find: string | RegExp
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
   * 这样你就可以在 json 里面使用:
   * ```json
   * {
   *   "usingComponents": {
   *     "navigation-bar": "@/navigation-bar/navigation-bar",
   *     "ice-avatar": "@/avatar/avatar"
   *   }
   * }
   * ```
   * 详见[json别名](/guide/alias.html#json-别名)文档
   */
  entries?: readonly Alias[] | { [find: string]: string }
}
// 参考：https://nervjs.github.io/taro-docs/docs/GETTING-STARTED#%E7%BC%96%E8%AF%91%E8%BF%90%E8%A1%8C
export type MpPlatform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' // | 'qq' | 'kwai' | 'lark' | 'h5'

export interface SubPackage {
  pages: string[]
  root: string
  // 独立分包
  independent?: boolean
  // 入口文件，也要基于 root
  entry?: string
  name?: string
  // 扩展配置，用于决定独立分包，哪些依赖应该构建 npm，哪些应该直接内联代码
  // 默认值取自 pkgJson.dependencies
  // 可通过手动设置这个来进行更改
  dependencies?: (string | RegExp)[]

  inlineConfig?: Partial<InlineConfig>
}

export type SubPackageStyleScope = 'all' | 'pages' | 'components'

export interface SubPackageStyleConfigObject {
  /** 样式文件路径，可以是相对分包 root、相对 `srcRoot` 或绝对路径 */
  source: string
  /**
   * 作用范围快捷配置：
   *
   * - `all`: 默认值，分包内所有页面与组件都会引入
   * - `pages`: 仅匹配分包 `pages/**`
   * - `components`: 仅匹配分包 `components/**`
   *
   * 可结合 `include` / `exclude` 进一步细分范围
   */
  scope?: SubPackageStyleScope
  /** 自定义包含路径，支持传入单个 glob 或数组，默认覆盖分包内所有文件 */
  include?: string | string[]
  /** 自定义排除路径，支持传入单个 glob 或数组 */
  exclude?: string | string[]
}

export type SubPackageStyleConfigEntry = string | SubPackageStyleConfigObject

export interface SubPackageStyleEntry {
  /**
   * 源配置字符串（便于诊断）
   */
  source: string
  /**
   * 原始样式文件的绝对路径
   */
  absolutePath: string
  /**
   * 相对于 `srcRoot` 的输出路径（已转换为目标平台样式后缀）
   */
  outputRelativePath: string
  /**
   * 源文件扩展名（包含 `.`）
   */
  inputExtension: string
  /**
   * 作用域快捷字段，便于诊断输出
   */
  scope: SubPackageStyleScope
  /**
   * 允许生效的 glob 列表（基于分包 root 的相对路径）
   */
  include: string[]
  /**
   * 排除的 glob 列表（基于分包 root 的相对路径）
   */
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
  /**
   * 生成文件的扩展名
   */
  extensions?: GenerateExtensionsOptions
  /**
   * 默认生成文件的相对路径
   */
  dirs?: GenerateDirsOptions
  /**
   * 默认生成文件的名称
   */
  filenames?: GenerateFilenamesOptions
  /**
   * 自定义模板
   */
  templates?: GenerateTemplatesConfig
}

export interface CopyOptions {
  include?: CopyGlobs
  exclude?: CopyGlobs
  // 类型守卫谓词：(value: T, index: number, array: T[]) => value is S
  filter?: (filePath: string, index: number, array: string[]) => boolean
}

export type CopyGlobs = string[] // | ((subPackageMeta?: SubPackageMetaValue | undefined) => string[])

export interface WeappWebConfig {
  /**
   * @description 是否启用浏览器端运行时集成
   * @default false
   * @example
   * enable: true
   */
  enable?: boolean
  /**
   * @description Web 侧项目根目录（即 index.html 所在目录）
   * @default 项目根目录
   * @example
   * root: 'web'
   */
  root?: string
  /**
   * @description 小程序源码目录（相对于 `root`），默认与 `weapp.srcRoot` 保持一致
   * @example
   * srcDir: 'src'
   */
  srcDir?: string
  /**
   * @description Web 构建产物输出目录；相对路径基于 `root`
   * @default "dist/web"
   * @example
   * outDir: 'dist/web'
   */
  outDir?: string
  /**
   * @description 传递给 `weappWebPlugin` 的额外参数（不包含 `srcDir`）
   * @example
   * pluginOptions: { runtime: 'wevu' }
   */
  pluginOptions?: Partial<Omit<WeappWebPluginOptions, 'srcDir'>>
  /**
   * @description 额外合并到 Web 构建中的 Vite 内联配置
   * @example
   * vite: { server: { host: true } }
   */
  vite?: InlineConfig
}

export interface WeappLibEntryContext {
  name: string
  input: string
}

export type WeappLibFileName = string | ((context: WeappLibEntryContext) => string)

export type WeappLibComponentJson = boolean | 'auto' | ((context: WeappLibEntryContext) => Record<string, any>)

export interface WeappLibVueTscOptions {
  /**
   * @description 额外合并到 vue-tsc 的 tsconfig（浅合并）
   */
  tsconfig?: Record<string, any>
  /**
   * @description 传递给 vue-tsc 的 compilerOptions
   */
  compilerOptions?: CompilerOptions
  /**
   * @description 传递给 vue-tsc 的 vueCompilerOptions
   */
  vueCompilerOptions?: Record<string, any>
}

export interface WeappLibDtsOptions {
  /**
   * @description 是否启用 lib 产物的 dts
   * @default true
   */
  enabled?: boolean
  /**
   * @description 透传给 rolldown-plugin-dts 的配置（内置字段会被覆盖）
   */
  rolldown?: RolldownDtsOptions
  /**
   * @description 透传给 vue-tsc 的配置（会合并到临时 tsconfig）
   */
  vueTsc?: WeappLibVueTscOptions
}

export interface WeappLibConfig {
  /**
   * @description 入口配置，支持 string/array/record 形式
   * @example
   * entry: 'components/button/index.ts'
   * @example
   * entry: ['components/button/index.ts', 'utils/index.ts']
   * @example
   * entry: { button: 'components/button/index.ts' }
   */
  entry: string | string[] | Record<string, string>
  /**
   * @description 库源码根目录，默认沿用 `weapp.srcRoot`
   */
  root?: string
  /**
   * @description 输出目录，默认沿用 `build.outDir`
   */
  outDir?: string
  /**
   * @description 是否保持输出路径与源码路径一致
   * @default true
   */
  preservePath?: boolean
  /**
   * @description 自定义 JS 产物路径（不含扩展名）
   */
  fileName?: WeappLibFileName
  /**
   * @description 自动生成组件 JSON 配置
   * @default 'auto'
   */
  componentJson?: WeappLibComponentJson
  /**
   * @description 是否生成 lib 产物的 dts
   * @default true
   * @example
   * dts: false
   * @example
   * dts: { enabled: false }
   * @example
   * dts: { rolldown: { tsconfigRaw: { compilerOptions: { declarationMap: true } } } }
   * @example
   * dts: { vueTsc: { compilerOptions: { declarationMap: true } } }
   */
  dts?: boolean | WeappLibDtsOptions
}

export interface AutoImportComponents {

  /**
   * 自动导入组件
   */
  globs?: string[]
  /**
   * 自动导入组件解析器
   */
  resolvers?: Resolver[]
  /**
   * 自动导入组件清单输出路径，默认输出到 `vite.config.ts` 同级目录的 `auto-import-components.json`
   * - `true` 或未指定: 按默认路径输出
   * - 传入字符串: 指定输出路径 (支持绝对/相对路径)
   * - `false`: 不生成清单文件
   */
  output?: string | boolean
  /**
   * 生成 WXML 组件 props 类型声明文件。
   * - `true`: 输出到 `vite.config.ts` 同级目录的 `typed-components.d.ts`
   * - 传入字符串: 自定义输出路径 (支持绝对/相对路径)
   * - `false` 或未配置: 不生成类型文件
   */
  typedComponents?: boolean | string
  /**
   * 生成 VS Code HTML customData 用于模板补全。
   * - `true`: 输出到 `vite.config.ts` 同级目录的 `mini-program.html-data.json`
   * - 传入字符串: 自定义输出路径 (支持绝对/相对路径)
   * - `false` 或未配置: 不生成 customData
   */
  htmlCustomData?: boolean | string
  /**
   * 生成 Vue SFC 模板补全用的组件类型声明文件（`components.d.ts`）。
   * - `true`: 输出到 `vite.config.ts` 同级目录的 `components.d.ts`
   * - 传入字符串: 自定义输出路径 (支持绝对/相对路径)
   * - `false` 或未配置: 不生成类型文件
   */
  vueComponents?: boolean | string
  /**
   * 生成 `components.d.ts` 时使用的运行时模块名（`declare module 'xxx'`）。
   * - 默认 `'vue'`
   * - 使用 wevu 并设置 `vueCompilerOptions.lib = "wevu"` 时请改为 `'wevu'`
   */
  vueComponentsModule?: string
}

export type AutoImportComponentsOption = AutoImportComponents | false

export type EnhanceWxmlOptions = ScanWxmlOptions & HandleWxmlOptions

export interface ScanWxmlOptions {
  excludeComponent?: (tagName: string) => boolean
  platform?: MpPlatform
}

export interface HandleWxmlOptions {
  removeComment?: boolean
  transformEvent?: boolean
  scriptModuleExtension?: string
  scriptModuleTag?: string
  templateExtension?: string
}

export interface EnhanceOptions {
  /**
   * 增强：wxml
   */
  wxml?: boolean | (Partial<Omit<EnhanceWxmlOptions, 'platform'>>)
  /**
   * 增强：wxs
   */
  wxs?: boolean
  /**
   * 自动导入小程序组件
   */
  autoImportComponents?: AutoImportComponentsOption
}

export interface BuildNpmPackageMeta {
  name: string
  entry: InputOption
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
  /**
   * @description 产物 JSON 默认值（用于 app/page/component）
   */
  defaults?: {
    app?: Record<string, any>
    page?: Record<string, any>
    component?: Record<string, any>
  }
  /**
   * @description JSON 合并策略
   * - `deep`: 深合并（默认）
   * - `assign`: 浅合并（Object.assign）
   * - `replace`: 直接替换
   * - `function`: 自定义合并函数
   */
  mergeStrategy?: JsonMergeStrategy
}

export interface ChunksConfig {
  /**
   * @description 控制跨分包共享代码的输出策略
   * - `duplicate`: 默认策略，将共享代码复制到各自的分包中
   * - `hoist`: 将共享代码提炼到主包中
   * @default 'duplicate'
   */
  sharedStrategy?: SharedChunkStrategy

  /**
   * @description 控制共享模块的输出形态
   * - `common`: 默认策略，复用模块会被抽到 common.js
   * - `path`: 共享模块按源码相对路径输出（无 common.js）
   * - `inline`: 禁用共享 chunk，复用模块将内联到引用方
   * @default 'common'
   */
  sharedMode?: SharedChunkMode

  /**
   * @description 针对特定模块/目录覆盖共享输出策略，支持 glob 或正则表达式。
   * 匹配基于 srcRoot 的相对路径或绝对路径。
   */
  sharedOverrides?: SharedChunkOverride[]

  /**
   * @description 当 sharedMode 为 `path` 时，用于计算输出路径的根目录（相对 cwd）。
   * @default srcRoot
   */
  sharedPathRoot?: string

  /**
   * @description 动态 import 的处理方式
   * - `preserve`: 保持独立 chunk
   * - `inline`: 尝试内联动态 import
   * @default 'preserve'
   */
  dynamicImports?: SharedChunkDynamicImports

  /**
   * @description 是否输出分包优化日志，帮助确认共享模块被复制或回退的位置
   * @default true
   */
  logOptimization?: boolean

  /**
   * @description 强制按分包复制的模块匹配规则。当共享模块的直接导入方命中这些规则时，
   * 其「主包」身份会被忽略，继续沿用 duplicate 策略。支持字符串或正则表达式，默认基于 srcRoot 的相对路径匹配。
   */
  forceDuplicatePatterns?: (string | RegExp)[]

  /**
   * @description 当共享模块复制后的冗余体积（字节）超过该阈值时输出警告。设置为 0 或 undefined 则禁用。
   * @default 524288 (约 512 KB)
   */
  duplicateWarningBytes?: number
}

export interface MultiPlatformConfig {
  /**
   * @description 是否启用多平台 project.config 解析
   * @default true
   * @example
   * enabled: true
   */
  enabled?: boolean
  /**
   * @description 平台 project.config 目录根（实际读取 `${root}/${platform}/<platformConfigFile>`）
   * @default 'config'
   * @example
   * projectConfigRoot: 'config'
   */
  projectConfigRoot?: string
}

export interface WeappViteConfig {
  /**
   * @description 应用入口目录 (app.json 所在的目录)
   * 默认 js 模板在根目录 `.`，ts 模板在 `miniprogram` 目录，当然你可以把所有代码放在 `src` 目录下，并设置此选项为 `src`
   * @default '.'
   * @example
   * srcRoot: 'src'
   */
  srcRoot?: string

  /**
   * @description 是否启用自动路由模块 (`weapp-vite/auto-routes`)
   * 默认关闭，需要显式启用后才会扫描 `pages/` 目录并生成路由清单。
   * @default false
   * @example
   * autoRoutes: true
   */
  autoRoutes?: boolean

  /**
   * @description 插件入口目录 (plugin.json 所在的目录)
   * @default undefined
   * @example
   * pluginRoot: 'plugin'
   */
  pluginRoot?: string
  /**
   * @description 日志输出配置（全局 + 按 tag 细分）
   * @example
   * logger: { level: 'info', tags: { build: true } }
   */
  logger?: LoggerConfig
  /**
   * @group json 配置
   * 文件引入别名
   * @example
   * jsonAlias: {
   *   '@': '/src',
   * }
   */
  jsonAlias?: AliasOptions
  /**
   *
   * @group 构建 npm
   */
  npm?: {
    /**
     * @description 是否开启构建 npm 功能, 默认为 true
     * @default true
     * @example
     * enable: true
     */
    enable?: boolean
    /**
     * @description 是否开启缓存，默认为 true
     * @default true
     * @example
     * cache: true
     */
    cache?: boolean
    /**
     * @description 构建 npm 的配置，可传入 Vite 的库模式配置，让不同的包走不同的配置
     * @example
     * buildOptions: (options, pkg) => {
     *   if (pkg.name === 'my-lib') return { ...options, minify: false }
     * }
     */
    buildOptions?: (options: NpmBuildOptions, pkgMeta: BuildNpmPackageMeta) => NpmBuildOptions | undefined
  }
  /**
   * @group 生成脚手架配置
   * 生成器（weapp-vite generate）相关配置
   * @example
   * generate: { dirs: { page: 'src/pages' } }
   */
  generate?: GenerateOptions
  /**
   * @group 插件集成
   * 传递给内置 [`vite-tsconfig-paths`](https://www.npmjs.com/package/vite-tsconfig-paths) 插件的参数
   * - 传入 `false` 可显式禁用该插件（当项目没有 `paths/baseUrl` 时建议关闭以提速）
   * @example
   * tsconfigPaths: { projects: ['tsconfig.json'] }
   */
  tsconfigPaths?: TsconfigPathsOptions | false
  /**
   * @group 分包配置
   * 分包是否独立的 rollup 编译上下文
   * 默认情况下，当一个分包设置了 independent: true 之后会默认启用
   * 可以设置 key: 为 root, value: {independent:true} 来强制启用 独立的 rollup 编译上下文
   */
  subPackages?: Record<string, Pick<SubPackage, 'independent' | 'dependencies' | 'inlineConfig'> & {
    autoImportComponents?: AutoImportComponentsOption
    /** 分包文件变更时是否强制重新生成共享样式产物，默认启用 */
    watchSharedStyles?: boolean
    /**
     * 分包共享样式入口，支持传入一个或多个 `wxss`/`css` 文件路径
     * - 相对路径默认基于当前分包的 `root`
     * - 也可以传入绝对路径或相对 `srcRoot` 的路径
     * - 支持传入对象配置 `scope`/`include`/`exclude` 精准控制注入范围
     * @example
     * styles: [
     *   'styles/shared.wxss',
     *   { path: 'styles/sub.wxss', scope: 'page' },
     * ]
     */
    styles?: SubPackageStyleConfigEntry | SubPackageStyleConfigEntry[]
  }>

  /**
   * 需要被额外包括的资源
   * 默认情况下包括大部分的图片资源格式
   * @example
   * copy: ['static/**\\/*']
   */
  copy?: CopyOptions

  /**
   * @group Web 运行时
   * 浏览器端运行时相关配置
   * @example
   * web: { enabled: true, srcDir: 'src', outDir: 'dist/web' }
   */
  web?: WeappWebConfig

  /**
   * @group 库模式
   * 用于构建组件库或小程序模块的 lib 模式配置
   */
  lib?: WeappLibConfig

  /**
   * @description 额外的 wxml 文件
   * 把这个方法，扫描到的 `wxml` 添加到额外的 `wxml` 文件列表, **处理** 之后输出到最终的产物中
   * @param wxmlFilePath
   * @returns boolean
   * @example
   * isAdditionalWxml: (file) => file.includes('custom')
   */
  isAdditionalWxml?: (wxmlFilePath: string) => boolean

  /**
   * @description 编译目标平台
   * @ignore
   */
  platform?: MpPlatform

  /**
   * @description 多平台 project.config 支持
   * - `true` 等价于 `{ enabled: true, projectConfigRoot: 'config' }`
   * - 启用后必须通过 CLI `--platform` 指定目标小程序平台
   * @example
   * multiPlatform: true
   * @example
   * multiPlatform: { enabled: true, projectConfigRoot: 'config' }
   */
  multiPlatform?: boolean | MultiPlatformConfig

  /**
   * @description 生成的 JS 模块格式
   * - `cjs`: 输出 CommonJS
   * - `esm`: 输出 ESM，需要在微信开发者工具中启用「ES6 转 ES5」
   * @default 'cjs'
   * @example
   * jsFormat: 'cjs'
   */
  jsFormat?: JsFormat
  /**
   * @description 是否启用基于 `@swc/core` 的 ES5 降级（仅支持 `jsFormat: 'cjs'`）
   * @default false
   * @example
   * es5: true
   */
  es5?: boolean

  wxml?: EnhanceOptions['wxml']
  /**
   * 增强：wxs
   */
  wxs?: EnhanceOptions['wxs']
  /**
   * 自动导入小程序组件
   */
  autoImportComponents?: AutoImportComponentsOption

  /**
   * @deprecated 请改用顶层的 `wxml`、`wxs` 与 `autoImportComponents`
   * 增强配置
   */
  enhance?: EnhanceOptions

  debug?: {
    watchFiles?: (watchFiles: string[], subPackageMeta?: SubPackageMetaValue) => void
    resolveId?: (id: string, subPackageMeta?: SubPackageMetaValue) => void
    load?: (id: string, subPackageMeta?: SubPackageMetaValue) => void
    inspect?: WrapPluginOptions
  }
  /**
   * @description 开发服务器相关配置
   */
  hmr?: {
    /**
     * @description HMR 期间共享 chunk 的处理策略
     * - `full`: 每次更新都重新产出全部 entry（最稳定，速度较慢）
     * - `auto`: 仅在共享 chunk 可能被部分覆盖时回退到 full（稳定与速度折中）
     * - `off`: 仅更新变更 entry（最快，但可能导致共享 chunk 导出不一致）
     * @default 'auto'
     */
    sharedChunks?: 'full' | 'auto' | 'off'
    /**
     * @description Dev 构建结束后触碰 app.wxss 以触发微信开发者工具热重载
     * - `true`: 总是启用
     * - `false`: 关闭
     * - `auto`: 检测到安装 weapp-tailwindcss 时启用
     * @default 'auto'
     */
    touchAppWxss?: boolean | 'auto'
  }
  /**
   * @description 构建 worker 配置
   */
  worker?: {
    /**
     * @description 构建 worker 的入口
     */
    entry?: string | string[]
  }
  /**
   * @description Vue 单文件组件支持配置
   */
  vue?: {
    /**
     * @description 是否启用 Vue 支持
     * @default true
     */
    enable?: boolean
    /**
     * @description 模板编译选项
     */
    template?: {
      /**
       * @description 是否移除注释
       * @default true
       */
      removeComments?: boolean
      /**
       * @description 是否简化空白符
       * @default true
       */
      simplifyWhitespace?: boolean
      /**
       * @description 作用域插槽编译策略
       * - `auto`: 自动选择最小可用的 scoped slot 方案
       * - `augmented`: 强制使用增强方案
       * - `off`: 关闭 scoped slot 编译（仅保留原生 slot，不支持 slot props）
       * @default 'auto'
       */
      scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
      /**
       * @description 是否仅在 slot 传递作用域参数时生成 scoped slot 组件
       * - `true`: 仅对带作用域参数的 v-slot 生成 scoped slot 组件
       * - `false`: 所有 v-slot 都生成 scoped slot 组件（旧行为）
       * @default true
       */
      scopedSlotsRequireProps?: boolean
      /**
       * @description v-for 下 scoped slot 多实例模式
       * @default true
       */
      slotMultipleInstance?: boolean
      /**
       * @description class/style 绑定运行时
       * - `auto`: 优先 WXS，平台不支持时回退 JS
       * - `wxs`: 强制使用 WXS（不可用时回退 JS 并告警）
       * - `js`: 强制使用 JS（用于无 WXS 平台或调试）
       * @default 'auto'
       */
      classStyleRuntime?: 'auto' | 'wxs' | 'js'
      /**
       * @description 是否复用 class/style WXS 运行时（主包与非独立分包共享，独立分包各自生成）
       * @default true
       */
      classStyleWxsShared?: boolean
    }
    /**
     * @description 是否自动导入 Vue 组件
     */
    autoImport?: boolean
  }
  /**
   * @description wevu 运行时默认值（编译期注入）
   */
  wevu?: {
    /**
     * @description wevu createApp/defineComponent 默认值
     */
    defaults?: WevuDefaults
  }
  /**
   * @description 共享代码拆分策略配置
   */
  chunks?: ChunksConfig
  /**
   * @description JSON 产物合并配置
   */
  json?: JsonConfig
}

export type UserConfig = ViteUserConfig & { weapp?: WeappViteConfig }

export interface ProjectConfig {
  miniprogramRoot?: string
  srcMiniprogramRoot?: string
  smartProgramRoot?: string
  setting?: {
    // 参考：https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html#%E4%B8%80%E7%BA%A7%E5%AD%97%E6%AE%B5
    packNpmManually?: boolean
    // 参考：https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html
    packNpmRelationList?: {
      packageJsonPath: string
      miniprogramNpmDistDir: string
    }[]
  }
}

export interface SubPackageMetaValue {
  entries: string[]
  subPackage: SubPackage
  autoImportComponents?: AutoImportComponentsOption
  styleEntries?: SubPackageStyleEntry[]
  watchSharedStyles?: boolean
}
