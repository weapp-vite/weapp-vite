import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsOpenSystemBluetoothSettingToChooseLicensePlateOpenSystemBluetoothSettingToPauseVoice {
  /**
   * 打开系统蓝牙设置页面。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.openSystemBluetoothSetting.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：data-analysis
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.reportEvent.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：data-analysis
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.reportMonitor.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.reportPerformance.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/sticker/wx.openSingleStickerView.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/sticker/wx.openStickerIPView.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/sticker/wx.openStickerSetView.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/store/wx.openStoreCouponDetail.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/store/wx.openStoreOrderDetail.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.pauseBackgroundAudio.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.pauseVoice.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.pauseVoice` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  pauseVoice: WeapiCrossPlatformAdapter['pauseVoice']
}
