/// <reference types="miniprogram-api-typings" />
/// <reference types="@mini-types/alipay" />
/// <reference types="@douyin-microapp/typings" />
export type WeapiAdapter = Record<string, any>

/**
 * @description 微信小程序 API 原始适配器类型
 */
export type WeapiWxRawAdapter = WechatMiniprogram.Wx

/**
 * @description 支付宝小程序 API 原始适配器类型
 */
export type WeapiAlipayRawAdapter = typeof my

/**
 * @description 抖音小程序 API 原始适配器类型
 */
export type WeapiDouyinRawAdapter = typeof tt

type MergeAdapters<Primary extends WeapiAdapter, Secondary extends WeapiAdapter>
  = Primary & Omit<Secondary, keyof Primary>

/**
 * @description weapi 对齐后的跨平台原始 API 类型
 *
 * @generated weapi-platform-matrix:start
 * | 平台 | 全局对象 | 类型来源 | 对齐状态 |
 * | --- | --- | --- | --- |
 * | 微信小程序 | `wx` | `miniprogram-api-typings` | ✅ 全量 |
 * | 支付宝小程序 | `my` | `@mini-types/alipay` | ✅ 全量 |
 * | 抖音小程序 | `tt` | `@douyin-microapp/typings` | ✅ 全量 |
 * | 其他平台（swan/jd/xhs 等） | 运行时宿主对象 | 运行时透传 | ⚠️ 按宿主能力支持 |
 * @generated weapi-platform-matrix:end
 */
export type WeapiCrossPlatformRawAdapter = MergeAdapters<
  MergeAdapters<WeapiWxRawAdapter, WeapiAlipayRawAdapter>,
  WeapiDouyinRawAdapter
>

type HasCallbackKey<T> = T extends object
  ? 'success' extends keyof T
    ? true
    : 'fail' extends keyof T
      ? true
      : 'complete' extends keyof T
        ? true
        : false
  : false

type HasCallbackOption<T> = T extends { success: unknown }
  ? true
  : T extends { fail: unknown }
    ? true
    : T extends { complete: unknown }
      ? true
      : false

type ExtractSuccessResult<T> = T extends { success?: (...args: infer A) => unknown }
  ? A[0]
  : void

type PromisifyOptionMethod<
  Prefix extends any[],
  Option extends object,
  Result,
  IsOptional extends boolean,
> = IsOptional extends true
  ? {
      <TOption extends Option>(...args: [...Prefix, TOption]): HasCallbackOption<TOption> extends true
        ? Result
        : Promise<ExtractSuccessResult<Option>>
      (...args: Prefix): Promise<ExtractSuccessResult<Option>>
    }
  : {
      <TOption extends Option>(...args: [...Prefix, TOption]): HasCallbackOption<TOption> extends true
        ? Result
        : Promise<ExtractSuccessResult<Option>>
    }

type NormalizePromisifyReturn<T> = T extends Promise<any> ? T : Promise<T>

type PromisifyMethod<TMethod> = TMethod extends (...args: infer Args) => infer Result
  ? Args extends []
    ? (...args: Args) => NormalizePromisifyReturn<Result>
    : Args extends [...infer Prefix, infer Last]
      ? true extends HasCallbackKey<NonNullable<Last>>
        ? PromisifyOptionMethod<Prefix, NonNullable<Last>, Result, undefined extends Last ? true : false>
        : (...args: Args) => NormalizePromisifyReturn<Result>
      : (...args: Args) => NormalizePromisifyReturn<Result>
  : TMethod

export type WeapiPromisify<TAdapter extends WeapiAdapter> = {
  [Key in keyof TAdapter]: Key extends string
    ? Key extends `${string}Sync`
      ? TAdapter[Key]
      : Key extends `on${Capitalize<string>}` | `off${Capitalize<string>}`
        ? TAdapter[Key]
        : PromisifyMethod<TAdapter[Key]>
    : TAdapter[Key]
}

/**
 * @description 微信小程序 API 适配器类型
 */
export type WeapiWxAdapter = WeapiPromisify<WeapiWxRawAdapter>

