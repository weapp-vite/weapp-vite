import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsPageScrollToToSetNavigationBarTitle {
  /**
   * 对应微信小程序 `wx.pageScrollTo` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/scroll/wx.pageScrollTo.html
   *
   * 说明：
   * - 用于控制页面滚动位置，适合“返回顶部”“跳转到锚点内容”等交互。
   *
   * 示例：
   * ```ts
   * await wpi.pageScrollTo({
   *   scrollTop: 0,
   *   duration: 300,
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('pageScrollTo')` 与 `wpi.supports('pageScrollTo')` 判断。
   */
  pageScrollTo: WeapiCrossPlatformAdapter['pageScrollTo']

  /**
   * 对应微信小程序 `wx.previewImage` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.previewImage.html
   *
   * 说明：
   * - 用于预览单张或多张图片，适合商品图、相册、凭证明细等场景。
   * - 一般会把当前图片 URL 作为 `current`，其余可预览图片列表作为 `urls` 传入。
   *
   * 示例：
   * ```ts
   * await wpi.previewImage({
   *   current: imageList[0],
   *   urls: imageList,
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('previewImage')` 与 `wpi.supports('previewImage')` 判断。
   */
  previewImage: WeapiCrossPlatformAdapter['previewImage']

  /**
   * 关闭所有页面，打开到应用内的某个页面。
   *
   * 对应微信文档：`wx.reLaunch(Object object)`
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.reLaunch.html
   *
   * 说明：
   * - 会清空当前页面栈后重新进入目标页。
   * - 可用于登录态重置、首页重建等场景。
   * - 如果目标页是 tabBar 页面，通常优先考虑 `switchTab`。
   *
   * 示例：
   * ```ts
   * await wpi.reLaunch({
   *   url: '/pages/home/index',
   * })
   * ```
   */
  reLaunch: WeapiCrossPlatformAdapter['reLaunch']

  /**
   * 对应微信小程序 `wx.readBLECharacteristicValue` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.readBLECharacteristicValue.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('readBLECharacteristicValue')` 与 `wpi.supports('readBLECharacteristicValue')` 判断。
   */
  readBLECharacteristicValue: WeapiCrossPlatformAdapter['readBLECharacteristicValue']

  /**
   * 关闭当前页面，跳转到应用内的某个非 tabBar 页面。
   *
   * 对应微信文档：`wx.redirectTo(Object object)`
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.redirectTo.html
   *
   * 说明：
   * - 关闭当前页面并跳转到新页面。
   * - 不能跳转到 tabBar 页面。
   * - 适合不希望用户返回当前页的流程页。
   *
   * 示例：
   * ```ts
   * await wpi.redirectTo({
   *   url: '/pages/login/index',
   * })
   * ```
   */
  redirectTo: WeapiCrossPlatformAdapter['redirectTo']

  /**
   * 对应微信小程序 `wx.removeStorage` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.removeStorage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('removeStorage')` 与 `wpi.supports('removeStorage')` 判断。
   */
  removeStorage: WeapiCrossPlatformAdapter['removeStorage']

  /**
   * 对应微信小程序 `wx.removeStorageSync` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.removeStorageSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('removeStorageSync')` 与 `wpi.supports('removeStorageSync')` 判断。
   */
  removeStorageSync: WeapiCrossPlatformAdapter['removeStorageSync']

  /**
   * 对应微信小程序 `wx.removeTabBarBadge` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.removeTabBarBadge.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('removeTabBarBadge')` 与 `wpi.supports('removeTabBarBadge')` 判断。
   */
  removeTabBarBadge: WeapiCrossPlatformAdapter['removeTabBarBadge']

  /**
   * 对应微信小程序 `wx.request` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/request/RequestTask.html
   *
   * 说明：
   * - 这是小程序里最常用的网络请求入口，适合调用业务后端、BFF 或网关接口。
   * - `@wevu/api` 默认提供 Promise 风格封装，能直接用 `await` 获取响应结果。
   * - 涉及超时、并发控制或平台差异时，可结合实例级网络策略与 `resolveTarget/supports` 一起判断。
   *
   * 示例：
   * ```ts
   * const result = await wpi.request({
   *   url: 'https://example.com/api/todos',
   *   method: 'GET',
   *   data: {
   *     page: 1,
   *   },
   * })
   *
   * console.log(result.statusCode, result.data)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('request')` 与 `wpi.supports('request')` 判断。
   */
  request: WeapiCrossPlatformAdapter['request']

  /**
   * 对应微信小程序 `wx.requestSubscribeMessage` 的 API。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('requestSubscribeMessage')` 与 `wpi.supports('requestSubscribeMessage')` 判断。
   */
  requestSubscribeMessage: WeapiCrossPlatformAdapter['requestSubscribeMessage']

  /**
   * 对应微信小程序 `wx.saveImageToPhotosAlbum` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.saveImageToPhotosAlbum.html
   *
   * 说明：
   * - 用于把临时图片或本地图片保存到系统相册，常见于海报下载、分享卡片保存等场景。
   * - 调用前通常需要确认用户是否授予了相册写入权限。
   *
   * 示例：
   * ```ts
   * await wpi.saveImageToPhotosAlbum({
   *   filePath: posterTempFilePath,
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('saveImageToPhotosAlbum')` 与 `wpi.supports('saveImageToPhotosAlbum')` 判断。
   */
  saveImageToPhotosAlbum: WeapiCrossPlatformAdapter['saveImageToPhotosAlbum']

  /**
   * 对应微信小程序 `wx.sendSocketMessage` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.sendSocketMessage.html
   *
   * 说明：
   * - 用于通过已建立的 WebSocket 连接向服务端发送消息。
   * - 通常需要在连接已打开后发送，并由业务侧统一约定消息格式。
   *
   * 示例：
   * ```ts
   * await wpi.sendSocketMessage({
   *   data: JSON.stringify({
   *     type: 'ping',
   *   }),
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('sendSocketMessage')` 与 `wpi.supports('sendSocketMessage')` 判断。
   */
  sendSocketMessage: WeapiCrossPlatformAdapter['sendSocketMessage']

  /**
   * 对应微信小程序 `wx.setBLEMTU` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.setBLEMTU.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setBLEMTU')` 与 `wpi.supports('setBLEMTU')` 判断。
   */
  setBLEMTU: WeapiCrossPlatformAdapter['setBLEMTU']

  /**
   * 对应微信小程序 `wx.setKeepScreenOn` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.setKeepScreenOn.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setKeepScreenOn')` 与 `wpi.supports('setKeepScreenOn')` 判断。
   */
  setKeepScreenOn: WeapiCrossPlatformAdapter['setKeepScreenOn']

  /**
   * 对应微信小程序 `wx.setNavigationBarColor` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarColor.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setNavigationBarColor')` 与 `wpi.supports('setNavigationBarColor')` 判断。
   */
  setNavigationBarColor: WeapiCrossPlatformAdapter['setNavigationBarColor']

  /**
   * 对应微信小程序 `wx.setNavigationBarTitle` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarTitle.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('setNavigationBarTitle')` 与 `wpi.supports('setNavigationBarTitle')` 判断。
   */
  setNavigationBarTitle: WeapiCrossPlatformAdapter['setNavigationBarTitle']
}
