import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsGetRecorderManagerToHideShareMenu {
  /**
   * 对应微信小程序 `wx.getRecorderManager` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getRecorderManager')` 与 `wpi.supports('getRecorderManager')` 判断。
   */
  getRecorderManager: WeapiCrossPlatformAdapter['getRecorderManager']

  /**
   * 对应微信小程序 `wx.getScreenBrightness` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.getScreenBrightness.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getScreenBrightness')` 与 `wpi.supports('getScreenBrightness')` 判断。
   */
  getScreenBrightness: WeapiCrossPlatformAdapter['getScreenBrightness']

  /**
   * 对应微信小程序 `wx.getSetting` 的 API。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.getSetting.html
   *
   * 说明：
   * - 用于读取用户当前的授权状态，常见于定位、相册、录音等敏感能力前置检查。
   * - 它只负责读取，不会主动拉起授权弹窗。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getSetting()
   *
   * console.log(result.authSetting?.['scope.userLocation'])
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getSetting')` 与 `wpi.supports('getSetting')` 判断。
   */
  getSetting: WeapiCrossPlatformAdapter['getSetting']

  /**
   * 对应微信小程序 `wx.getSkylineInfoSync` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSkylineInfoSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getSkylineInfoSync')` 与 `wpi.supports('getSkylineInfoSync')` 判断。
   */
  getSkylineInfoSync: WeapiCrossPlatformAdapter['getSkylineInfoSync']

  /**
   * 对应微信小程序 `wx.getStorage` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorage.html
   *
   * 说明：
   * - 用于异步读取本地缓存，适合读取登录态、草稿、用户偏好等轻量数据。
   * - 如果你已经在业务里统一采用 Promise 风格，`await` 读取会比回调写法更容易串联逻辑。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getStorage({
   *   key: 'token',
   * })
   *
   * console.log(result.data)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getStorage')` 与 `wpi.supports('getStorage')` 判断。
   */
  getStorage: WeapiCrossPlatformAdapter['getStorage']

  /**
   * 对应微信小程序 `wx.getStorageInfo` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageInfo.html
   *
   * 说明：
   * - 用于查看当前缓存空间的 key 列表、已用空间等信息，适合做缓存诊断和清理策略。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getStorageInfo()
   *
   * console.log(result.keys, result.currentSize)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getStorageInfo')` 与 `wpi.supports('getStorageInfo')` 判断。
   */
  getStorageInfo: WeapiCrossPlatformAdapter['getStorageInfo']

  /**
   * 对应微信小程序 `wx.getStorageInfoSync` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageInfoSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getStorageInfoSync')` 与 `wpi.supports('getStorageInfoSync')` 判断。
   */
  getStorageInfoSync: WeapiCrossPlatformAdapter['getStorageInfoSync']

  /**
   * 对应微信小程序 `wx.getStorageSync` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getStorageSync')` 与 `wpi.supports('getStorageSync')` 判断。
   */
  getStorageSync: WeapiCrossPlatformAdapter['getStorageSync']

  /**
   * 对应微信小程序 `wx.getSystemInfo` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfo.html
   *
   * 说明：
   * - 用于获取设备、系统、窗口、语言等综合环境信息。
   * - 常见于设备适配、埋点上报、兼容性分支和诊断信息采集。
   *
   * 示例：
   * ```ts
   * const info = await wpi.getSystemInfo()
   *
   * console.log(info.platform, info.model, info.system)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getSystemInfo')` 与 `wpi.supports('getSystemInfo')` 判断。
   */
  getSystemInfo: WeapiCrossPlatformAdapter['getSystemInfo']

  /**
   * 对应微信小程序 `wx.getSystemInfoSync` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getSystemInfoSync')` 与 `wpi.supports('getSystemInfoSync')` 判断。
   */
  getSystemInfoSync: WeapiCrossPlatformAdapter['getSystemInfoSync']

  /**
   * 对应微信小程序 `wx.getUpdateManager` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getUpdateManager')` 与 `wpi.supports('getUpdateManager')` 判断。
   */
  getUpdateManager: WeapiCrossPlatformAdapter['getUpdateManager']

  /**
   * 对应微信小程序 `wx.getWifiList` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.getWifiList.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getWifiList')` 与 `wpi.supports('getWifiList')` 判断。
   */
  getWifiList: WeapiCrossPlatformAdapter['getWifiList']

  /**
   * 对应微信小程序 `wx.hideKeyboard` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.hideKeyboard.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('hideKeyboard')` 与 `wpi.supports('hideKeyboard')` 判断。
   */
  hideKeyboard: WeapiCrossPlatformAdapter['hideKeyboard']

  /**
   * 对应微信小程序 `wx.hideLoading` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.hideLoading.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('hideLoading')` 与 `wpi.supports('hideLoading')` 判断。
   */
  hideLoading: WeapiCrossPlatformAdapter['hideLoading']

  /**
   * 对应微信小程序 `wx.hideNavigationBarLoading` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.hideNavigationBarLoading.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('hideNavigationBarLoading')` 与 `wpi.supports('hideNavigationBarLoading')` 判断。
   */
  hideNavigationBarLoading: WeapiCrossPlatformAdapter['hideNavigationBarLoading']

  /**
   * 对应微信小程序 `wx.hideShareMenu` 的 API。
   *
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.hideShareMenu.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('hideShareMenu')` 与 `wpi.supports('hideShareMenu')` 判断。
   */
  hideShareMenu: WeapiCrossPlatformAdapter['hideShareMenu']
}
