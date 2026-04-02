import type { WeapiCrossPlatformAdapter } from '../types'

export interface WeapiCrossPlatformMethodDocsSaveVideoToPhotosAlbumToCanAddSecureElementPass {
  /**
   * 保存视频到系统相册。
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
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addCard` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addCard: WeapiCrossPlatformAdapter['addCard']

  /**
   * 添加文件到收藏。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addFileToFavorites` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addFileToFavorites: WeapiCrossPlatformAdapter['addFileToFavorites']

  /**
   * 添加支付 pass 完成回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPaymentPassFinish` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPaymentPassFinish: WeapiCrossPlatformAdapter['addPaymentPassFinish']

  /**
   * 添加支付 pass 证书数据回调。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPaymentPassGetCertificateData` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPaymentPassGetCertificateData: WeapiCrossPlatformAdapter['addPaymentPassGetCertificateData']

  /**
   * 添加日历事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPhoneCalendar` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPhoneCalendar: WeapiCrossPlatformAdapter['addPhoneCalendar']

  /**
   * 添加手机联系人。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPhoneContact` | ⚠️ |
   * | 支付宝 | 直连 `my.addPhoneContact` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPhoneContact: WeapiCrossPlatformAdapter['addPhoneContact']

  /**
   * 添加重复日历事件。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addPhoneRepeatCalendar` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addPhoneRepeatCalendar: WeapiCrossPlatformAdapter['addPhoneRepeatCalendar']

  /**
   * 添加视频到收藏。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.addVideoToFavorites` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  addVideoToFavorites: WeapiCrossPlatformAdapter['addVideoToFavorites']

  /**
   * 获取小程序授权码。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.authorizeForMiniProgram` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  authorizeForMiniProgram: WeapiCrossPlatformAdapter['authorizeForMiniProgram']

  /**
   * 校验私密消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.authPrivateMessage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  authPrivateMessage: WeapiCrossPlatformAdapter['authPrivateMessage']

  /**
   * 绑定员工关系。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.bindEmployeeRelation` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  bindEmployeeRelation: WeapiCrossPlatformAdapter['bindEmployeeRelation']

  /**
   * 检测是否可添加安全元素卡片。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.canAddSecureElementPass` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  canAddSecureElementPass: WeapiCrossPlatformAdapter['canAddSecureElementPass']
}
