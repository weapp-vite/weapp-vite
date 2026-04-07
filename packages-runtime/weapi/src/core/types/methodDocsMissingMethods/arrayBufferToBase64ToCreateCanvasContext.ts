import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsArrayBufferToBase64ToCreateCanvasContext {
  /**
   * 对应微信小程序 `wx.arrayBufferToBase64` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.arrayBufferToBase64.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('arrayBufferToBase64')` 与 `wpi.supports('arrayBufferToBase64')` 判断。
   */
  arrayBufferToBase64: WeapiCrossPlatformAdapter['arrayBufferToBase64']

  /**
   * 对应微信小程序 `wx.base64ToArrayBuffer` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.base64ToArrayBuffer.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('base64ToArrayBuffer')` 与 `wpi.supports('base64ToArrayBuffer')` 判断。
   */
  base64ToArrayBuffer: WeapiCrossPlatformAdapter['base64ToArrayBuffer']

  /**
   * 对应微信小程序 `wx.canIUse` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.canIUse.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('canIUse')` 与 `wpi.supports('canIUse')` 判断。
   */
  canIUse: WeapiCrossPlatformAdapter['canIUse']

  /**
   * 对应微信小程序 `wx.canvasToTempFilePath` 的 API。
   *
   * 分类：画布
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasToTempFilePath.html
   *
   * 说明：
   * - 用于把当前画布内容导出为临时文件，常见于海报生成、签名板导出、分享图片落盘等场景。
   * - 通常应在绘制完成并执行 `draw` 回调后调用，否则可能拿到空白图或不完整内容。
   * - 导出尺寸、裁剪区域和目标画布实例需要与当前页面上下文保持一致。
   *
   * 示例：
   * ```ts
   * const result = await wpi.canvasToTempFilePath({
   *   canvasId: 'poster',
   *   destWidth: 750,
   *   destHeight: 1200,
   * })
   *
   * console.log(result.tempFilePath)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('canvasToTempFilePath')` 与 `wpi.supports('canvasToTempFilePath')` 判断。
   */
  canvasToTempFilePath: WeapiCrossPlatformAdapter['canvasToTempFilePath']

  /**
   * 对应微信小程序 `wx.chooseContact` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/contact/wx.chooseContact.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('chooseContact')` 与 `wpi.supports('chooseContact')` 判断。
   */
  chooseContact: WeapiCrossPlatformAdapter['chooseContact']

  /**
   * 对应微信小程序 `wx.chooseInvoice` 的 API。
   *
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/invoice/wx.chooseInvoice.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('chooseInvoice')` 与 `wpi.supports('chooseInvoice')` 判断。
   */
  chooseInvoice: WeapiCrossPlatformAdapter['chooseInvoice']

  /**
   * 对应微信小程序 `wx.chooseLocation` 的 API。
   *
   * 分类：位置
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.chooseLocation.html
   *
   * 说明：
   * - 用于打开地图选点界面，让用户自行选择位置并返回名称、地址与经纬度。
   * - 适合收货地址补点、门店定位、活动报名地点、打卡选址等需要人工确认位置的场景。
   * - 调用前通常需要定位授权或地图能力支持，失败时应提供手动输入地址的备选方案。
   *
   * 示例：
   * ```ts
   * const location = await wpi.chooseLocation()
   *
   * console.log(location.name, location.address)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('chooseLocation')` 与 `wpi.supports('chooseLocation')` 判断。
   */
  chooseLocation: WeapiCrossPlatformAdapter['chooseLocation']

  /**
   * 对应微信小程序 `wx.clearStorage` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.clearStorage.html
   *
   * 说明：
   * - 用于清空当前小程序的本地缓存，适合退出登录、重置环境或清理异常缓存时使用。
   *
   * 示例：
   * ```ts
   * await wpi.clearStorage()
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('clearStorage')` 与 `wpi.supports('clearStorage')` 判断。
   */
  clearStorage: WeapiCrossPlatformAdapter['clearStorage']

  /**
   * 对应微信小程序 `wx.clearStorageSync` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.clearStorageSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('clearStorageSync')` 与 `wpi.supports('clearStorageSync')` 判断。
   */
  clearStorageSync: WeapiCrossPlatformAdapter['clearStorageSync']

  /**
   * 对应微信小程序 `wx.closeBluetoothAdapter` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.closeBluetoothAdapter.html
   *
   * 说明：
   * - 用于关闭蓝牙模块，通常在蓝牙业务结束、页面退出或重置连接状态时调用。
   *
   * 示例：
   * ```ts
   * await wpi.closeBluetoothAdapter()
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('closeBluetoothAdapter')` 与 `wpi.supports('closeBluetoothAdapter')` 判断。
   */
  closeBluetoothAdapter: WeapiCrossPlatformAdapter['closeBluetoothAdapter']

  /**
   * 对应微信小程序 `wx.closeSocket` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.closeSocket.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('closeSocket')` 与 `wpi.supports('closeSocket')` 判断。
   */
  closeSocket: WeapiCrossPlatformAdapter['closeSocket']

  /**
   * 对应微信小程序 `wx.compressImage` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.compressImage.html
   *
   * 说明：
   * - 适合在上传前压缩图片，减少网络体积和上传耗时。
   * - 常见于头像、发帖配图、报修图片、表单附件等图片上传前置流程。
   *
   * 示例：
   * ```ts
   * const result = await wpi.compressImage({
   *   src: tempFilePath,
   *   quality: 80,
   * })
   *
   * console.log(result.tempFilePath)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('compressImage')` 与 `wpi.supports('compressImage')` 判断。
   */
  compressImage: WeapiCrossPlatformAdapter['compressImage']

  /**
   * 对应微信小程序 `wx.connectSocket` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html
   *
   * 说明：
   * - 用于建立 WebSocket 长连接，适合 IM、实时推送、协同编辑、行情订阅等场景。
   * - 建连后通常需要再配合 `onSocketOpen`、`onSocketMessage`、`sendSocketMessage` 等 API 一起使用。
   *
   * 示例：
   * ```ts
   * await wpi.connectSocket({
   *   url: 'wss://example.com/socket',
   * })
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('connectSocket')` 与 `wpi.supports('connectSocket')` 判断。
   */
  connectSocket: WeapiCrossPlatformAdapter['connectSocket']

  /**
   * 对应微信小程序 `wx.connectWifi` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.connectWifi.html
   *
   * 说明：
   * - 用于发起 Wi-Fi 连接，常见于硬件配网、设备联网初始化、现场网络接入等流程。
   * - 一般要先调用 `startWifi` 并结合系统权限与定位权限状态再执行连接。
   * - 连接结果受系统版本、网络安全策略和宿主限制影响，业务上应准备失败重试与手动引导。
   *
   * 示例：
   * ```ts
   * await wpi.connectWifi({
   *   SSID: 'demo-network',
   *   password: '12345678',
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('connectWifi')` 与 `wpi.supports('connectWifi')` 判断。
   */
  connectWifi: WeapiCrossPlatformAdapter['connectWifi']

  /**
   * 对应微信小程序 `wx.createAnimation` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createAnimation')` 与 `wpi.supports('createAnimation')` 判断。
   */
  createAnimation: WeapiCrossPlatformAdapter['createAnimation']

  /**
   * 对应微信小程序 `wx.createCanvasContext` 的 API。
   *
   * 分类：画布
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html
   *
   * 说明：
   * - 用于创建旧版 Canvas 2D 绘图上下文，后续可调用 `setFillStyle`、`drawImage`、`fillText`、`draw` 等方法。
   * - 一般用于小程序海报、图表、截屏辅助绘制等需要在页面层完成绘制的场景。
   * - 画布 ID 必须与页面中的 `<canvas canvas-id=\"...\">` 对应，组件内调用时还需要传入组件实例。
   *
   * 示例：
   * ```ts
   * const ctx = wpi.createCanvasContext('poster')
   *
   * ctx.setFillStyle('#111')
   * ctx.fillRect(0, 0, 300, 150)
   * ctx.draw()
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createCanvasContext')` 与 `wpi.supports('createCanvasContext')` 判断。
   */
  createCanvasContext: WeapiCrossPlatformAdapter['createCanvasContext']
}
