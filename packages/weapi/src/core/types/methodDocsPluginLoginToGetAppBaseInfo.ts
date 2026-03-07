export interface WeapiCrossPlatformMethodDocsPluginLoginToGetAppBaseInfo {
  /**
   * 插件登录。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.pluginLogin` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  pluginLogin: WeapiCrossPlatformAdapter['pluginLogin']

  /**
   * 登录。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.login` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.login` | ⚠️ |
   */
  login: WeapiCrossPlatformAdapter['login']

  /**
   * 提前向用户发起授权请求。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.authorize` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.authorize` | ⚠️ |
   */
  authorize: WeapiCrossPlatformAdapter['authorize']

  /**
   * 检查登录态是否过期。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.checkSession` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.checkSession` | ⚠️ |
   */
  checkSession: WeapiCrossPlatformAdapter['checkSession']

  /**
   * 请求订阅设备消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestSubscribeDeviceMessage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestSubscribeDeviceMessage: WeapiCrossPlatformAdapter['requestSubscribeDeviceMessage']

  /**
   * 请求订阅员工消息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestSubscribeEmployeeMessage` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestSubscribeEmployeeMessage: WeapiCrossPlatformAdapter['requestSubscribeEmployeeMessage']

  /**
   * 重启小程序。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.restartMiniProgram` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  restartMiniProgram: WeapiCrossPlatformAdapter['restartMiniProgram']

  /**
   * 扫码。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.scanCode` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.scanCode` | ⚠️ |
   */
  scanCode: WeapiCrossPlatformAdapter['scanCode']

  /**
   * 发起支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestPayment: WeapiCrossPlatformAdapter['requestPayment']

  /**
   * 发起订单支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestOrderPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestOrderPayment: WeapiCrossPlatformAdapter['requestOrderPayment']

  /**
   * 发起插件支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestPluginPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestPluginPayment: WeapiCrossPlatformAdapter['requestPluginPayment']

  /**
   * 发起虚拟支付。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestVirtualPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestVirtualPayment: WeapiCrossPlatformAdapter['requestVirtualPayment']

  /**
   * 显示分享图片菜单。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showShareImageMenu` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  showShareImageMenu: WeapiCrossPlatformAdapter['showShareImageMenu']

  /**
   * 更新分享菜单配置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.updateShareMenu` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  updateShareMenu: WeapiCrossPlatformAdapter['updateShareMenu']

  /**
   * 打开嵌入式小程序。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.openEmbeddedMiniProgram` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  openEmbeddedMiniProgram: WeapiCrossPlatformAdapter['openEmbeddedMiniProgram']

  /**
   * 保存文件到磁盘。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.saveFileToDisk` | ⚠️ |
   * | 支付宝 | 直连 `my.saveFileToDisk` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  saveFileToDisk: WeapiCrossPlatformAdapter['saveFileToDisk']

  /**
   * 获取启动参数（同步）。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getEnterOptionsSync` | ⚠️ |
   * | 支付宝 | 直连 `my.getEnterOptionsSync` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getEnterOptionsSync: WeapiCrossPlatformAdapter['getEnterOptionsSync']

  /**
   * 获取系统设置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getSystemSetting` | ⚠️ |
   * | 支付宝 | 直连 `my.getSystemSetting` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getSystemSetting: WeapiCrossPlatformAdapter['getSystemSetting']

  /**
   * 获取用户资料。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getUserProfile` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.getUserProfile` | ⚠️ |
   */
  getUserProfile: WeapiCrossPlatformAdapter['getUserProfile']

  /**
   * 获取用户信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getUserInfo` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.getUserInfo` | ⚠️ |
   */
  getUserInfo: WeapiCrossPlatformAdapter['getUserInfo']

  /**
   * 获取 App 授权设置。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getAppAuthorizeSetting` | ⚠️ |
   * | 支付宝 | 直连 `my.getAppAuthorizeSetting` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getAppAuthorizeSetting: WeapiCrossPlatformAdapter['getAppAuthorizeSetting']

  /**
   * 获取 App 基础信息。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getAppBaseInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getAppBaseInfo` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getAppBaseInfo: WeapiCrossPlatformAdapter['getAppBaseInfo']
}
