import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsSaveVideoToPhotosAlbumToCanAddSecureElementPassSaveVideoToPhotosAlbumToAddCard {
  /**
   * 保存视频到系统相册。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.saveVideoToPhotosAlbum.html
   *
   * 说明：
   * - 用于把本地视频保存到系统相册，常见于下载视频、导出创作内容、生成短视频后交给用户留存。
   * - 调用前通常需要确认相册写入授权，失败时应引导用户重新授权或打开设置页。
   * - 一般要求传入本地可访问文件路径，远程地址通常需要先下载到临时目录。
   *
   * 示例：
   * ```ts
   * await wpi.saveVideoToPhotosAlbum({
   *   filePath: tempVideoPath,
   * })
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchSetStorage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchGetStorage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchSetStorageSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchGetStorageSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/memory/wx.offMemoryWarning.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.cancelIdleCallback.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLEConnectionStateChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.offBLEConnectionStateChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/card/wx.addCard.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addCard` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addCard: WeapiCrossPlatformAdapter['addCard']
}
