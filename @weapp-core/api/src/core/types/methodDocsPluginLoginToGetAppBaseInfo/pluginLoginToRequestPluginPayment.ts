import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsPluginLoginToGetAppBaseInfoPluginLoginToRequestPluginPayment {
  /**
   * 插件登录。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.pluginLogin.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html
   *
   * 说明：
   * - 用于换取临时登录凭证，常见于后端登录、用户态初始化、鉴权态恢复等流程。
   * - 一般会把返回的 `code` 交给业务服务端，再换取会话信息或自定义 token。
   * - 登录成功不代表长期会话一定有效，通常仍需结合 `checkSession` 或业务 token 机制一起使用。
   *
   * 示例：
   * ```ts
   * const result = await wpi.login()
   *
   * await wpi.request({
   *   url: 'https://example.com/api/login',
   *   method: 'POST',
   *   data: {
   *     code: result.code,
   *   },
   * })
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/authorize/wx.authorize.html
   *
   * 说明：
   * - 用于在真正调用敏感能力前预先请求指定权限，常见于定位、录音等授权场景。
   * - 授权是否成功取决于宿主环境、用户选择以及该权限是否支持主动申请。
   *
   * 示例：
   * ```ts
   * await wpi.authorize({
   *   scope: 'scope.userLocation',
   * })
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html
   *
   * 说明：
   * - 用于判断当前登录态是否仍然有效，常见于应用冷启动或页面恢复时的快速校验。
   * - 如果校验失败，业务侧通常会重新执行 `login` 或走完整登录流程。
   *
   * 示例：
   * ```ts
   * try {
   *   await wpi.checkSession()
   * }
   * catch {
   *   await refreshLoginState()
   * }
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeDeviceMessage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/employee-relation/wx.requestSubscribeEmployeeMessage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：navigate
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.restartMiniProgram.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/scan/wx.scanCode.html
   *
   * 说明：
   * - 适合扫码登录、取件码、设备配网、活动核销等场景。
   * - 建议业务侧对扫码结果做协议或前缀校验，避免把任意文本直接当成有效业务数据。
   *
   * 示例：
   * ```ts
   * const result = await wpi.scanCode({
   *   onlyFromCamera: true,
   *   scanType: ['qrCode', 'barCode'],
   * })
   *
   * console.log(result.result)
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
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
   * 分类：payment
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPayment.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：payment
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestOrderPayment.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：payment
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPluginPayment.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.requestPluginPayment` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  requestPluginPayment: WeapiCrossPlatformAdapter['requestPluginPayment']
}