/**
 * @description 支付宝小程序 API 适配器类型
 */
export type WeapiAlipayAdapter = WeapiPromisify<WeapiAlipayRawAdapter>

/**
 * @description 抖音小程序 API 适配器类型
 */
export type WeapiDouyinAdapter = WeapiPromisify<WeapiDouyinRawAdapter>

/**
 * @description weapi 默认导出的跨平台 API 适配器类型
 */
export type WeapiCrossPlatformAdapter = WeapiPromisify<WeapiCrossPlatformRawAdapter>

/**
 * @description weapi 核心映射 API 的平台支持度说明
 */
interface WeapiCrossPlatformMethodDocs {
  // @generated weapi-method-docs:start
  /**
   * 显示消息提示框。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showToast` | ✅ |
   * | 支付宝 | `title/icon` 映射到 `content/type` 后调用 `my.showToast` | ✅ |
   * | 抖音 | `icon=error` 映射为 `fail` 后调用 `tt.showToast` | ✅ |
   */
  showToast: WeapiCrossPlatformAdapter['showToast']

  /**
   * 显示 loading 提示框。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showLoading` | ✅ |
   * | 支付宝 | `title` 映射到 `content` 后调用 `my.showLoading` | ✅ |
   * | 抖音 | 直连 `tt.showLoading` | ✅ |
   */
  showLoading: WeapiCrossPlatformAdapter['showLoading']

  /**
   * 显示操作菜单。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showActionSheet` | ✅ |
   * | 支付宝 | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐 | ✅ |
   * | 抖音 | 直连 `tt.showActionSheet`，并兼容 `index` → `tapIndex` | ✅ |
   */
  showActionSheet: WeapiCrossPlatformAdapter['showActionSheet']

  /**
   * 显示模态弹窗。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showModal` | ✅ |
   * | 支付宝 | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果 | ✅ |
   * | 抖音 | 直连 `tt.showModal` | ✅ |
   */
  showModal: WeapiCrossPlatformAdapter['showModal']

  /**
   * 选择图片。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseImage` | ✅ |
   * | 支付宝 | 返回值 `apFilePaths` 映射到 `tempFilePaths` | ✅ |
   * | 抖音 | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底 | ✅ |
   */
  chooseImage: WeapiCrossPlatformAdapter['chooseImage']

  /**
   * 保存文件（跨端扩展，微信 typings 未声明同名 API）。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | ⚠️ |
   * | 支付宝 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | ⚠️ |
   * | 抖音 | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath` | ⚠️ |
   */
  saveFile: WeapiCrossPlatformAdapter['saveFile']

  /**
   * 设置剪贴板内容。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setClipboardData` | ✅ |
   * | 支付宝 | 转调 `my.setClipboard` 并映射 `data` → `text` | ✅ |
   * | 抖音 | 直连 `tt.setClipboardData` | ✅ |
   */
  setClipboardData: WeapiCrossPlatformAdapter['setClipboardData']

  /**
   * 获取剪贴板内容。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getClipboardData` | ✅ |
   * | 支付宝 | 转调 `my.getClipboard` 并映射 `text` → `data` | ✅ |
   * | 抖音 | 直连 `tt.getClipboardData` | ✅ |
   */
  getClipboardData: WeapiCrossPlatformAdapter['getClipboardData']

  /**
   * 选择收货地址。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseAddress` | ⚠️ |
   * | 支付宝 | 映射到 `my.getAddress` | ⚠️ |
   * | 抖音 | 直连 `tt.chooseAddress` | ⚠️ |
   */
  chooseAddress: WeapiCrossPlatformAdapter['chooseAddress']

  /**
   * 创建音频上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createAudioContext` | ⚠️ |
   * | 支付宝 | 映射到 `my.createInnerAudioContext` | ⚠️ |
   * | 抖音 | 映射到 `tt.createInnerAudioContext` | ⚠️ |
   */
  createAudioContext: WeapiCrossPlatformAdapter['createAudioContext']

