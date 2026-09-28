/** 保留原生工具新增字段，已声明字段仍提供类型检查与补全。 */
interface NativeOptions {
  [key: string]: unknown
}

/** 内联配置的公共入口；平台字段由 `MultiPlatformProjectConfigs` 按平台提供。 */
export interface MultiPlatformProjectConfig extends NativeOptions {
  appid?: string
  appId?: string
  /** 代码输出目录由构建器管理，请使用 `build.outDir`。 */
  miniprogramRoot?: never
  srcMiniprogramRoot?: never
  smartProgramRoot?: never
}

interface PackRule<ExtraType extends string = never> extends NativeOptions {
  type?: 'file' | 'folder' | 'suffix' | 'prefix' | 'regexp' | ExtraType | (string & {})
  value?: string
}

interface PackOptions<ExtraType extends string = never> extends NativeOptions {
  ignore?: PackRule<ExtraType>[]
  include?: PackRule<ExtraType>[]
}

/**
 * 微信开发者工具配置；不替代 Vite 的构建设置。
 * @see https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html
 */
interface WeappProjectConfig extends MultiPlatformProjectConfig {
  projectname?: string
  description?: string
  compileType?: 'miniprogram' | 'plugin' | (string & {})
  libVersion?: 'latest' | 'trial' | 'widelyUsed' | (string & {})
  packOptions?: PackOptions
  setting?: NativeOptions & {
    es6?: boolean
    enhance?: boolean
    postcss?: boolean
    minified?: boolean
    minifyWXSS?: boolean
    minifyWXML?: boolean
    urlCheck?: boolean
    compileHotReLoad?: boolean
    ignoreUploadUnusedFiles?: boolean
    packNpmManually?: boolean
    uploadWithSourceMap?: boolean
    useCompilerPlugins?: string[] | false
    babelSetting?: NativeOptions & {
      ignore?: string[]
      outputPath?: string
    }
  }
}

/**
 * 支付宝 format 2 项目配置；编译选项属于 `compileOptions`，而非微信的 `setting`。
 * @see https://opendocs.alipay.com/mini/03dbc3
 */
interface AlipayProjectConfig extends MultiPlatformProjectConfig {
  format?: number
  compileType?: 'mini' | 'plugin' | (string & {})
  uploadExclude?: string[]
  assetsInclude?: string[]
  compileOptions?: NativeOptions & {
    component2?: boolean
    typescript?: boolean
    less?: boolean
    treeShaking?: boolean
    resolveAlias?: Record<string, string>
    globalObjectMode?: 'legacy' | 'enable' | 'fake' | (string & {})
    transpile?: NativeOptions & {
      script?: NativeOptions & {
        ignore?: string[]
      }
    }
  }
  developOptions?: NativeOptions & {
    hotReload?: boolean
    parallel?: boolean
    sourcemap?: boolean
    minify?: boolean
    skipTranspile?: boolean
    lazyCompile?: boolean
  }
  scripts?: NativeOptions & {
    watch?: string
    beforeCompile?: string
    beforePreview?: string
    beforeUpload?: string
  }
}

/**
 * 抖音开发者工具配置，保留平台自己的字段名称和类型。
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/framework/general-configuration
 */
interface TtProjectConfig extends MultiPlatformProjectConfig {
  projectname?: string
  disablePrivate?: boolean
  packOptions?: PackOptions<'glob'>
  setting?: NativeOptions & {
    es6?: boolean
    urlCheck?: boolean
    autoCompile?: boolean
    mockUpdate?: boolean
    scripts?: boolean
    mockLogin?: boolean
    compileHotReLoad?: boolean
    nativeCompile?: boolean
    IDEPreviewHotRestartCache?: boolean
    bigPackageSizeSupport?: boolean
    webDetect?: boolean
    useCompilerPlugins?: string[]
  }
}

/**
 * 小红书公开 SDK 默认配置中的稳定字段；未列出的原生字段仍可透传。
 * @see https://unpkg.com/xhs-mp-project@2.1.6/dist/index.js
 */
interface XhsProjectConfig extends MultiPlatformProjectConfig {
  projectname?: string
  description?: string
  compileType?: 'miniprogram' | (string & {})
  libVersion?: 'latest' | (string & {})
  setting?: NativeOptions & {
    minified?: boolean
    urlCheck?: boolean
  }
}

/**
 * 百度智能小程序配置；编译参数属于 `compilation-args.common`。
 * @see https://unpkg.com/swan-toolkit@3.23.1-beta.1/sdk/program/sdk-impl/compile-impl.js
 */
interface SwanProjectConfig extends MultiPlatformProjectConfig {
  'compileType'?: string
  'developType'?: string
  'setting'?: NativeOptions & {
    urlCheck?: boolean
  }
  'compilation-args'?: NativeOptions & {
    common?: NativeOptions & {
      ignoreTransJs?: boolean
      ignorePrefixCss?: boolean
    }
  }
}

/** 六端内联配置映射；按平台补全原生字段，同时允许原生扩展字段。 */
export interface MultiPlatformProjectConfigs {
  /** 微信：生成 `project.config.json`。 */
  weapp?: WeappProjectConfig
  /** 支付宝：生成 `mini.project.json`。 */
  alipay?: AlipayProjectConfig
  /** 抖音：生成 `project.config.json`。 */
  tt?: TtProjectConfig
  /** 小红书：生成 `project.config.json`。 */
  xhs?: XhsProjectConfig
  /** 京东：生成 `project.config.json`；未建立原生设置 schema 的字段保持透传。 */
  jd?: MultiPlatformProjectConfig
  /** 百度：生成 `project.swan.json`。 */
  swan?: SwanProjectConfig
}
