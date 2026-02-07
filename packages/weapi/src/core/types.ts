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
   * | 抖音 | 直连 `tt.showActionSheet` | ✅ |
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
   * | 抖音 | `tempFilePaths` 为字符串时归一化为数组 | ✅ |
   */
  chooseImage: WeapiCrossPlatformAdapter['chooseImage']

  /**
   * 保存文件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.saveFile` | ✅ |
   * | 支付宝 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | ✅ |
   * | 抖音 | 直连 `tt.saveFile` | ✅ |
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
}
