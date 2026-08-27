import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsChoosePoiToShareFileToGroupGetChannelsShareKeyToShareFileToGroup {
  /**
   * 获取视频号分享 key。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.getChannelsShareKey.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：chattool
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/chattool/wx.getChatToolInfo.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：data-analysis
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.getCommonConfig.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/group/wx.getGroupEnterInfo.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/privacy/wx.getPrivacySetting.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：ai
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ai/face/wx.initFaceDetect.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.join1v1Chat.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：chattool
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/chattool/wx.shareAppMessageToGroup.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：chattool
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/chattool/wx.shareEmojiToGroup.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.shareFileMessage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：chattool
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/chattool/wx.shareFileToGroup.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.shareFileToGroup` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  shareFileToGroup: WeapiCrossPlatformAdapter['shareFileToGroup']
}
