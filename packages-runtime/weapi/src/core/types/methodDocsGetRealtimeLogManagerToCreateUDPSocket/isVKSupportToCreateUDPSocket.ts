import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsGetRealtimeLogManagerToCreateUDPSocketIsVKSupportToCreateUDPSocket {
  /**
   * 判断是否支持视觉识别能力。
   *
   * 分类：ai
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.isVKSupport.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/wx.createBLEPeripheralServer.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.createBufferURL.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：payment
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/payment/GlobalPayment.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：ai
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createMediaRecorder` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.createMediaRecorder` | ⚠️ |
   */
  createMediaRecorder: WeapiCrossPlatformAdapter['createMediaRecorder']

  /**
   * 创建 TCP Socket。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createUDPSocket` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  createUDPSocket: WeapiCrossPlatformAdapter['createUDPSocket']
}
