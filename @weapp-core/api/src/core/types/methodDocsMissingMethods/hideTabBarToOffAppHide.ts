import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsHideTabBarToOffAppHide {
  /**
   * 对应微信小程序 `wx.hideTabBar` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.hideTabBar.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('hideTabBar')` 与 `wpi.supports('hideTabBar')` 判断。
   */
  hideTabBar: WeapiCrossPlatformAdapter['hideTabBar']

  /**
   * 对应微信小程序 `wx.hideTabBarRedDot` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.hideTabBarRedDot.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('hideTabBarRedDot')` 与 `wpi.supports('hideTabBarRedDot')` 判断。
   */
  hideTabBarRedDot: WeapiCrossPlatformAdapter['hideTabBarRedDot']

  /**
   * 对应微信小程序 `wx.hideToast` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.hideToast.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('hideToast')` 与 `wpi.supports('hideToast')` 判断。
   */
  hideToast: WeapiCrossPlatformAdapter['hideToast']

  /**
   * 对应微信小程序 `wx.loadFontFace` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('loadFontFace')` 与 `wpi.supports('loadFontFace')` 判断。
   */
  loadFontFace: WeapiCrossPlatformAdapter['loadFontFace']

  /**
   * 对应微信小程序 `wx.makeBluetoothPair` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.makeBluetoothPair.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('makeBluetoothPair')` 与 `wpi.supports('makeBluetoothPair')` 判断。
   */
  makeBluetoothPair: WeapiCrossPlatformAdapter['makeBluetoothPair']

  /**
   * 对应微信小程序 `wx.makePhoneCall` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/phone/wx.makePhoneCall.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('makePhoneCall')` 与 `wpi.supports('makePhoneCall')` 判断。
   */
  makePhoneCall: WeapiCrossPlatformAdapter['makePhoneCall']

  /**
   * 关闭当前页面，返回上一页面或多级页面。
   *
   * 对应微信文档：`wx.navigateBack(Object object)`
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateBack.html
   *
   * 说明：
   * - 默认返回上一页。
   * - 可通过 `delta` 指定返回层级。
   * - 当页面栈不足时，会尽量返回到栈底页面。
   *
   * 示例：
   * ```ts
   * await wpi.navigateBack({
   *   delta: 1,
   * })
   * ```
   */
  navigateBack: WeapiCrossPlatformAdapter['navigateBack']

  /**
   * 对应微信小程序 `wx.navigateBackMiniProgram` 的 API。
   *
   * 分类：navigate
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.navigateBackMiniProgram.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('navigateBackMiniProgram')` 与 `wpi.supports('navigateBackMiniProgram')` 判断。
   */
  navigateBackMiniProgram: WeapiCrossPlatformAdapter['navigateBackMiniProgram']

  /**
   * 保留当前页面，跳转到应用内的某个非 tabBar 页面。
   *
   * 对应微信文档：`wx.navigateTo(Object object)`
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateTo.html
   *
   * 在插件中使用：需要基础库 2.2.2，且只能在当前插件的页面中调用。
   *
   * 说明：
   * - 保留当前页面，跳转到应用内的某个页面。
   * - 不能跳转到 tabBar 页面。
   * - 可使用 `wx.navigateBack` 返回到原页面。
   * - 小程序页面栈最多十层。
   *
   * 示例：
   * ```ts
   * await wpi.navigateTo({
   *   url: '/pages/layouts/index',
   * })
   * ```
   *
   * 事件通道示例：
   * ```ts
   * wx.navigateTo({
   *   url: 'test?id=1',
   *   events: {
   *     acceptDataFromOpenedPage(data) {
   *       console.log(data)
   *     },
   *     someEvent(data) {
   *       console.log(data)
   *     },
   *   },
   *   success(res) {
   *     res.eventChannel.emit('acceptDataFromOpenerPage', { data: 'test' })
   *   },
   * })
   *
   * Page({
   *   onLoad(option) {
   *     console.log(option.query)
   *     const eventChannel = this.getOpenerEventChannel()
   *     eventChannel.emit('acceptDataFromOpenedPage', { data: 'test' })
   *     eventChannel.emit('someEvent', { data: 'test' })
   *     eventChannel.on('acceptDataFromOpenerPage', (data) => {
   *       console.log(data)
   *     })
   *   },
   * })
   * ```
   */
  navigateTo: WeapiCrossPlatformAdapter['navigateTo']

  /**
   * 对应微信小程序 `wx.navigateToMiniProgram` 的 API。
   *
   * 分类：navigate
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.navigateToMiniProgram.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('navigateToMiniProgram')` 与 `wpi.supports('navigateToMiniProgram')` 判断。
   */
  navigateToMiniProgram: WeapiCrossPlatformAdapter['navigateToMiniProgram']

  /**
   * 对应微信小程序 `wx.notifyBLECharacteristicValueChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.notifyBLECharacteristicValueChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('notifyBLECharacteristicValueChange')` 与 `wpi.supports('notifyBLECharacteristicValueChange')` 判断。
   */
  notifyBLECharacteristicValueChange: WeapiCrossPlatformAdapter['notifyBLECharacteristicValueChange']

  /**
   * 对应微信小程序 `wx.offAccelerometerChange` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.offAccelerometerChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAccelerometerChange')` 与 `wpi.supports('offAccelerometerChange')` 判断。
   */
  offAccelerometerChange: WeapiCrossPlatformAdapter['offAccelerometerChange']

  /**
   * 对应微信小程序 `wx.offAfterPageLoad` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.offAfterPageLoad.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAfterPageLoad')` 与 `wpi.supports('offAfterPageLoad')` 判断。
   */
  offAfterPageLoad: WeapiCrossPlatformAdapter['offAfterPageLoad']

  /**
   * 对应微信小程序 `wx.offAfterPageUnload` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-route/wx.offAfterPageUnload.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAfterPageUnload')` 与 `wpi.supports('offAfterPageUnload')` 判断。
   */
  offAfterPageUnload: WeapiCrossPlatformAdapter['offAfterPageUnload']

  /**
   * 对应微信小程序 `wx.offApiCategoryChange` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.offApiCategoryChange.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offApiCategoryChange')` 与 `wpi.supports('offApiCategoryChange')` 判断。
   */
  offApiCategoryChange: WeapiCrossPlatformAdapter['offApiCategoryChange']

  /**
   * 对应微信小程序 `wx.offAppHide` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAppHide.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('offAppHide')` 与 `wpi.supports('offAppHide')` 判断。
   */
  offAppHide: WeapiCrossPlatformAdapter['offAppHide']
}
