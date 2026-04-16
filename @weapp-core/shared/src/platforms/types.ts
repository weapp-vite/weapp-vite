export type MpPlatform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'

export type MiniProgramTemplatePreset = 'wechat' | 'alipay' | 'tt' | 'swan'

export type MiniProgramPlatformFamily = 'wechat' | 'alipay' | 'tt' | 'swan'

export interface OutputExtensions {
  js: string
  json: string
  wxml: string
  wxss: string
  wxs?: string
}

export interface MiniProgramPageIdentityRule {
  /**
   * @description 注册 layout bridge 等页面级能力时使用的 key 前缀。
   */
  prefix: string
  /**
   * @description 页面 key 的来源类型：字段或 route。
   */
  source: 'field' | 'route'
  /**
   * @description 当来源类型为字段时使用的字段名。
   */
  field?: string
}

export interface MiniProgramRuntimeCapabilities {
  /**
   * @description 宿主是否支持全局 `getCurrentPages()` 页面栈读取。
   */
  globalPageStack: boolean
  /**
   * @description 宿主是否支持从全局对象创建 `SelectorQuery`。
   */
  globalCreateSelectorQuery: boolean
  /**
   * @description 全局 `createSelectorQuery()` 是否需要通过 `.in(instance)` 绑定作用域。
   */
  selectorQueryScopeByIn: boolean
  /**
   * @description 宿主是否支持从全局对象创建 `IntersectionObserver`。
   */
  globalCreateIntersectionObserver: boolean
  /**
   * @description 全局 `createIntersectionObserver()` 是否要求将实例作为首个参数传入。
   */
  intersectionObserverScopeByParameter: boolean
  /**
   * @description 宿主是否支持页面分享菜单能力。
   */
  pageShareMenu: boolean
  /**
   * @description 时间线分享是否要求同时展示 `shareAppMessage`。
   */
  shareTimelineRequiresShareAppMessage: boolean
  /**
   * @description 宿主是否支持通过全局 `pageScrollTo` 做页面滚动桥接。
   */
  pageScrollApi: boolean
  /**
   * @description 宿主是否支持通过全局 `startPullDownRefresh` 做下拉刷新桥接。
   */
  pullDownRefreshApi: boolean
  /**
   * @description 宿主是否支持通过全局对象调用 `navigateTo` / `redirectTo` 等路由 API。
   */
  globalRouterApi: boolean
  /**
   * @description 宿主是否支持 App 级 `onError/offError` 监听。
   */
  appErrorListener: boolean
  /**
   * @description 宿主是否支持 App 级 `onPageNotFound/offPageNotFound` 监听。
   */
  appPageNotFoundListener: boolean
  /**
   * @description 宿主是否支持 App 级 `onUnhandledRejection/offUnhandledRejection` 监听。
   */
  appUnhandledRejectionListener: boolean
  /**
   * @description 宿主是否支持 App 级 `onThemeChange/offThemeChange` 监听。
   */
  appThemeChangeListener: boolean
  /**
   * @description 宿主是否支持 App 级 `onMemoryWarning/offMemoryWarning` 监听。
   */
  appMemoryWarningListener: boolean
}

export type MiniProgramRuntimeCapabilityName = keyof MiniProgramRuntimeCapabilities

export interface MiniProgramPlatformDescriptor {
  /**
   * @description 构建流程中使用的标准平台标识。
   */
  id: MpPlatform
  /**
   * @description 用于日志/诊断/工具展示的可读名称。
   */
  displayName: string
  /**
   * @description 平台所属语义族群，用于模板与 runtime 默认策略复用。
   */
  family: MiniProgramPlatformFamily
  /**
   * @description 需要映射到该平台的别名列表。
   */
  aliases: readonly string[]
  /**
   * @description 编译产物应输出的文件扩展名。
   */
  outputExtensions: OutputExtensions
  /**
   * @description IDE 项目配置文件名。
   */
  projectConfigFileName: string
  /**
   * @description 项目根目录候选字段，按优先级排序。
   */
  projectConfigRootKeys: readonly string[]
  /**
   * @description 不同脚本模块扩展名对应的模板标签名。
   */
  scriptModuleTagByExtension?: Readonly<Partial<Record<string, string>>>
  /**
   * @description 是否使用项目根目录作为 npm 产物目录基准。
   */
  usesProjectRootNpmDir?: boolean
  /**
   * @description IDE 打开项目时的平台级默认行为。
   */
  ide?: {
    requiresOpenPlatformArg?: boolean
    defaultProjectRoot?: string
  }
  /**
   * @description 构建清理时需要保留的 npm 产物目录名。
   */
  resolvePreservedNpmDirNames: (options?: {
    alipayNpmMode?: string
  }) => readonly string[]
  /**
   * @description JSON 归一化相关的平台能力。
   */
  json?: {
    normalizeUsingComponents?: boolean
    fillComponentGenericsDefault?: boolean
    rewriteBundleNpmImports?: boolean
  }
  /**
   * @description npm 构建相关的平台能力。
   */
  npm?: {
    distDirName?: (options?: {
      alipayNpmMode?: string
    }) => string
    normalizeImportPath?: boolean
    normalizeMiniprogramPackage?: boolean
    copyEsModuleDirectory?: boolean
    hoistNestedDependencies?: boolean
    shouldRebuildCachedPackage?: boolean
  }
  /**
   * @description WXML / 模板转换相关的平台能力。
   */
  wxml?: {
    eventBindingStyle?: 'default' | 'alipay'
    directivePrefix?: string
    normalizeComponentTagName?: boolean
    normalizeVueTemplate?: boolean
    emitGenericPlaceholder?: boolean
  }
  /**
   * @description 模板编译器使用的策略预设。
   */
  compiler?: {
    templatePreset?: MiniProgramTemplatePreset
  }
  /**
   * @description TypeScript 支持相关的平台能力。
   */
  typescript?: {
    appTypesPackage?: string
  }
  /**
   * @description 小程序宿主 runtime 相关的静态能力描述。
   */
  runtime: {
    globalObjectKey: string
    hostConfigKey: string
    /**
     * @description 通用全局对象解析优先级，值越小越先尝试。
     */
    globalResolvePriority?: number
    /**
     * @description 路由全局对象解析优先级，值越小越先尝试。
     */
    routeGlobalResolvePriority?: number
    pageIdentityRules: readonly MiniProgramPageIdentityRule[]
    capabilities: MiniProgramRuntimeCapabilities
  }
}
