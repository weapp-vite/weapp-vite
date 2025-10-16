import type { GenerateType } from '@weapp-core/schematics'
import type { WeappWebPluginOptions } from '@weapp-vite/web'
import type { InputOption } from 'rolldown'
import type { Options as NpmBuildOptions } from 'tsdown'
import type { InlineConfig, UserConfig as ViteUserConfig } from 'vite'
import type { WrapPluginOptions } from 'vite-plugin-performance'
import type { PluginOptions as TsconfigPathsOptions } from 'vite-tsconfig-paths'
import type { Resolver } from '@/auto-import-components/resolvers'
// import type { Entry } from './entry'

export type {
  Resolver,
}

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
   * ```js
  entries: [
    {
      find: '@',
      replacement: path.resolve(import.meta.dirname, 'components'),
    },
  ],
   * ```
      这样你就可以在 json 里面使用:
```json
  {
    "usingComponents": {
      "navigation-bar": "@/navigation-bar/navigation-bar",
      "ice-avatar": "@/avatar/avatar"
    }
  }
```
   * 详见[json别名](/guide/alias.html#json-别名)文档
   */
  entries?: readonly Alias[] | { [find: string]: string }
}
// https://nervjs.github.io/taro-docs/docs/GETTING-STARTED#%E7%BC%96%E8%AF%91%E8%BF%90%E8%A1%8C
export type MpPlatform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' // | 'qq' | 'kwai' | 'lark' | 'h5'

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

  inlineConfig?: Partial<InlineConfig>
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
  // predicate: (value: T, index: number, array: T[]) => value is S
  filter?: (filePath: string, index: number, array: string[]) => boolean
}

export type CopyGlobs = string[] // | ((subPackageMeta?: SubPackageMetaValue | undefined) => string[])

export interface WeappWebConfig {
  /**
   * @description 是否启用浏览器端运行时集成
   * @default false
   */
  enable?: boolean
  /**
   * @description Web 侧项目根目录（即 index.html 所在目录）
   * @default 项目根目录
   */
  root?: string
  /**
   * @description 小程序源码目录（相对于 `root`），默认与 `weapp.srcRoot` 保持一致
   */
  srcDir?: string
  /**
   * @description Web 构建产物输出目录；相对路径基于 `root`
   * @default "dist-web"
   */
  outDir?: string
  /**
   * @description 传递给 `weappWebPlugin` 的额外参数（不包含 `srcDir`）
   */
  pluginOptions?: Partial<Omit<WeappWebPluginOptions, 'srcDir'>>
  /**
   * @description 额外合并到 Web 构建中的 Vite 内联配置
   */
  vite?: InlineConfig
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
}

export type EnhanceWxmlOptions = ScanWxmlOptions & HandleWxmlOptions

export interface ScanWxmlOptions {
  excludeComponent?: (tagName: string) => boolean
  platform?: MpPlatform
}

export interface HandleWxmlOptions {
  removeComment?: boolean
  transformEvent?: boolean
}

export interface EnhanceOptions {
  /**
   * wxml 增强
   */
  wxml?: boolean | (Partial<Omit<EnhanceWxmlOptions, 'platform'>>)
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
  entry: InputOption
}

export type JsFormat = 'cjs' | 'esm'

export interface WeappViteConfig {
  /**
   * @description 应用入口目录 (app.json 所在的目录)
   * 默认 js 模板在根目录 `.`，ts 模板在 `miniprogram` 目录，当然你可以把所有代码放在 `src` 目录下，并设置此选项为 `src`
   * @default '.'
   */
  srcRoot?: string

  /**
   * @description 是否启用自动路由模块 (`weapp-vite/auto-routes`)
   * 默认关闭，需要显式启用后才会扫描 `pages/` 目录并生成路由清单。
   * @default false
   */
  autoRoutes?: boolean

  /**
   * @description 插件入口目录 (plugin.json 所在的目录)
   * @default undefined
   */
  pluginRoot?: string
  /**
   * @group json 配置
   * 文件引入别名
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
     */
    enable?: boolean
    /**
     * @description 是否开启缓存，默认为 true
     * @default true
     */
    cache?: boolean
    /**
     * @description 构建 npm 的配置，可以配置这个选项给 tsdown，让不同的包走不同的配置
     */
    buildOptions?: (options: NpmBuildOptions, pkgMeta: BuildNpmPackageMeta) => NpmBuildOptions | undefined
  }
  /**
   * @group 生成脚手架配置
   * weapp-vite generate 相关的配置
   */
  generate?: GenerateOptions
  /**
   * @group 插件集成
   * 传递给内置 [`vite-tsconfig-paths`](https://www.npmjs.com/package/vite-tsconfig-paths) 插件的参数
   */
  tsconfigPaths?: TsconfigPathsOptions
  /**
   * @group 分包配置
   * 分包是否独立的 rollup 编译上下文
   * 默认情况下，当一个分包设置了 independent: true 之后会默认启用
   * 可以设置 key: 为 root, value: {independent:true} 来强制启用 独立的 rollup 编译上下文
   */
  subPackages?: Record<string, Pick<SubPackage, 'independent' | 'dependencies' | 'inlineConfig'> & {
    autoImportComponents?: AutoImportComponents
  }>

  /**
   * 需要被额外包括的资源
   * 默认情况下包括大部分的图片资源格式
   */
  copy?: CopyOptions

  /**
   * @group Web 运行时
   * 浏览器端运行时相关配置
   */
  web?: WeappWebConfig

  /**
   * @description 额外的 wxml 文件
   * 把这个方法，扫描到的 `wxml` 添加到额外的 `wxml` 文件列表, **处理** 之后输出到最终的产物中
   * @param wxmlFilePath
   * @returns boolean
   */
  isAdditionalWxml?: (wxmlFilePath: string) => boolean

  /**
   * @description 编译目标平台
   * @ignore
   */
  platform?: MpPlatform

  /**
   * @description 生成的 JS 模块格式
   * - `cjs`: 输出 CommonJS
   * - `esm`: 输出 ESM，需要在微信开发者工具中启用「ES6 转 ES5」
   * @default 'cjs'
   */
  jsFormat?: JsFormat
  /**
   * @description 是否启用基于 `@swc/core` 的 ES5 降级（仅支持 `jsFormat: 'cjs'`）
   * @default false
   */
  es5?: boolean

  wxml?: EnhanceOptions['wxml']
  /**
   * wxs 增强
   */
  wxs?: EnhanceOptions['wxs']
  /**
   * 自动导入小程序组件
   */
  autoImportComponents?: AutoImportComponents

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
   * @description 构建 worker 配置
   */
  worker?: {
    /**
     * @description 构建 worker 的入口
     */
    entry?: string | string[]
  }
}

export type UserConfig = ViteUserConfig & { weapp?: WeappViteConfig }

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

export interface SubPackageMetaValue {
  // entriesSet: Set<string>
  // entries: Entry[]
  entries: string[]
  subPackage: SubPackage
}

export {
  NpmBuildOptions,
}
