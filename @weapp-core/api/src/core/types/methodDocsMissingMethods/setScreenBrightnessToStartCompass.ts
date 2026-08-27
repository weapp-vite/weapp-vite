import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsSetScreenBrightnessToStartCompass {
  /**
   * 对应微信小程序 `wx.setScreenBrightness` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.setScreenBrightness.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setScreenBrightness')` 与 `wpi.supports('setScreenBrightness')` 判断。
   */
  setScreenBrightness: WeapiCrossPlatformAdapter['setScreenBrightness']

  /**
   * 对应微信小程序 `wx.setStorage` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorage.html
   *
   * 说明：
   * - 用于异步写入本地缓存，适合持久化 token、页面草稿、最近访问记录等轻量数据。
   * - 建议业务侧统一约定 key 命名，避免多个页面散落硬编码字符串。
   *
   * 示例：
   * ```ts
   * await wpi.setStorage({
   *   key: 'draft.profile',
   *   data: {
   *     nickname: 'wevu',
   *   },
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setStorage')` 与 `wpi.supports('setStorage')` 判断。
   */
  setStorage: WeapiCrossPlatformAdapter['setStorage']

  /**
   * 对应微信小程序 `wx.setStorageSync` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setStorageSync')` 与 `wpi.supports('setStorageSync')` 判断。
   */
  setStorageSync: WeapiCrossPlatformAdapter['setStorageSync']

  /**
   * 对应微信小程序 `wx.setTabBarBadge` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarBadge.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setTabBarBadge')` 与 `wpi.supports('setTabBarBadge')` 判断。
   */
  setTabBarBadge: WeapiCrossPlatformAdapter['setTabBarBadge']

  /**
   * 对应微信小程序 `wx.setTabBarItem` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarItem.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setTabBarItem')` 与 `wpi.supports('setTabBarItem')` 判断。
   */
  setTabBarItem: WeapiCrossPlatformAdapter['setTabBarItem']

  /**
   * 对应微信小程序 `wx.setTabBarStyle` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarStyle.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setTabBarStyle')` 与 `wpi.supports('setTabBarStyle')` 判断。
   */
  setTabBarStyle: WeapiCrossPlatformAdapter['setTabBarStyle']

  /**
   * 对应微信小程序 `wx.setVisualEffectOnCapture` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.setVisualEffectOnCapture.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setVisualEffectOnCapture')` 与 `wpi.supports('setVisualEffectOnCapture')` 判断。
   */
  setVisualEffectOnCapture: WeapiCrossPlatformAdapter['setVisualEffectOnCapture']

  /**
   * 对应微信小程序 `wx.setWifiList` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.setWifiList.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setWifiList')` 与 `wpi.supports('setWifiList')` 判断。
   */
  setWifiList: WeapiCrossPlatformAdapter['setWifiList']

  /**
   * 对应微信小程序 `wx.showNavigationBarLoading` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.showNavigationBarLoading.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('showNavigationBarLoading')` 与 `wpi.supports('showNavigationBarLoading')` 判断。
   */
  showNavigationBarLoading: WeapiCrossPlatformAdapter['showNavigationBarLoading']

  /**
   * 对应微信小程序 `wx.showShareMenu` 的 API。
   *
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.showShareMenu.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('showShareMenu')` 与 `wpi.supports('showShareMenu')` 判断。
   */
  showShareMenu: WeapiCrossPlatformAdapter['showShareMenu']

  /**
   * 对应微信小程序 `wx.showTabBar` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.showTabBar.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('showTabBar')` 与 `wpi.supports('showTabBar')` 判断。
   */
  showTabBar: WeapiCrossPlatformAdapter['showTabBar']

  /**
   * 对应微信小程序 `wx.showTabBarRedDot` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.showTabBarRedDot.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('showTabBarRedDot')` 与 `wpi.supports('showTabBarRedDot')` 判断。
   */
  showTabBarRedDot: WeapiCrossPlatformAdapter['showTabBarRedDot']

  /**
   * 对应微信小程序 `wx.startAccelerometer` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.startAccelerometer.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('startAccelerometer')` 与 `wpi.supports('startAccelerometer')` 判断。
   */
  startAccelerometer: WeapiCrossPlatformAdapter['startAccelerometer']

  /**
   * 对应微信小程序 `wx.startBeaconDiscovery` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.startBeaconDiscovery.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('startBeaconDiscovery')` 与 `wpi.supports('startBeaconDiscovery')` 判断。
   */
  startBeaconDiscovery: WeapiCrossPlatformAdapter['startBeaconDiscovery']

  /**
   * 对应微信小程序 `wx.startBluetoothDevicesDiscovery` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.startBluetoothDevicesDiscovery.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('startBluetoothDevicesDiscovery')` 与 `wpi.supports('startBluetoothDevicesDiscovery')` 判断。
   */
  startBluetoothDevicesDiscovery: WeapiCrossPlatformAdapter['startBluetoothDevicesDiscovery']

  /**
   * 对应微信小程序 `wx.startCompass` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/compass/wx.startCompass.html
   *
   * 说明：
   * - 用于开始监听罗盘数据，适合指南针、地图朝向、方向感知类交互。
   *
   * 示例：
   * ```ts
   * await wpi.startCompass()
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('startCompass')` 与 `wpi.supports('startCompass')` 判断。
   */
  startCompass: WeapiCrossPlatformAdapter['startCompass']
}
