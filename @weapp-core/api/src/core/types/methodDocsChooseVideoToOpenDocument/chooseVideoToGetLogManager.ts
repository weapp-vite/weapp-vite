import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsChooseVideoToOpenDocumentChooseVideoToGetLogManager {
  /**
   * 选择视频。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseVideo.html
   *
   * 说明：
   * - 适合视频发布、实名认证资料上传、工单取证等需要采集单个视频文件的场景。
   * - 可通过 `sourceType`、`compressed`、`maxDuration` 控制来源、压缩策略和时长限制。
   * - 返回的临时文件路径通常会继续交给 `uploadFile`、视频预览或二次编辑流程。
   *
   * 示例：
   * ```ts
   * const result = await wpi.chooseVideo({
   *   sourceType: ['album', 'camera'],
   *   compressed: true,
   *   maxDuration: 30,
   * })
   *
   * console.log(result.tempFilePath, result.duration)
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
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
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.hideHomeButton.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html
   *
   * 说明：
   * - 适合获取窗口宽高、像素比、状态栏高度等布局相关信息。
   * - 常用于自定义导航栏、胶囊位布局、响应式页面计算等场景。
   *
   * 示例：
   * ```ts
   * const info = await wpi.getWindowInfo()
   *
   * console.log(info.windowWidth, info.windowHeight)
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getWindowInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getWindowInfo` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getWindowInfo: WeapiCrossPlatformAdapter['getWindowInfo']

  /**
   * 获取设备基础信息。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getDeviceInfo.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getDeviceInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getDeviceInfo: WeapiCrossPlatformAdapter['getDeviceInfo']

  /**
   * 同步获取当前账号信息。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/account-info/wx.getAccountInfoSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getAccountInfoSync` | ⚠️ |
   * | 支付宝 | 直连 `my.getAccountInfoSync` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getAccountInfoSync: WeapiCrossPlatformAdapter['getAccountInfoSync']

  /**
   * 动态设置窗口背景色。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundColor.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setBackgroundColor` | ⚠️ |
   * | 支付宝 | 直连 `my.setBackgroundColor` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setBackgroundColor: WeapiCrossPlatformAdapter['setBackgroundColor']

  /**
   * 动态设置下拉背景字体样式。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundTextStyle.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.setBackgroundTextStyle` | ⚠️ |
   * | 支付宝 | 直连 `my.setBackgroundTextStyle` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  setBackgroundTextStyle: WeapiCrossPlatformAdapter['setBackgroundTextStyle']

  /**
   * 获取网络类型。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.getNetworkType.html
   *
   * 说明：
   * - 用于获取当前网络状态，常见于弱网提示、下载策略和提交前校验。
   * - 结果通常用于提示或策略调整，不建议把网络类型当成绝对可靠的业务判断条件。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getNetworkType()
   *
   * console.log(result.networkType)
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getNetworkType` | ⚠️ |
   * | 支付宝 | 直连 `my.getNetworkType` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getNetworkType: WeapiCrossPlatformAdapter['getNetworkType']

  /**
   * 异步获取电量信息。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.getBatteryInfo.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getBatteryInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getBatteryInfo` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getBatteryInfo: WeapiCrossPlatformAdapter['getBatteryInfo']

  /**
   * 同步获取电量信息。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.getBatteryInfoSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getBatteryInfoSync` | ⚠️ |
   * | 支付宝 | 直连 `my.getBatteryInfoSync` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getBatteryInfoSync: WeapiCrossPlatformAdapter['getBatteryInfoSync']

  /**
   * 获取日志管理器实例。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/LogManager.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getLogManager` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getLogManager: WeapiCrossPlatformAdapter['getLogManager']
}
