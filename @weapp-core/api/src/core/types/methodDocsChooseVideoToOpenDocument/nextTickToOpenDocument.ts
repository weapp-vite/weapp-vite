import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsChooseVideoToOpenDocumentNextTickToOpenDocument {
  /**
   * 延迟到下一个 UI 更新时机执行回调。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/custom-component/wx.nextTick.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.onWindowResize.html
   *
   * 说明：
   * - 用于监听窗口宽高变化，适合横竖屏切换、自定义布局或容器尺寸重算场景。
   *
   * 示例：
   * ```ts
   * wpi.onWindowResize((event) => {
   *   console.log(event.size)
   * })
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
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
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.offWindowResize.html
   *
   * 说明：
   * - 用于移除通过 `onWindowResize` 注册的回调，避免重复监听或页面卸载后的残留订阅。
   *
   * 示例：
   * ```ts
   * const handler = (event: any) => {
   *   console.log(event.size)
   * }
   *
   * wpi.onWindowResize(handler)
   * wpi.offWindowResize(handler)
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
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
   * 分类：data-analysis
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.reportAnalytics.html
   *
   * 说明：
   * - 用于把业务埋点事件和附加参数上报给宿主分析系统，适合统计曝光、点击、转化等关键行为。
   * - 上报字段应保持稳定、可枚举，避免把用户隐私或不可控大对象直接塞进埋点参数。
   * - 一般建议在明确业务节点触发，不要把它当作日志打印替代品滥用。
   *
   * 示例：
   * ```ts
   * wpi.reportAnalytics('pay_success', {
   *   channel: 'coupon',
   *   amount: '199',
   * })
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/service-chat/wx.openCustomerServiceChat.html
   *
   * 说明：
   * - 用于拉起官方客服会话，适合订单咨询、售后反馈、会员问题处理等需要转人工服务的场景。
   * - 一般需要业务侧先准备好 `extInfo`、客服入口或会话来源信息，方便客服端识别上下文。
   * - 该能力是否可用受平台开放策略和商家配置影响，调用失败时应保留电话、表单或 IM 兜底入口。
   *
   * 示例：
   * ```ts
   * await wpi.openCustomerServiceChat({
   *   extInfo: { url: 'https://work.weixin.qq.com/kfid/kfc-demo' },
   *   corpId: 'wwxxxxxxxxxxxxxxxx',
   * })
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：ai
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.compressVideo.html
   *
   * 说明：
   * - 用于在上传、分享或本地持久化前降低视频体积，减少网络开销与用户等待时间。
   * - 常见于拍摄完成后即时压缩，再衔接 `uploadFile`、保存草稿或视频编辑流程。
   * - 压缩耗时与结果体积受原视频码率、时长和宿主实现影响，业务上应准备加载态与失败兜底。
   *
   * 示例：
   * ```ts
   * const result = await wpi.compressVideo({
   *   src: tempVideoPath,
   *   quality: 'medium',
   * })
   *
   * console.log(result.tempFilePath)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.openVideoEditor.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.getShareInfo.html
   *
   * 说明：
   * - 用于获取群分享或特定场景下附带的加密转发信息，通常需要后端配合解密使用。
   * - 常见于群裂变、群来源识别或分享渠道归因场景，但是否可拿到有效数据受分享场景限制。
   * - 调用前应明确 `shareTicket` 来源，避免把它当成所有分享链路都可用的通用能力。
   *
   * 示例：
   * ```ts
   * const detail = await wpi.getShareInfo({
   *   shareTicket,
   * })
   *
   * console.log(detail.encryptedData, detail.iv)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.joinVoIPChat.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：文件
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/file/wx.openDocument.html
   *
   * 说明：
   * - 用于拉起宿主文档查看器打开本地文件，适合预览 PDF、Word、Excel、PPT 等办公文档。
   * - 通常要先通过 `downloadFile` 获取临时文件，或使用已保存到本地的 `filePath` 再调用。
   * - 文档类型识别、菜单能力和默认打开方式由宿主决定，调用前建议确认文件已完整落盘。
   *
   * 示例：
   * ```ts
   * const file = await wpi.downloadFile({
   *   url: 'https://example.com/manual.pdf',
   * })
   *
   * await wpi.openDocument({
   *   filePath: file.tempFilePath,
   *   showMenu: true,
   * })
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openDocument` | ⚠️ |
   * | 支付宝 | 直连 `my.openDocument` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openDocument: WeapiCrossPlatformAdapter['openDocument']
}