  /**
   * 创建 WebAudio 上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createWebAudioContext` | ⚠️ |
   * | 支付宝 | 映射到 `my.createInnerAudioContext` | ⚠️ |
   * | 抖音 | 映射到 `tt.createInnerAudioContext` | ⚠️ |
   */
  createWebAudioContext: WeapiCrossPlatformAdapter['createWebAudioContext']

  /**
   * 异步获取系统信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getSystemInfoAsync` | ✅ |
   * | 支付宝 | 映射到 `my.getSystemInfo` | ✅ |
   * | 抖音 | 映射到 `tt.getSystemInfo` | ✅ |
   */
  getSystemInfoAsync: WeapiCrossPlatformAdapter['getSystemInfoAsync']

  /**
   * 打开小程序授权设置页。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openAppAuthorizeSetting` | ⚠️ |
   * | 支付宝 | 映射到 `my.openSetting` | ⚠️ |
   * | 抖音 | 映射到 `tt.openSetting` | ⚠️ |
   */
  openAppAuthorizeSetting: WeapiCrossPlatformAdapter['openAppAuthorizeSetting']

  /**
   * 插件登录。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.pluginLogin` | ⚠️ |
   * | 支付宝 | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段 | ⚠️ |
   * | 抖音 | 映射到 `tt.login` | ⚠️ |
   */
  pluginLogin: WeapiCrossPlatformAdapter['pluginLogin']

  /**
   * 请求订阅设备消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestSubscribeDeviceMessage` | ⚠️ |
   * | 支付宝 | 映射到 `my.requestSubscribeMessage` | ⚠️ |
   * | 抖音 | 映射到 `tt.requestSubscribeMessage` | ⚠️ |
   */
  requestSubscribeDeviceMessage: WeapiCrossPlatformAdapter['requestSubscribeDeviceMessage']

  /**
   * 请求订阅员工消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestSubscribeEmployeeMessage` | ⚠️ |
   * | 支付宝 | 映射到 `my.requestSubscribeMessage` | ⚠️ |
   * | 抖音 | 映射到 `tt.requestSubscribeMessage` | ⚠️ |
   */
  requestSubscribeEmployeeMessage: WeapiCrossPlatformAdapter['requestSubscribeEmployeeMessage']

  /**
   * 重启小程序。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.restartMiniProgram` | ⚠️ |
   * | 支付宝 | 映射到 `my.reLaunch` | ⚠️ |
   * | 抖音 | 映射到 `tt.reLaunch` | ⚠️ |
   */
  restartMiniProgram: WeapiCrossPlatformAdapter['restartMiniProgram']

  /**
   * 扫码。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.scanCode` | ✅ |
   * | 支付宝 | 映射到 `my.scan` | ✅ |
   * | 抖音 | 直连 `tt.scanCode` | ✅ |
   */
  scanCode: WeapiCrossPlatformAdapter['scanCode']

  /**
   * 显示分享图片菜单。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showShareImageMenu` | ⚠️ |
   * | 支付宝 | 映射到 `my.showSharePanel` | ⚠️ |
   * | 抖音 | 映射到 `tt.showShareMenu` | ⚠️ |
   */
  showShareImageMenu: WeapiCrossPlatformAdapter['showShareImageMenu']

  /**
   * 更新分享菜单配置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.updateShareMenu` | ⚠️ |
   * | 支付宝 | 映射到 `my.showSharePanel` | ⚠️ |
   * | 抖音 | 映射到 `tt.showShareMenu` | ⚠️ |
   */
  updateShareMenu: WeapiCrossPlatformAdapter['updateShareMenu']

  /**
   * 打开嵌入式小程序。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openEmbeddedMiniProgram` | ⚠️ |
   * | 支付宝 | 映射到 `my.navigateToMiniProgram` | ⚠️ |
   * | 抖音 | 映射到 `tt.navigateToMiniProgram` | ⚠️ |
   */
  openEmbeddedMiniProgram: WeapiCrossPlatformAdapter['openEmbeddedMiniProgram']

