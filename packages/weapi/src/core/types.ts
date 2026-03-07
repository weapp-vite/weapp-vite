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
   * | 微信 | 直连 `wx.showActionSheet` | ⚠️ |
   * | 支付宝 | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐 | ⚠️ |
   * | 抖音 | 直连 `tt.showActionSheet`；缺失时按 unsupported 报错 | ⚠️ |
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
   * 选择图片或视频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseMedia` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType` | ⚠️ |
   */
  chooseMedia: WeapiCrossPlatformAdapter['chooseMedia']

  /**
   * 选择会话文件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseMessageFile` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  chooseMessageFile: WeapiCrossPlatformAdapter['chooseMessageFile']

  /**
   * 获取模糊地理位置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getFuzzyLocation` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getFuzzyLocation: WeapiCrossPlatformAdapter['getFuzzyLocation']

  /**
   * 预览图片和视频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.previewMedia` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  previewMedia: WeapiCrossPlatformAdapter['previewMedia']

  /**
   * 创建插屏广告实例。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createInterstitialAd` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.createInterstitialAd` | ⚠️ |
   */
  createInterstitialAd: WeapiCrossPlatformAdapter['createInterstitialAd']

  /**
   * 创建激励视频广告实例。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createRewardedVideoAd` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createRewardedVideoAd: WeapiCrossPlatformAdapter['createRewardedVideoAd']

  /**
   * 创建直播播放器上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createLivePlayerContext` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.createLivePlayerContext` | ⚠️ |
   */
  createLivePlayerContext: WeapiCrossPlatformAdapter['createLivePlayerContext']

  /**
   * 创建直播推流上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createLivePusherContext` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createLivePusherContext: WeapiCrossPlatformAdapter['createLivePusherContext']

  /**
   * 获取视频详细信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getVideoInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getVideoInfo` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getVideoInfo: WeapiCrossPlatformAdapter['getVideoInfo']

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
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.chooseAddress` | ⚠️ |
   */
  chooseAddress: WeapiCrossPlatformAdapter['chooseAddress']

  /**
   * 创建音频上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createAudioContext` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createAudioContext: WeapiCrossPlatformAdapter['createAudioContext']

  /**
   * 创建 WebAudio 上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createWebAudioContext` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
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
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  pluginLogin: WeapiCrossPlatformAdapter['pluginLogin']

  /**
   * 登录。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.login` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.login` | ⚠️ |
   */
  login: WeapiCrossPlatformAdapter['login']

  /**
   * 提前向用户发起授权请求。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.authorize` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.authorize` | ⚠️ |
   */
  authorize: WeapiCrossPlatformAdapter['authorize']

  /**
   * 检查登录态是否过期。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkSession` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.checkSession` | ⚠️ |
   */
  checkSession: WeapiCrossPlatformAdapter['checkSession']

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
   * 发起支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestPayment: WeapiCrossPlatformAdapter['requestPayment']

  /**
   * 发起订单支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestOrderPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestOrderPayment: WeapiCrossPlatformAdapter['requestOrderPayment']

  /**
   * 发起插件支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestPluginPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestPluginPayment: WeapiCrossPlatformAdapter['requestPluginPayment']

  /**
   * 发起虚拟支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestVirtualPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestVirtualPayment: WeapiCrossPlatformAdapter['requestVirtualPayment']

  /**
   * 显示分享图片菜单。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showShareImageMenu` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  showShareImageMenu: WeapiCrossPlatformAdapter['showShareImageMenu']

  /**
   * 更新分享菜单配置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.updateShareMenu` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  updateShareMenu: WeapiCrossPlatformAdapter['updateShareMenu']

  /**
   * 打开嵌入式小程序。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openEmbeddedMiniProgram` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openEmbeddedMiniProgram: WeapiCrossPlatformAdapter['openEmbeddedMiniProgram']

  /**
   * 保存文件到磁盘。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.saveFileToDisk` | ⚠️ |
   * | 支付宝 | 直连 `my.saveFileToDisk` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
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
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
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
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
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

  /**
   * 选择视频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseVideo` | ⚠️ |
   * | 支付宝 | 直连 `my.chooseVideo` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  chooseVideo: WeapiCrossPlatformAdapter['chooseVideo']

  /**
   * 隐藏返回首页按钮。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.hideHomeButton` | ✅ |
   * | 支付宝 | 映射到 `my.hideBackHome` | ✅ |
   * | 抖音 | 直连 `tt.hideHomeButton` | ✅ |
   */
  hideHomeButton: WeapiCrossPlatformAdapter['hideHomeButton']

  /**
   * 获取窗口信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getWindowInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getWindowInfo` | ⚠️ |
   * | 抖音 | 映射到 `tt.getSystemInfo`，并提取窗口字段 | ⚠️ |
   */
  getWindowInfo: WeapiCrossPlatformAdapter['getWindowInfo']

  /**
   * 获取设备基础信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getDeviceInfo` | ⚠️ |
   * | 支付宝 | 映射到 `my.getSystemInfo`，并提取设备字段 | ⚠️ |
   * | 抖音 | 映射到 `tt.getSystemInfo`，并提取设备字段 | ⚠️ |
   */
  getDeviceInfo: WeapiCrossPlatformAdapter['getDeviceInfo']

  /**
   * 同步获取当前账号信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getAccountInfoSync` | ⚠️ |
   * | 支付宝 | 直连 `my.getAccountInfoSync` | ⚠️ |
   * | 抖音 | 映射到 `tt.getEnvInfoSync`，并对齐账号字段结构 | ⚠️ |
   */
  getAccountInfoSync: WeapiCrossPlatformAdapter['getAccountInfoSync']

  /**
   * 动态设置窗口背景色。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setBackgroundColor` | ⚠️ |
   * | 支付宝 | 直连 `my.setBackgroundColor` | ⚠️ |
   * | 抖音 | 映射到 `tt.setNavigationBarColor`，对齐 `backgroundColor/frontColor` | ⚠️ |
   */
  setBackgroundColor: WeapiCrossPlatformAdapter['setBackgroundColor']

  /**
   * 动态设置下拉背景字体样式。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setBackgroundTextStyle` | ⚠️ |
   * | 支付宝 | 直连 `my.setBackgroundTextStyle` | ⚠️ |
   * | 抖音 | 映射到 `tt.setNavigationBarColor`，将 `textStyle` 对齐到 `frontColor` | ⚠️ |
   */
  setBackgroundTextStyle: WeapiCrossPlatformAdapter['setBackgroundTextStyle']

  /**
   * 获取网络类型。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getNetworkType` | ⚠️ |
   * | 支付宝 | 直连 `my.getNetworkType` | ⚠️ |
   * | 抖音 | 映射到 `tt.getSystemInfo`，兜底补齐 `networkType` | ⚠️ |
   */
  getNetworkType: WeapiCrossPlatformAdapter['getNetworkType']

  /**
   * 异步获取电量信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getBatteryInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getBatteryInfo` | ⚠️ |
   * | 抖音 | 映射到 `tt.getSystemInfo`，补齐 `level/isCharging` | ⚠️ |
   */
  getBatteryInfo: WeapiCrossPlatformAdapter['getBatteryInfo']

  /**
   * 同步获取电量信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getBatteryInfoSync` | ⚠️ |
   * | 支付宝 | 直连 `my.getBatteryInfoSync` | ⚠️ |
   * | 抖音 | 映射到 `tt.getSystemInfoSync`，补齐 `level/isCharging` | ⚠️ |
   */
  getBatteryInfoSync: WeapiCrossPlatformAdapter['getBatteryInfoSync']

  /**
   * 获取日志管理器实例。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getLogManager` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getLogManager: WeapiCrossPlatformAdapter['getLogManager']

  /**
   * 延迟到下一个 UI 更新时机执行回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.nextTick` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  nextTick: WeapiCrossPlatformAdapter['nextTick']

  /**
   * 监听窗口尺寸变化事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.onWindowResize` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.onWindowResize` | ⚠️ |
   */
  onWindowResize: WeapiCrossPlatformAdapter['onWindowResize']

  /**
   * 取消监听窗口尺寸变化事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.offWindowResize` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.offWindowResize` | ⚠️ |
   */
  offWindowResize: WeapiCrossPlatformAdapter['offWindowResize']

  /**
   * 上报分析数据。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.reportAnalytics` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.reportAnalytics` | ⚠️ |
   */
  reportAnalytics: WeapiCrossPlatformAdapter['reportAnalytics']

  /**
   * 打开客服会话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openCustomerServiceChat` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openCustomerServiceChat: WeapiCrossPlatformAdapter['openCustomerServiceChat']

  /**
   * 创建视觉识别会话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createVKSession` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createVKSession: WeapiCrossPlatformAdapter['createVKSession']

  /**
   * 压缩视频文件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.compressVideo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  compressVideo: WeapiCrossPlatformAdapter['compressVideo']

  /**
   * 打开视频编辑器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openVideoEditor` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openVideoEditor: WeapiCrossPlatformAdapter['openVideoEditor']

  /**
   * 获取转发详细信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getShareInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getShareInfo: WeapiCrossPlatformAdapter['getShareInfo']

  /**
   * 加入音视频通话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.joinVoIPChat` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  joinVoIPChat: WeapiCrossPlatformAdapter['joinVoIPChat']

  /**
   * 打开文档。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openDocument` | ⚠️ |
   * | 支付宝 | 直连 `my.openDocument` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openDocument: WeapiCrossPlatformAdapter['openDocument']

  /**
   * 保存视频到系统相册。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.saveVideoToPhotosAlbum` | ⚠️ |
   * | 支付宝 | 直连 `my.saveVideoToPhotosAlbum` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  saveVideoToPhotosAlbum: WeapiCrossPlatformAdapter['saveVideoToPhotosAlbum']

  /**
   * 批量异步写入缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchSetStorage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  batchSetStorage: WeapiCrossPlatformAdapter['batchSetStorage']

  /**
   * 批量异步读取缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchGetStorage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  batchGetStorage: WeapiCrossPlatformAdapter['batchGetStorage']

  /**
   * 批量同步写入缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchSetStorageSync` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  batchSetStorageSync: WeapiCrossPlatformAdapter['batchSetStorageSync']

  /**
   * 批量同步读取缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchGetStorageSync` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  batchGetStorageSync: WeapiCrossPlatformAdapter['batchGetStorageSync']

  /**
   * 创建相机上下文对象。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createCameraContext` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createCameraContext: WeapiCrossPlatformAdapter['createCameraContext']

  /**
   * 取消内存不足告警监听。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.offMemoryWarning` | ⚠️ |
   * | 支付宝 | 直连 `my.offMemoryWarning` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  offMemoryWarning: WeapiCrossPlatformAdapter['offMemoryWarning']

  /**
   * 取消空闲回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.cancelIdleCallback` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  cancelIdleCallback: WeapiCrossPlatformAdapter['cancelIdleCallback']

  /**
   * 监听 BLE 连接状态变化。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.onBLEConnectionStateChange` | ⚠️ |
   * | 支付宝 | 映射到 `my.onBLEConnectionStateChanged` | ⚠️ |
   * | 抖音 | 抖音无同等 API，调用时报 not supported | ⚠️ |
   */
  onBLEConnectionStateChange: WeapiCrossPlatformAdapter['onBLEConnectionStateChange']

  /**
   * 取消监听 BLE 连接状态变化。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.offBLEConnectionStateChange` | ⚠️ |
   * | 支付宝 | 映射到 `my.offBLEConnectionStateChanged` | ⚠️ |
   * | 抖音 | 抖音无同等 API，调用时报 not supported | ⚠️ |
   */
  offBLEConnectionStateChange: WeapiCrossPlatformAdapter['offBLEConnectionStateChange']

  /**
   * 添加微信卡券。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addCard` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addCard: WeapiCrossPlatformAdapter['addCard']

  /**
   * 添加文件到收藏。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addFileToFavorites` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addFileToFavorites: WeapiCrossPlatformAdapter['addFileToFavorites']

  /**
   * 添加支付 pass 完成回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPaymentPassFinish` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPaymentPassFinish: WeapiCrossPlatformAdapter['addPaymentPassFinish']

  /**
   * 添加支付 pass 证书数据回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPaymentPassGetCertificateData` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPaymentPassGetCertificateData: WeapiCrossPlatformAdapter['addPaymentPassGetCertificateData']

  /**
   * 添加日历事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPhoneCalendar` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPhoneCalendar: WeapiCrossPlatformAdapter['addPhoneCalendar']

  /**
   * 添加手机联系人。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPhoneContact` | ⚠️ |
   * | 支付宝 | 直连 `my.addPhoneContact` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPhoneContact: WeapiCrossPlatformAdapter['addPhoneContact']

  /**
   * 添加重复日历事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPhoneRepeatCalendar` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPhoneRepeatCalendar: WeapiCrossPlatformAdapter['addPhoneRepeatCalendar']

  /**
   * 添加视频到收藏。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addVideoToFavorites` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addVideoToFavorites: WeapiCrossPlatformAdapter['addVideoToFavorites']

  /**
   * 获取小程序授权码。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.authorizeForMiniProgram` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  authorizeForMiniProgram: WeapiCrossPlatformAdapter['authorizeForMiniProgram']

  /**
   * 校验私密消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.authPrivateMessage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  authPrivateMessage: WeapiCrossPlatformAdapter['authPrivateMessage']

  /**
   * 绑定员工关系。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.bindEmployeeRelation` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  bindEmployeeRelation: WeapiCrossPlatformAdapter['bindEmployeeRelation']

  /**
   * 检测是否可添加安全元素卡片。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.canAddSecureElementPass` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  canAddSecureElementPass: WeapiCrossPlatformAdapter['canAddSecureElementPass']

  /**
   * 获取 canvas 区域像素数据。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.canvasGetImageData` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  canvasGetImageData: WeapiCrossPlatformAdapter['canvasGetImageData']

  /**
   * 将像素数据绘制到 canvas。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.canvasPutImageData` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  canvasPutImageData: WeapiCrossPlatformAdapter['canvasPutImageData']

  /**
   * 检测设备是否支持 HEVC 解码。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkDeviceSupportHevc` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  checkDeviceSupportHevc: WeapiCrossPlatformAdapter['checkDeviceSupportHevc']

  /**
   * 查询员工关系绑定状态。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkEmployeeRelation` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  checkEmployeeRelation: WeapiCrossPlatformAdapter['checkEmployeeRelation']

  /**
   * 检测是否已添加到我的小程序。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkIsAddedToMyMiniProgram` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  checkIsAddedToMyMiniProgram: WeapiCrossPlatformAdapter['checkIsAddedToMyMiniProgram']

  /**
   * 检测系统无障碍是否开启。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkIsOpenAccessibility` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  checkIsOpenAccessibility: WeapiCrossPlatformAdapter['checkIsOpenAccessibility']

  /**
   * 检测是否处于画中画状态。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkIsPictureInPictureActive` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  checkIsPictureInPictureActive: WeapiCrossPlatformAdapter['checkIsPictureInPictureActive']

  /**
   * 检测设备是否录入 SOTER 信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkIsSoterEnrolledInDevice` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  checkIsSoterEnrolledInDevice: WeapiCrossPlatformAdapter['checkIsSoterEnrolledInDevice']

  /**
   * 检测设备是否支持 SOTER 生物认证。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkIsSupportSoterAuthentication` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  checkIsSupportSoterAuthentication: WeapiCrossPlatformAdapter['checkIsSupportSoterAuthentication']

  /**
   * 打开卡券详情。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openCard` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openCard: WeapiCrossPlatformAdapter['openCard']

  /**
   * 打开视频号活动页。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openChannelsActivity` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openChannelsActivity: WeapiCrossPlatformAdapter['openChannelsActivity']

  /**
   * 打开视频号活动详情。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openChannelsEvent` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openChannelsEvent: WeapiCrossPlatformAdapter['openChannelsEvent']

  /**
   * 打开视频号直播。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openChannelsLive` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openChannelsLive: WeapiCrossPlatformAdapter['openChannelsLive']

  /**
   * 打开视频号直播预告详情。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openChannelsLiveNoticeInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openChannelsLiveNoticeInfo: WeapiCrossPlatformAdapter['openChannelsLiveNoticeInfo']

  /**
   * 打开视频号用户主页。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openChannelsUserProfile` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openChannelsUserProfile: WeapiCrossPlatformAdapter['openChannelsUserProfile']

  /**
   * 打开客服工具页。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openChatTool` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openChatTool: WeapiCrossPlatformAdapter['openChatTool']

  /**
   * 打开香港线下支付视图。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openHKOfflinePayView` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openHKOfflinePayView: WeapiCrossPlatformAdapter['openHKOfflinePayView']

  /**
   * 打开询价话题。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openInquiriesTopic` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openInquiriesTopic: WeapiCrossPlatformAdapter['openInquiriesTopic']

  /**
   * 打开公众号文章。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openOfficialAccountArticle` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openOfficialAccountArticle: WeapiCrossPlatformAdapter['openOfficialAccountArticle']

  /**
   * 打开公众号会话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openOfficialAccountChat` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openOfficialAccountChat: WeapiCrossPlatformAdapter['openOfficialAccountChat']

  /**
   * 打开公众号主页。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openOfficialAccountProfile` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openOfficialAccountProfile: WeapiCrossPlatformAdapter['openOfficialAccountProfile']

  /**
   * 打开隐私协议页面。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openPrivacyContract` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openPrivacyContract: WeapiCrossPlatformAdapter['openPrivacyContract']

  /**
   * 打开系统蓝牙设置页面。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openSystemBluetoothSetting` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openSystemBluetoothSetting: WeapiCrossPlatformAdapter['openSystemBluetoothSetting']

  /**
   * 上报事件埋点。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.reportEvent` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  reportEvent: WeapiCrossPlatformAdapter['reportEvent']

  /**
   * 上报监控数据。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.reportMonitor` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  reportMonitor: WeapiCrossPlatformAdapter['reportMonitor']

  /**
   * 上报性能数据。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.reportPerformance` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  reportPerformance: WeapiCrossPlatformAdapter['reportPerformance']

  /**
   * 打开单个表情贴纸详情。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openSingleStickerView` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openSingleStickerView: WeapiCrossPlatformAdapter['openSingleStickerView']

  /**
   * 打开表情 IP 页面。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openStickerIPView` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openStickerIPView: WeapiCrossPlatformAdapter['openStickerIPView']

  /**
   * 打开表情包详情页。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openStickerSetView` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openStickerSetView: WeapiCrossPlatformAdapter['openStickerSetView']

  /**
   * 打开小店优惠券详情。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openStoreCouponDetail` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openStoreCouponDetail: WeapiCrossPlatformAdapter['openStoreCouponDetail']

  /**
   * 打开小店订单详情。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openStoreOrderDetail` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openStoreOrderDetail: WeapiCrossPlatformAdapter['openStoreOrderDetail']

  /**
   * 暂停后台音频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.pauseBackgroundAudio` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  pauseBackgroundAudio: WeapiCrossPlatformAdapter['pauseBackgroundAudio']

  /**
   * 暂停播放语音。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.pauseVoice` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  pauseVoice: WeapiCrossPlatformAdapter['pauseVoice']

  /**
   * 播放后台音频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.playBackgroundAudio` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  playBackgroundAudio: WeapiCrossPlatformAdapter['playBackgroundAudio']

  /**
   * 播放语音。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.playVoice` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  playVoice: WeapiCrossPlatformAdapter['playVoice']

  /**
   * 向来源小程序发送消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.postMessageToReferrerMiniProgram` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  postMessageToReferrerMiniProgram: WeapiCrossPlatformAdapter['postMessageToReferrerMiniProgram']

  /**
   * 向来源页面发送消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.postMessageToReferrerPage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  postMessageToReferrerPage: WeapiCrossPlatformAdapter['postMessageToReferrerPage']

  /**
   * 预下载分包。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.preDownloadSubpackage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  preDownloadSubpackage: WeapiCrossPlatformAdapter['preDownloadSubpackage']

  /**
   * 预加载资源。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.preloadAssets` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  preloadAssets: WeapiCrossPlatformAdapter['preloadAssets']

  /**
   * 预加载 Skyline 视图。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.preloadSkylineView` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  preloadSkylineView: WeapiCrossPlatformAdapter['preloadSkylineView']

  /**
   * 预加载 WebView 页面。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.preloadWebview` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  preloadWebview: WeapiCrossPlatformAdapter['preloadWebview']

  /**
   * 移除安全元素卡片。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.removeSecureElementPass` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  removeSecureElementPass: WeapiCrossPlatformAdapter['removeSecureElementPass']

  /**
   * 选择发票抬头。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseInvoiceTitle` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  chooseInvoiceTitle: WeapiCrossPlatformAdapter['chooseInvoiceTitle']

  /**
   * 选择车牌号。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseLicensePlate` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  chooseLicensePlate: WeapiCrossPlatformAdapter['chooseLicensePlate']

  /**
   * 选择兴趣点 POI。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.choosePoi` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  choosePoi: WeapiCrossPlatformAdapter['choosePoi']

  /**
   * 断开低功耗蓝牙连接。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.closeBLEConnection` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  closeBLEConnection: WeapiCrossPlatformAdapter['closeBLEConnection']

  /**
   * 创建低功耗蓝牙连接。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createBLEConnection` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createBLEConnection: WeapiCrossPlatformAdapter['createBLEConnection']

  /**
   * 裁剪图片。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.cropImage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  cropImage: WeapiCrossPlatformAdapter['cropImage']

  /**
   * 编辑图片。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.editImage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  editImage: WeapiCrossPlatformAdapter['editImage']

  /**
   * 退出音视频通话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.exitVoIPChat` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  exitVoIPChat: WeapiCrossPlatformAdapter['exitVoIPChat']

  /**
   * 人脸检测。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.faceDetect` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  faceDetect: WeapiCrossPlatformAdapter['faceDetect']

  /**
   * 获取 API 分类信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getApiCategory` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getApiCategory: WeapiCrossPlatformAdapter['getApiCategory']

  /**
   * 获取后台拉取 token。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getBackgroundFetchToken` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getBackgroundFetchToken: WeapiCrossPlatformAdapter['getBackgroundFetchToken']

  /**
   * 获取视频号直播信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getChannelsLiveInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getChannelsLiveInfo: WeapiCrossPlatformAdapter['getChannelsLiveInfo']

  /**
   * 获取视频号直播预告信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getChannelsLiveNoticeInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getChannelsLiveNoticeInfo: WeapiCrossPlatformAdapter['getChannelsLiveNoticeInfo']

  /**
   * 获取视频号分享 key。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getChannelsShareKey` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getChannelsShareKey: WeapiCrossPlatformAdapter['getChannelsShareKey']

  /**
   * 获取客服工具信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getChatToolInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getChatToolInfo: WeapiCrossPlatformAdapter['getChatToolInfo']

  /**
   * 获取通用配置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getCommonConfig` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getCommonConfig: WeapiCrossPlatformAdapter['getCommonConfig']

  /**
   * 获取群聊进入信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getGroupEnterInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getGroupEnterInfo: WeapiCrossPlatformAdapter['getGroupEnterInfo']

  /**
   * 获取隐私设置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getPrivacySetting` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getPrivacySetting: WeapiCrossPlatformAdapter['getPrivacySetting']

  /**
   * 初始化人脸检测。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.initFaceDetect` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  initFaceDetect: WeapiCrossPlatformAdapter['initFaceDetect']

  /**
   * 发起 1v1 通话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.join1v1Chat` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  join1v1Chat: WeapiCrossPlatformAdapter['join1v1Chat']

  /**
   * 分享到群聊会话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareAppMessageToGroup` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareAppMessageToGroup: WeapiCrossPlatformAdapter['shareAppMessageToGroup']

  /**
   * 分享到群聊表情。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareEmojiToGroup` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareEmojiToGroup: WeapiCrossPlatformAdapter['shareEmojiToGroup']

  /**
   * 分享文件消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareFileMessage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareFileMessage: WeapiCrossPlatformAdapter['shareFileMessage']

  /**
   * 分享文件到群。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareFileToGroup` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareFileToGroup: WeapiCrossPlatformAdapter['shareFileToGroup']

  /**
   * 分享图片到群。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareImageToGroup` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareImageToGroup: WeapiCrossPlatformAdapter['shareImageToGroup']

  /**
   * 分享至公众号。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareToOfficialAccount` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareToOfficialAccount: WeapiCrossPlatformAdapter['shareToOfficialAccount']

  /**
   * 分享至微信运动。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareToWeRun` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareToWeRun: WeapiCrossPlatformAdapter['shareToWeRun']

  /**
   * 分享视频消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareVideoMessage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareVideoMessage: WeapiCrossPlatformAdapter['shareVideoMessage']

  /**
   * 分享视频到群。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareVideoToGroup` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareVideoToGroup: WeapiCrossPlatformAdapter['shareVideoToGroup']

  /**
   * 展示红包组件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showRedPackage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  showRedPackage: WeapiCrossPlatformAdapter['showRedPackage']

  /**
   * 开始监听设备方向变化。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.startDeviceMotionListening` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  startDeviceMotionListening: WeapiCrossPlatformAdapter['startDeviceMotionListening']

  /**
   * 启动 HCE 功能。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.startHCE` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  startHCE: WeapiCrossPlatformAdapter['startHCE']

  /**
   * 开始本地服务发现。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.startLocalServiceDiscovery` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  startLocalServiceDiscovery: WeapiCrossPlatformAdapter['startLocalServiceDiscovery']

  /**
   * 开始持续定位。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.startLocationUpdate` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  startLocationUpdate: WeapiCrossPlatformAdapter['startLocationUpdate']

  /**
   * 开始后台持续定位。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.startLocationUpdateBackground` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  startLocationUpdateBackground: WeapiCrossPlatformAdapter['startLocationUpdateBackground']

  /**
   * 开始录音。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.startRecord` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  startRecord: WeapiCrossPlatformAdapter['startRecord']

  /**
   * 开始 SOTER 认证。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.startSoterAuthentication` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  startSoterAuthentication: WeapiCrossPlatformAdapter['startSoterAuthentication']

  /**
   * 停止后台音频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopBackgroundAudio` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopBackgroundAudio: WeapiCrossPlatformAdapter['stopBackgroundAudio']

  /**
   * 停止监听设备方向变化。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopDeviceMotionListening` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopDeviceMotionListening: WeapiCrossPlatformAdapter['stopDeviceMotionListening']

  /**
   * 停止人脸检测。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopFaceDetect` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopFaceDetect: WeapiCrossPlatformAdapter['stopFaceDetect']

  /**
   * 发起通用支付请求。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestCommonPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestCommonPayment: WeapiCrossPlatformAdapter['requestCommonPayment']

  /**
   * 请求设备 VoIP 能力。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestDeviceVoIP` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestDeviceVoIP: WeapiCrossPlatformAdapter['requestDeviceVoIP']

  /**
   * 发起商家转账请求。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestMerchantTransfer` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestMerchantTransfer: WeapiCrossPlatformAdapter['requestMerchantTransfer']

  /**
   * 请求隐私授权。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requirePrivacyAuthorize` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requirePrivacyAuthorize: WeapiCrossPlatformAdapter['requirePrivacyAuthorize']

  /**
   * 预约视频号直播。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.reserveChannelsLive` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  reserveChannelsLive: WeapiCrossPlatformAdapter['reserveChannelsLive']

  /**
   * 选择群成员。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.selectGroupMembers` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  selectGroupMembers: WeapiCrossPlatformAdapter['selectGroupMembers']

  /**
   * 发送 HCE 消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.sendHCEMessage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  sendHCEMessage: WeapiCrossPlatformAdapter['sendHCEMessage']

  /**
   * 发送短信。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.sendSms` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  sendSms: WeapiCrossPlatformAdapter['sendSms']

  /**
   * 设置后台拉取 token。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setBackgroundFetchToken` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setBackgroundFetchToken: WeapiCrossPlatformAdapter['setBackgroundFetchToken']

  /**
   * 设置 1v1 通话可用状态。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setEnable1v1Chat` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setEnable1v1Chat: WeapiCrossPlatformAdapter['setEnable1v1Chat']

  /**
   * 设置顶栏文本。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setTopBarText` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setTopBarText: WeapiCrossPlatformAdapter['setTopBarText']

  /**
   * 设置窗口尺寸。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setWindowSize` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setWindowSize: WeapiCrossPlatformAdapter['setWindowSize']

  /**
   * 停止 HCE 功能。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopHCE` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopHCE: WeapiCrossPlatformAdapter['stopHCE']

  /**
   * 停止本地服务发现。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopLocalServiceDiscovery` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopLocalServiceDiscovery: WeapiCrossPlatformAdapter['stopLocalServiceDiscovery']

  /**
   * 停止持续定位。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopLocationUpdate` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopLocationUpdate: WeapiCrossPlatformAdapter['stopLocationUpdate']

  /**
   * 停止录音。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopRecord` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopRecord: WeapiCrossPlatformAdapter['stopRecord']

  /**
   * 停止播放语音。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.stopVoice` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  stopVoice: WeapiCrossPlatformAdapter['stopVoice']

  /**
   * 订阅 VoIP 视频成员变化。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.subscribeVoIPVideoMembers` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  subscribeVoIPVideoMembers: WeapiCrossPlatformAdapter['subscribeVoIPVideoMembers']

  /**
   * 更新 VoIP 静音配置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.updateVoIPChatMuteConfig` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  updateVoIPChatMuteConfig: WeapiCrossPlatformAdapter['updateVoIPChatMuteConfig']

  /**
   * 拉起微信升级流程。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.updateWeChatApp` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  updateWeChatApp: WeapiCrossPlatformAdapter['updateWeChatApp']

  /**
   * 获取后台音频播放状态。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getBackgroundAudioPlayerState` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getBackgroundAudioPlayerState: WeapiCrossPlatformAdapter['getBackgroundAudioPlayerState']

  /**
   * 获取设备性能评估信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getDeviceBenchmarkInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getDeviceBenchmarkInfo: WeapiCrossPlatformAdapter['getDeviceBenchmarkInfo']

  /**
   * 获取设备 VoIP 列表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getDeviceVoIPList` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getDeviceVoIPList: WeapiCrossPlatformAdapter['getDeviceVoIPList']

  /**
   * 获取 HCE 状态。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getHCEState` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getHCEState: WeapiCrossPlatformAdapter['getHCEState']

  /**
   * 获取推理环境信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getInferenceEnvInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getInferenceEnvInfo: WeapiCrossPlatformAdapter['getInferenceEnvInfo']

  /**
   * 获取 NFC 适配器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getNFCAdapter` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getNFCAdapter: WeapiCrossPlatformAdapter['getNFCAdapter']

  /**
   * 获取性能对象。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getPerformance` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getPerformance: WeapiCrossPlatformAdapter['getPerformance']

  /**
   * 获取随机值。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getRandomValues` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getRandomValues: WeapiCrossPlatformAdapter['getRandomValues']

  /**
   * 获取实时日志管理器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getRealtimeLogManager` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getRealtimeLogManager: WeapiCrossPlatformAdapter['getRealtimeLogManager']

  /**
   * 获取渲染层 UserAgent。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getRendererUserAgent` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getRendererUserAgent: WeapiCrossPlatformAdapter['getRendererUserAgent']

  /**
   * 获取录屏状态。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getScreenRecordingState` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getScreenRecordingState: WeapiCrossPlatformAdapter['getScreenRecordingState']

  /**
   * 获取安全元素卡片列表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getSecureElementPasses` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getSecureElementPasses: WeapiCrossPlatformAdapter['getSecureElementPasses']

  /**
   * 获取已选中文本范围。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getSelectedTextRange` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getSelectedTextRange: WeapiCrossPlatformAdapter['getSelectedTextRange']

  /**
   * 获取开屏广告展示状态。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getShowSplashAdStatus` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getShowSplashAdStatus: WeapiCrossPlatformAdapter['getShowSplashAdStatus']

  /**
   * 获取 Skyline 信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getSkylineInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getSkylineInfo: WeapiCrossPlatformAdapter['getSkylineInfo']

  /**
   * 获取用户加密管理器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getUserCryptoManager` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getUserCryptoManager: WeapiCrossPlatformAdapter['getUserCryptoManager']

  /**
   * 获取微信运动数据。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getWeRunData` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getWeRunData: WeapiCrossPlatformAdapter['getWeRunData']

  /**
   * 获取 XR 框架系统对象。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getXrFrameSystem` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getXrFrameSystem: WeapiCrossPlatformAdapter['getXrFrameSystem']

  /**
   * 判断蓝牙设备是否已配对。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.isBluetoothDevicePaired` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  isBluetoothDevicePaired: WeapiCrossPlatformAdapter['isBluetoothDevicePaired']

  /**
   * 判断是否支持视觉识别能力。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.isVKSupport` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  isVKSupport: WeapiCrossPlatformAdapter['isVKSupport']

  /**
   * 创建 BLE 外设服务实例。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createBLEPeripheralServer` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createBLEPeripheralServer: WeapiCrossPlatformAdapter['createBLEPeripheralServer']

  /**
   * 创建缓冲区 URL。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createBufferURL` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createBufferURL: WeapiCrossPlatformAdapter['createBufferURL']

  /**
   * 创建缓存管理器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createCacheManager` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createCacheManager: WeapiCrossPlatformAdapter['createCacheManager']

  /**
   * 创建全局支付对象。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createGlobalPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createGlobalPayment: WeapiCrossPlatformAdapter['createGlobalPayment']

  /**
   * 创建推理会话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createInferenceSession` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createInferenceSession: WeapiCrossPlatformAdapter['createInferenceSession']

  /**
   * 创建媒体音频播放器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createMediaAudioPlayer` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createMediaAudioPlayer: WeapiCrossPlatformAdapter['createMediaAudioPlayer']

  /**
   * 创建媒体容器实例。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createMediaContainer` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createMediaContainer: WeapiCrossPlatformAdapter['createMediaContainer']

  /**
   * 创建媒体录制器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createMediaRecorder` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createMediaRecorder: WeapiCrossPlatformAdapter['createMediaRecorder']

  /**
   * 创建 TCP Socket。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createTCPSocket` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createTCPSocket: WeapiCrossPlatformAdapter['createTCPSocket']

  /**
   * 创建 UDP Socket。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createUDPSocket` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createUDPSocket: WeapiCrossPlatformAdapter['createUDPSocket']

  /**
   * 创建视频解码器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createVideoDecoder` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createVideoDecoder: WeapiCrossPlatformAdapter['createVideoDecoder']

  /**
   * 加载内置字体。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.loadBuiltInFontFace` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  loadBuiltInFontFace: WeapiCrossPlatformAdapter['loadBuiltInFontFace']

  /**
   * 通知群成员。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.notifyGroupMembers` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  notifyGroupMembers: WeapiCrossPlatformAdapter['notifyGroupMembers']

  /**
   * 空闲时回调请求。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestIdleCallback` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestIdleCallback: WeapiCrossPlatformAdapter['requestIdleCallback']

  /**
   * 释放缓冲区 URL。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.revokeBufferURL` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  revokeBufferURL: WeapiCrossPlatformAdapter['revokeBufferURL']

  /**
   * 重写路由规则。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.rewriteRoute` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  rewriteRoute: WeapiCrossPlatformAdapter['rewriteRoute']

  /**
   * 调整后台音频播放进度。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.seekBackgroundAudio` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  seekBackgroundAudio: WeapiCrossPlatformAdapter['seekBackgroundAudio']

  /**
   * 设置调试开关。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setEnableDebug` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setEnableDebug: WeapiCrossPlatformAdapter['setEnableDebug']

  /**
   * 设置内部音频选项。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setInnerAudioOption` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setInnerAudioOption: WeapiCrossPlatformAdapter['setInnerAudioOption']
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
  /**
   * @description 严格兼容模式（兼容字段）：当前版本默认已关闭通用 fallback，该选项保留向后兼容
   */
  strictCompatibility?: boolean
}

export type WeapiSupportLevel = 'native' | 'mapped' | 'fallback' | 'unsupported'

export interface WeapiMethodSupportQueryOptions {
  /**
   * @description 是否按语义对齐能力判断（仅 `native/mapped` 视为支持）
   */
  semantic?: boolean
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
  /**
   * @description 当前支持级别：直连、显式映射、fallback（保留状态）或不支持
   */
  supportLevel: WeapiSupportLevel
  /**
   * @description 是否语义对齐（仅 native/mapped 为 true）
   */
  semanticAligned: boolean
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
  supports: (method: string, options?: WeapiMethodSupportQueryOptions) => boolean
}
