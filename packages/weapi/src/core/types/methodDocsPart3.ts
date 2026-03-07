export interface WeapiCrossPlatformMethodDocsPart3 {
  /**
   * 选择视频。
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
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getLogManager` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getLogManager: WeapiCrossPlatformAdapter['getLogManager']

  /**
   * 延迟到下一个 UI 更新时机执行回调。
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
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openDocument` | ⚠️ |
   * | 支付宝 | 直连 `my.openDocument` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openDocument: WeapiCrossPlatformAdapter['openDocument']
}
