import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsShareImageToGroupToSelectGroupMembersStartRecordToSelectGroupMembers {
  /**
   * 开始录音。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.startRecord.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/soter/wx.startSoterAuthentication.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.stopBackgroundAudio.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.stopDeviceMotionListening.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：ai
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ai/face/wx.stopFaceDetect.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：payment
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestCommonPayment.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.requestDeviceVoIP.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：payment
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestMerchantTransfer.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/privacy/wx.requirePrivacyAuthorize.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.reserveChannelsLive.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：chattool
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/chattool/wx.selectGroupMembers.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.selectGroupMembers` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  selectGroupMembers: WeapiCrossPlatformAdapter['selectGroupMembers']
}
