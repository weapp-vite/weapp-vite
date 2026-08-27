import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsCreateInnerAudioContextToGetBLEMTU {
  /**
   * 对应微信小程序 `wx.createInnerAudioContext` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.html
   *
   * 说明：
   * - 用于创建独立音频播放实例，适合背景音、提示音、课程试听、语音消息播放等场景。
   * - 通过上下文对象可以控制播放、暂停、停止、进度监听与资源释放，适合页面级音频管理。
   * - 使用完成后建议主动调用实例的销毁方法，避免页面切换后残留播放状态或资源占用。
   *
   * 示例：
   * ```ts
   * const audio = wpi.createInnerAudioContext()
   *
   * audio.src = audioUrl
   * audio.autoplay = true
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createInnerAudioContext')` 与 `wpi.supports('createInnerAudioContext')` 判断。
   */
  createInnerAudioContext: WeapiCrossPlatformAdapter['createInnerAudioContext']

  /**
   * 对应微信小程序 `wx.createIntersectionObserver` 的 API。
   *
   * 分类：wxml
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createIntersectionObserver')` 与 `wpi.supports('createIntersectionObserver')` 判断。
   */
  createIntersectionObserver: WeapiCrossPlatformAdapter['createIntersectionObserver']

  /**
   * 对应微信小程序 `wx.createMapContext` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createMapContext')` 与 `wpi.supports('createMapContext')` 判断。
   */
  createMapContext: WeapiCrossPlatformAdapter['createMapContext']

  /**
   * 对应微信小程序 `wx.createOffscreenCanvas` 的 API。
   *
   * 分类：画布
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/canvas/OffscreenCanvas.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createOffscreenCanvas')` 与 `wpi.supports('createOffscreenCanvas')` 判断。
   */
  createOffscreenCanvas: WeapiCrossPlatformAdapter['createOffscreenCanvas']

  /**
   * 对应微信小程序 `wx.createSelectorQuery` 的 API。
   *
   * 分类：wxml
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html
   *
   * 说明：
   * - 用于查询节点尺寸、位置、滚动信息等布局数据，适合吸顶、懒加载、定位动画、画布对齐等场景。
   * - 通常要在节点完成渲染后调用，否则可能拿到空结果或过期布局信息。
   * - 组件内部使用时应结合组件实例上下文，避免跨作用域查询失败。
   *
   * 示例：
   * ```ts
   * wpi.createSelectorQuery()
   *   .select('#poster')
   *   .boundingClientRect((rect) => {
   *     console.log(rect)
   *   })
   *   .exec()
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createSelectorQuery')` 与 `wpi.supports('createSelectorQuery')` 判断。
   */
  createSelectorQuery: WeapiCrossPlatformAdapter['createSelectorQuery']

  /**
   * 对应微信小程序 `wx.createVideoContext` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.html
   *
   * 说明：
   * - 用于获取页面中 `<video>` 组件的控制上下文，可执行播放、暂停、跳转进度、全屏等操作。
   * - 适合自定义视频控制条、试看逻辑、课程播放页、广告视频交互等场景。
   * - 传入的组件 ID 必须与页面节点一致，组件内调用时还应传入组件实例。
   *
   * 示例：
   * ```ts
   * const video = wpi.createVideoContext('player')
   *
   * video.play()
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createVideoContext')` 与 `wpi.supports('createVideoContext')` 判断。
   */
  createVideoContext: WeapiCrossPlatformAdapter['createVideoContext']

  /**
   * 对应微信小程序 `wx.createWorker` 的 API。
   *
   * 分类：Worker
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('createWorker')` 与 `wpi.supports('createWorker')` 判断。
   */
  createWorker: WeapiCrossPlatformAdapter['createWorker']

  /**
   * 对应微信小程序 `wx.disableAlertBeforeUnload` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.disableAlertBeforeUnload.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('disableAlertBeforeUnload')` 与 `wpi.supports('disableAlertBeforeUnload')` 判断。
   */
  disableAlertBeforeUnload: WeapiCrossPlatformAdapter['disableAlertBeforeUnload']

  /**
   * 对应微信小程序 `wx.downloadFile` 的 API。
   *
   * 分类：网络
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/network/download/DownloadTask.html
   *
   * 说明：
   * - 用于把远程资源下载到本地临时文件，常见于图片、音频、压缩包或离线资源缓存。
   * - 成功后通常会拿到临时文件路径，可继续配合 `saveFile`、预览或上传逻辑使用。
   * - 如果你需要监听进度、暂停或取消，仍可基于底层任务对象能力扩展处理。
   *
   * 示例：
   * ```ts
   * const result = await wpi.downloadFile({
   *   url: 'https://example.com/static/poster.png',
   * })
   *
   * console.log(result.tempFilePath)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('downloadFile')` 与 `wpi.supports('downloadFile')` 判断。
   */
  downloadFile: WeapiCrossPlatformAdapter['downloadFile']

  /**
   * 对应微信小程序 `wx.enableAlertBeforeUnload` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.enableAlertBeforeUnload.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('enableAlertBeforeUnload')` 与 `wpi.supports('enableAlertBeforeUnload')` 判断。
   */
  enableAlertBeforeUnload: WeapiCrossPlatformAdapter['enableAlertBeforeUnload']

  /**
   * 对应微信小程序 `wx.exitMiniProgram` 的 API。
   *
   * 分类：navigate
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.exitMiniProgram.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('exitMiniProgram')` 与 `wpi.supports('exitMiniProgram')` 判断。
   */
  exitMiniProgram: WeapiCrossPlatformAdapter['exitMiniProgram']

  /**
   * 对应微信小程序 `wx.getAvailableAudioSources` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.getAvailableAudioSources.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getAvailableAudioSources')` 与 `wpi.supports('getAvailableAudioSources')` 判断。
   */
  getAvailableAudioSources: WeapiCrossPlatformAdapter['getAvailableAudioSources']

  /**
   * 对应微信小程序 `wx.getBLEDeviceCharacteristics` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEDeviceCharacteristics.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBLEDeviceCharacteristics')` 与 `wpi.supports('getBLEDeviceCharacteristics')` 判断。
   */
  getBLEDeviceCharacteristics: WeapiCrossPlatformAdapter['getBLEDeviceCharacteristics']

  /**
   * 对应微信小程序 `wx.getBLEDeviceRSSI` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEDeviceRSSI.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBLEDeviceRSSI')` 与 `wpi.supports('getBLEDeviceRSSI')` 判断。
   */
  getBLEDeviceRSSI: WeapiCrossPlatformAdapter['getBLEDeviceRSSI']

  /**
   * 对应微信小程序 `wx.getBLEDeviceServices` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEDeviceServices.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBLEDeviceServices')` 与 `wpi.supports('getBLEDeviceServices')` 判断。
   */
  getBLEDeviceServices: WeapiCrossPlatformAdapter['getBLEDeviceServices']

  /**
   * 对应微信小程序 `wx.getBLEMTU` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEMTU.html
   *
   * 说明：
   * - 用于获取当前 BLE 连接协商后的 MTU 大小，适合大包分片发送、蓝牙吞吐调优等场景。
   * - 当业务需要发送较长二进制数据时，通常要先读取 MTU，再按实际上限拆包写入。
   * - MTU 结果依赖设备型号、系统版本与连接状态，调用前应确保蓝牙已经完成连接。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getBLEMTU({
   *   deviceId,
   * })
   *
   * console.log(result.mtu)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBLEMTU')` 与 `wpi.supports('getBLEMTU')` 判断。
   */
  getBLEMTU: WeapiCrossPlatformAdapter['getBLEMTU']
}
