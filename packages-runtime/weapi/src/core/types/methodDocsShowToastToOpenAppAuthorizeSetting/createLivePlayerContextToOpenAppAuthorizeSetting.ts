import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsShowToastToOpenAppAuthorizeSettingCreateLivePlayerContextToOpenAppAuthorizeSetting {
  /**
   * 创建直播播放器上下文。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.getVideoInfo.html
   *
   * 说明：
   * - 用于读取视频时长、宽高、码率、方向等元信息，适合在上传前做大小限制或转码分支判断。
   * - 常见于选择视频后先校验时长和分辨率，再决定是否压缩、是否允许继续发布。
   * - 当视频来自临时文件或下载文件时，建议先确认路径可访问，避免在校验阶段直接失败。
   *
   * 示例：
   * ```ts
   * const info = await wpi.getVideoInfo({
   *   src: tempVideoPath,
   * })
   *
   * console.log(info.duration, info.width, info.height)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：文件（跨端扩展）
   * 文档链接：微信当前 typings 未声明同名 API，本地索引无对应文档链接。
   *
   * 说明：
   * - 这是 `@wevu/api` 补齐的跨端扩展能力，不是微信 typings 当前声明的原生同名方法。
   * - 用于把临时文件转为可长期复用的本地文件路径，常见于下载后缓存、附件保留、离线素材持久化。
   * - 输入通常是 `tempFilePath`，返回结果中的 `savedFilePath` 可配合存储能力自行维护索引。
   * - 不同宿主对文件配额、目录结构和返回字段存在差异，跨端使用时应优先读取统一映射后的结果。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | ⚠️ |
   * | 支付宝 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | ⚠️ |
   * | 抖音 | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath` | ⚠️ |
   *
   * 示例：
   * ```ts
   * const result = await wpi.saveFile({
   *   tempFilePath,
   * })
   *
   * console.log(result.savedFilePath)
   * ```
   */
  saveFile: WeapiCrossPlatformAdapter['saveFile']

  /**
   * 设置剪贴板内容。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/clipboard/wx.setClipboardData.html
   *
   * 说明：
   * - 用于把文本写入系统剪贴板，常见于复制链接、口令、兑换码、订单号等交互。
   * - 成功后通常会配合 `showToast` 给用户明确反馈，避免“已经复制但用户无感知”。
   * - 该能力面向纯文本场景更稳定，复杂富文本或图片内容是否支持取决于宿主实现。
   *
   * 示例：
   * ```ts
   * await wpi.setClipboardData({
   *   data: inviteCode,
   * })
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/clipboard/wx.getClipboardData.html
   *
   * 说明：
   * - 用于读取当前剪贴板文本，常见于自动识别口令、粘贴优惠码、恢复邀请信息等场景。
   * - 读取剪贴板前应评估业务必要性，避免造成打扰或引发用户对隐私的误解。
   * - 返回字段已在跨端适配层统一为微信风格，消费侧优先读取 `data` 即可。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getClipboardData()
   *
   * console.log(result.data)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/address/wx.chooseAddress.html
   *
   * 说明：
   * - 用于调起宿主地址选择能力，让用户直接选择或新增收货地址，适合电商下单、售后寄回等流程。
   * - 通常依赖用户实名或地址能力授权，失败时需要准备手动填写地址的兜底路径。
   * - 返回结果适合作为表单初值，落库前仍建议结合业务规则做字段校验与补全。
   *
   * 示例：
   * ```ts
   * const address = await wpi.chooseAddress()
   *
   * console.log(address.userName, address.telNumber)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioContext.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoAsync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getSystemInfoAsync` | ⚠️ |
   * | 支付宝 | 映射到 `my.getSystemInfo` | ⚠️ |
   * | 抖音 | 映射到 `tt.getSystemInfo` | ⚠️ |
   */
  getSystemInfoAsync: WeapiCrossPlatformAdapter['getSystemInfoAsync']

  /**
   * 打开小程序授权设置页。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.openAppAuthorizeSetting.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openAppAuthorizeSetting` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openAppAuthorizeSetting: WeapiCrossPlatformAdapter['openAppAuthorizeSetting']
}