  /**
   * 保存文件到磁盘。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.saveFileToDisk` | ⚠️ |
   * | 支付宝 | 直连 `my.saveFileToDisk` | ⚠️ |
   * | 抖音 | 映射到 `tt.saveFile` | ⚠️ |
   */
  saveFileToDisk: WeapiCrossPlatformAdapter['saveFileToDisk']

  /**
   * 获取启动参数（同步）。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getEnterOptionsSync` | ⚠️ |
   * | 支付宝 | 直连 `my.getEnterOptionsSync` | ⚠️ |
   * | 抖音 | 映射到 `tt.getLaunchOptionsSync` | ⚠️ |
   */
  getEnterOptionsSync: WeapiCrossPlatformAdapter['getEnterOptionsSync']

  /**
   * 获取系统设置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getSystemSetting` | ⚠️ |
   * | 支付宝 | 直连 `my.getSystemSetting` | ⚠️ |
   * | 抖音 | 映射到 `tt.getSetting` | ⚠️ |
   */
  getSystemSetting: WeapiCrossPlatformAdapter['getSystemSetting']

  /**
   * 获取用户资料。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getUserProfile` | ⚠️ |
   * | 支付宝 | 映射到 `my.getOpenUserInfo` | ⚠️ |
   * | 抖音 | 直连 `tt.getUserProfile` | ⚠️ |
   */
  getUserProfile: WeapiCrossPlatformAdapter['getUserProfile']

  /**
   * 获取用户信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getUserInfo` | ⚠️ |
   * | 支付宝 | 映射到 `my.getOpenUserInfo` | ⚠️ |
   * | 抖音 | 直连 `tt.getUserInfo` | ⚠️ |
   */
  getUserInfo: WeapiCrossPlatformAdapter['getUserInfo']

  /**
   * 获取 App 授权设置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getAppAuthorizeSetting` | ⚠️ |
   * | 支付宝 | 直连 `my.getAppAuthorizeSetting` | ⚠️ |
   * | 抖音 | 映射到 `tt.getSetting` | ⚠️ |
   */
  getAppAuthorizeSetting: WeapiCrossPlatformAdapter['getAppAuthorizeSetting']

  /**
   * 获取 App 基础信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getAppBaseInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getAppBaseInfo` | ⚠️ |
   * | 抖音 | 映射到 `tt.getEnvInfoSync` | ⚠️ |
   */
  getAppBaseInfo: WeapiCrossPlatformAdapter['getAppBaseInfo']
  // @generated weapi-method-docs:end
}

type WeapiMethodDocOverlay<TAdapter extends WeapiAdapter> = TAdapter extends WeapiCrossPlatformRawAdapter
  ? WeapiCrossPlatformMethodDocs
  : object

export interface CreateWeapiOptions<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter> {
  /**
   * @description 手动指定平台适配器（优先级高于自动探测）
   */
  adapter?: TAdapter
  /**
   * @description 手动指定平台名称
   */
  platform?: string
}

export interface WeapiResolvedTarget {
  /**
   * @description 输入的微信命名 API
   */
  method: string
  /**
   * @description 当前平台最终调用的目标 API 名称
   */
  target: string
  /**
   * @description 当前平台标识
   */
  platform?: string
  /**
   * @description 是否发生了命名映射（method !== target）
   */
  mapped: boolean
  /**
   * @description 当前适配器上是否存在可调用的目标方法
   */
  supported: boolean
}

export type WeapiInstance<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter> = WeapiPromisify<TAdapter> & TAdapter & WeapiMethodDocOverlay<TAdapter> & {
  /**
   * @description 当前平台标识
   */
  readonly platform?: string
  /**
   * @description 获取当前适配器实例
   */
  getAdapter: () => TAdapter | undefined
  /**
   * @description 手动替换平台适配器
   */
  setAdapter: (adapter?: TAdapter, platform?: string) => void
  /**
   * @description 获取原始平台对象
   */
  readonly raw?: TAdapter
  /**
   * @description 解析微信命名 API 在当前平台的目标方法信息
   */
  resolveTarget: (method: string) => WeapiResolvedTarget
  /**
   * @description 判断微信命名 API 在当前平台是否可调用
   */
  supports: (method: string) => boolean
}
