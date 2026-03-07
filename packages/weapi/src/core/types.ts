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
   * | 抖音 | 优先直连 `tt.showActionSheet`；缺失时降级到 `tt.showModal` shim | ✅ |
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
   * | 支付宝 | 映射到 `my.chooseImage`，并补齐 `tempFiles[].tempFilePath/fileType` | ⚠️ |
   * | 抖音 | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType` | ⚠️ |
   */
  chooseMedia: WeapiCrossPlatformAdapter['chooseMedia']

  /**
   * 选择会话文件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseMessageFile` | ⚠️ |
   * | 支付宝 | 映射到 `my.chooseImage`，并补齐 `tempFiles[].path/name` | ⚠️ |
   * | 抖音 | 映射到 `tt.chooseImage`，并补齐 `tempFiles[].path/name` | ⚠️ |
   */
  chooseMessageFile: WeapiCrossPlatformAdapter['chooseMessageFile']

  /**
   * 获取模糊地理位置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getFuzzyLocation` | ⚠️ |
   * | 支付宝 | 映射到 `my.getLocation` | ⚠️ |
   * | 抖音 | 映射到 `tt.getLocation` | ⚠️ |
   */
  getFuzzyLocation: WeapiCrossPlatformAdapter['getFuzzyLocation']

  /**
   * 预览图片和视频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.previewMedia` | ⚠️ |
   * | 支付宝 | 映射到 `my.previewImage`，并将 `sources.url` 对齐到 `urls` | ⚠️ |
   * | 抖音 | 映射到 `tt.previewImage`，并将 `sources.url` 对齐到 `urls` | ⚠️ |
   */
  previewMedia: WeapiCrossPlatformAdapter['previewMedia']

  /**
   * 创建插屏广告实例。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createInterstitialAd` | ⚠️ |
   * | 支付宝 | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId` | ⚠️ |
   * | 抖音 | 直连 `tt.createInterstitialAd` | ⚠️ |
   */
  createInterstitialAd: WeapiCrossPlatformAdapter['createInterstitialAd']

  /**
   * 创建激励视频广告实例。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createRewardedVideoAd` | ⚠️ |
   * | 支付宝 | 映射到 `my.createRewardedAd`，并对齐入参 `adUnitId` | ⚠️ |
   * | 抖音 | 映射到 `tt.createInterstitialAd` | ⚠️ |
   */
  createRewardedVideoAd: WeapiCrossPlatformAdapter['createRewardedVideoAd']

  /**
   * 创建直播播放器上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createLivePlayerContext` | ⚠️ |
   * | 支付宝 | 映射到 `my.createVideoContext` | ⚠️ |
   * | 抖音 | 直连 `tt.createLivePlayerContext` | ⚠️ |
   */
  createLivePlayerContext: WeapiCrossPlatformAdapter['createLivePlayerContext']

  /**
   * 创建直播推流上下文。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createLivePusherContext` | ⚠️ |
   * | 支付宝 | 映射到 `my.createVideoContext` | ⚠️ |
   * | 抖音 | 映射到 `tt.createVideoContext` | ⚠️ |
   */
  createLivePusherContext: WeapiCrossPlatformAdapter['createLivePusherContext']

  /**
   * 获取视频详细信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getVideoInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getVideoInfo` | ⚠️ |
   * | 抖音 | 映射到 `tt.getFileInfo`，并将 `src` 对齐为 `filePath` | ⚠️ |
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
   * 登录。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.login` | ⚠️ |
   * | 支付宝 | 映射到 `my.getAuthCode`，并对齐返回 `code` 字段 | ⚠️ |
   * | 抖音 | 直连 `tt.login` | ⚠️ |
   */
  login: WeapiCrossPlatformAdapter['login']

  /**
   * 提前向用户发起授权请求。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.authorize` | ⚠️ |
   * | 支付宝 | 映射到 `my.getAuthCode`，并对齐 `scope` -> `scopes` 参数 | ⚠️ |
   * | 抖音 | 直连 `tt.authorize` | ⚠️ |
   */
  authorize: WeapiCrossPlatformAdapter['authorize']

  /**
   * 检查登录态是否过期。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkSession` | ⚠️ |
   * | 支付宝 | 映射到 `my.getAuthCode`，按成功结果对齐 `checkSession:ok` | ⚠️ |
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
   * | 支付宝 | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | ⚠️ |
   * | 抖音 | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
   */
  requestPayment: WeapiCrossPlatformAdapter['requestPayment']

  /**
   * 发起订单支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestOrderPayment` | ⚠️ |
   * | 支付宝 | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | ⚠️ |
   * | 抖音 | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
   */
  requestOrderPayment: WeapiCrossPlatformAdapter['requestOrderPayment']

  /**
   * 发起插件支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestPluginPayment` | ⚠️ |
   * | 支付宝 | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | ⚠️ |
   * | 抖音 | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
   */
  requestPluginPayment: WeapiCrossPlatformAdapter['requestPluginPayment']

  /**
   * 发起虚拟支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestVirtualPayment` | ⚠️ |
   * | 支付宝 | 映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr` | ⚠️ |
   * | 抖音 | 映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo` | ⚠️ |
   */
  requestVirtualPayment: WeapiCrossPlatformAdapter['requestVirtualPayment']

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

  /**
   * 选择视频。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseVideo` | ⚠️ |
   * | 支付宝 | 直连 `my.chooseVideo` | ⚠️ |
   * | 抖音 | 映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构 | ⚠️ |
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
   * | 支付宝 | 使用内置日志 shim（对齐 `log/info/warn/error`） | ⚠️ |
   * | 抖音 | 使用内置日志 shim（对齐 `log/info/warn/error`） | ⚠️ |
   */
  getLogManager: WeapiCrossPlatformAdapter['getLogManager']

  /**
   * 延迟到下一个 UI 更新时机执行回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.nextTick` | ⚠️ |
   * | 支付宝 | 使用内置 microtask shim 调度回调 | ⚠️ |
   * | 抖音 | 使用内置 microtask shim 调度回调 | ⚠️ |
   */
  nextTick: WeapiCrossPlatformAdapter['nextTick']

  /**
   * 监听窗口尺寸变化事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.onWindowResize` | ⚠️ |
   * | 支付宝 | 使用内置 shim，通过 `my.onAppShow + my.getWindowInfo` 近似监听 | ⚠️ |
   * | 抖音 | 直连 `tt.onWindowResize` | ⚠️ |
   */
  onWindowResize: WeapiCrossPlatformAdapter['onWindowResize']

  /**
   * 取消监听窗口尺寸变化事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.offWindowResize` | ⚠️ |
   * | 支付宝 | 使用内置 shim，移除 `onWindowResize` 注册回调 | ⚠️ |
   * | 抖音 | 直连 `tt.offWindowResize` | ⚠️ |
   */
  offWindowResize: WeapiCrossPlatformAdapter['offWindowResize']

  /**
   * 上报分析数据。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.reportAnalytics` | ⚠️ |
   * | 支付宝 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   * | 抖音 | 直连 `tt.reportAnalytics` | ⚠️ |
   */
  reportAnalytics: WeapiCrossPlatformAdapter['reportAnalytics']

  /**
   * 打开客服会话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openCustomerServiceChat` | ⚠️ |
   * | 支付宝 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   * | 抖音 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   */
  openCustomerServiceChat: WeapiCrossPlatformAdapter['openCustomerServiceChat']

  /**
   * 创建视觉识别会话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createVKSession` | ⚠️ |
   * | 支付宝 | 使用内置 VKSession shim（对齐 `start/stop/destroy`） | ⚠️ |
   * | 抖音 | 使用内置 VKSession shim（对齐 `start/stop/destroy`） | ⚠️ |
   */
  createVKSession: WeapiCrossPlatformAdapter['createVKSession']

  /**
   * 压缩视频文件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.compressVideo` | ⚠️ |
   * | 支付宝 | 使用内置 shim（回传原始文件路径） | ⚠️ |
   * | 抖音 | 使用内置 shim（回传原始文件路径） | ⚠️ |
   */
  compressVideo: WeapiCrossPlatformAdapter['compressVideo']

  /**
   * 打开视频编辑器。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openVideoEditor` | ⚠️ |
   * | 支付宝 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   * | 抖音 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   */
  openVideoEditor: WeapiCrossPlatformAdapter['openVideoEditor']

  /**
   * 获取转发详细信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getShareInfo` | ⚠️ |
   * | 支付宝 | 使用内置 shim（补齐 `encryptedData/iv`） | ⚠️ |
   * | 抖音 | 使用内置 shim（补齐 `encryptedData/iv`） | ⚠️ |
   */
  getShareInfo: WeapiCrossPlatformAdapter['getShareInfo']

  /**
   * 加入音视频通话。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.joinVoIPChat` | ⚠️ |
   * | 支付宝 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   * | 抖音 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   */
  joinVoIPChat: WeapiCrossPlatformAdapter['joinVoIPChat']

  /**
   * 打开文档。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openDocument` | ⚠️ |
   * | 支付宝 | 直连 `my.openDocument` | ⚠️ |
   * | 抖音 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   */
  openDocument: WeapiCrossPlatformAdapter['openDocument']

  /**
   * 保存视频到系统相册。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.saveVideoToPhotosAlbum` | ⚠️ |
   * | 支付宝 | 直连 `my.saveVideoToPhotosAlbum` | ⚠️ |
   * | 抖音 | 映射到 `tt.saveImageToPhotosAlbum` | ⚠️ |
   */
  saveVideoToPhotosAlbum: WeapiCrossPlatformAdapter['saveVideoToPhotosAlbum']

  /**
   * 批量异步写入缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchSetStorage` | ⚠️ |
   * | 支付宝 | 使用内置 shim，逐项转调 `my.setStorage` | ⚠️ |
   * | 抖音 | 使用内置 shim，逐项转调 `tt.setStorage` | ⚠️ |
   */
  batchSetStorage: WeapiCrossPlatformAdapter['batchSetStorage']

  /**
   * 批量异步读取缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchGetStorage` | ⚠️ |
   * | 支付宝 | 使用内置 shim，逐项转调 `my.getStorage` | ⚠️ |
   * | 抖音 | 使用内置 shim，逐项转调 `tt.getStorage` | ⚠️ |
   */
  batchGetStorage: WeapiCrossPlatformAdapter['batchGetStorage']

  /**
   * 批量同步写入缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchSetStorageSync` | ⚠️ |
   * | 支付宝 | 使用内置 shim，逐项转调 `my.setStorageSync` | ⚠️ |
   * | 抖音 | 使用内置 shim，逐项转调 `tt.setStorageSync` | ⚠️ |
   */
  batchSetStorageSync: WeapiCrossPlatformAdapter['batchSetStorageSync']

  /**
   * 批量同步读取缓存。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.batchGetStorageSync` | ⚠️ |
   * | 支付宝 | 使用内置 shim，逐项转调 `my.getStorageSync` | ⚠️ |
   * | 抖音 | 使用内置 shim，逐项转调 `tt.getStorageSync` | ⚠️ |
   */
  batchGetStorageSync: WeapiCrossPlatformAdapter['batchGetStorageSync']

  /**
   * 创建相机上下文对象。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createCameraContext` | ⚠️ |
   * | 支付宝 | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） | ⚠️ |
   * | 抖音 | 使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`） | ⚠️ |
   */
  createCameraContext: WeapiCrossPlatformAdapter['createCameraContext']

  /**
   * 取消内存不足告警监听。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.offMemoryWarning` | ⚠️ |
   * | 支付宝 | 直连 `my.offMemoryWarning` | ⚠️ |
   * | 抖音 | 使用内置 shim，配合 `tt.onMemoryWarning` 实现监听解绑 | ⚠️ |
   */
  offMemoryWarning: WeapiCrossPlatformAdapter['offMemoryWarning']

  /**
   * 取消空闲回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.cancelIdleCallback` | ⚠️ |
   * | 支付宝 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   * | 抖音 | 使用内置 no-op shim（保持调用不抛错） | ⚠️ |
   */
  cancelIdleCallback: WeapiCrossPlatformAdapter['cancelIdleCallback']
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
   * @description 严格兼容模式：关闭通用 fallback，仅保留同名直连与显式映射
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
   * @description 当前支持级别：直连、显式映射、fallback 或不支持
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
