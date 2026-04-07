import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsMissingMethodsGetBackgroundAudioManagerToGetMenuButtonBoundingClientRect {
  /**
   * 对应微信小程序 `wx.getBackgroundAudioManager` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBackgroundAudioManager')` 与 `wpi.supports('getBackgroundAudioManager')` 判断。
   */
  getBackgroundAudioManager: WeapiCrossPlatformAdapter['getBackgroundAudioManager']

  /**
   * 对应微信小程序 `wx.getBackgroundFetchData` 的 API。
   *
   * 分类：存储
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/storage/background-fetch/wx.getBackgroundFetchData.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBackgroundFetchData')` 与 `wpi.supports('getBackgroundFetchData')` 判断。
   */
  getBackgroundFetchData: WeapiCrossPlatformAdapter['getBackgroundFetchData']

  /**
   * 对应微信小程序 `wx.getBeacons` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.getBeacons.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBeacons')` 与 `wpi.supports('getBeacons')` 判断。
   */
  getBeacons: WeapiCrossPlatformAdapter['getBeacons']

  /**
   * 对应微信小程序 `wx.getBluetoothAdapterState` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.getBluetoothAdapterState.html
   *
   * 说明：
   * - 用于读取当前蓝牙模块是否可用、是否已发现设备等状态信息。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getBluetoothAdapterState()
   *
   * console.log(result.available, result.discovering)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBluetoothAdapterState')` 与 `wpi.supports('getBluetoothAdapterState')` 判断。
   */
  getBluetoothAdapterState: WeapiCrossPlatformAdapter['getBluetoothAdapterState']

  /**
   * 对应微信小程序 `wx.getBluetoothDevices` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.getBluetoothDevices.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getBluetoothDevices')` 与 `wpi.supports('getBluetoothDevices')` 判断。
   */
  getBluetoothDevices: WeapiCrossPlatformAdapter['getBluetoothDevices']

  /**
   * 对应微信小程序 `wx.getConnectedBluetoothDevices` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.getConnectedBluetoothDevices.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getConnectedBluetoothDevices')` 与 `wpi.supports('getConnectedBluetoothDevices')` 判断。
   */
  getConnectedBluetoothDevices: WeapiCrossPlatformAdapter['getConnectedBluetoothDevices']

  /**
   * 对应微信小程序 `wx.getConnectedWifi` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.getConnectedWifi.html
   *
   * 说明：
   * - 用于读取当前已连接的 Wi-Fi 信息，适合配网成功校验、网络诊断或设备绑定流程确认。
   * - 可配合 `connectWifi`、`getNetworkType` 一起使用，判断当前是否已经进入目标局域网。
   * - 实际可返回字段和权限要求受宿主环境影响，使用前应做好失败分支处理。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getConnectedWifi()
   *
   * console.log(result.wifi?.SSID)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getConnectedWifi')` 与 `wpi.supports('getConnectedWifi')` 判断。
   */
  getConnectedWifi: WeapiCrossPlatformAdapter['getConnectedWifi']

  /**
   * 对应微信小程序 `wx.getExptInfoSync` 的 API。
   *
   * 分类：data-analysis
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.getExptInfoSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getExptInfoSync')` 与 `wpi.supports('getExptInfoSync')` 判断。
   */
  getExptInfoSync: WeapiCrossPlatformAdapter['getExptInfoSync']

  /**
   * 对应微信小程序 `wx.getExtConfig` 的 API。
   *
   * 分类：ext
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ext/wx.getExtConfig.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getExtConfig')` 与 `wpi.supports('getExtConfig')` 判断。
   */
  getExtConfig: WeapiCrossPlatformAdapter['getExtConfig']

  /**
   * 对应微信小程序 `wx.getExtConfigSync` 的 API。
   *
   * 分类：ext
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ext/wx.getExtConfigSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getExtConfigSync')` 与 `wpi.supports('getExtConfigSync')` 判断。
   */
  getExtConfigSync: WeapiCrossPlatformAdapter['getExtConfigSync']

  /**
   * 对应微信小程序 `wx.getFileSystemManager` 的 API。
   *
   * 分类：文件
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.html
   *
   * 说明：
   * - 用于获取文件系统管理器实例，后续可调用 `readFile`、`writeFile`、`access`、`unlink` 等方法处理本地文件。
   * - 常见于下载结果持久化、缓存目录清理、读取配置文件、图片或音频二进制处理等场景。
   * - 文件 API 通常依赖宿主沙箱目录规则，写入前应确认目标路径与权限约束。
   *
   * 示例：
   * ```ts
   * const fs = wpi.getFileSystemManager()
   *
   * fs.readFile({
   *   filePath: `${wx.env.USER_DATA_PATH}/config.json`,
   *   encoding: 'utf8',
   *   success(res) {
   *     console.log(res.data)
   *   },
   * })
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getFileSystemManager')` 与 `wpi.supports('getFileSystemManager')` 判断。
   */
  getFileSystemManager: WeapiCrossPlatformAdapter['getFileSystemManager']

  /**
   * 对应微信小程序 `wx.getImageInfo` 的 API。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.getImageInfo.html
   *
   * 说明：
   * - 用于读取图片宽高、类型、方向等信息，适合在上传、裁剪、绘制前先做校验。
   * - 远程图片通常需要是合法可访问地址，且可能受下载权限、域名白名单或宿主实现影响。
   * - 当业务依赖尺寸或方向纠正时，建议先获取元信息再决定压缩、裁剪或画布绘制策略。
   *
   * 示例：
   * ```ts
   * const info = await wpi.getImageInfo({
   *   src: imageUrl,
   * })
   *
   * console.log(info.width, info.height, info.type)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getImageInfo')` 与 `wpi.supports('getImageInfo')` 判断。
   */
  getImageInfo: WeapiCrossPlatformAdapter['getImageInfo']

  /**
   * 对应微信小程序 `wx.getLaunchOptionsSync` 的 API。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getLaunchOptionsSync')` 与 `wpi.supports('getLaunchOptionsSync')` 判断。
   */
  getLaunchOptionsSync: WeapiCrossPlatformAdapter['getLaunchOptionsSync']

  /**
   * 对应微信小程序 `wx.getLocalIPAddress` 的 API。
   *
   * 分类：设备
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.getLocalIPAddress.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getLocalIPAddress')` 与 `wpi.supports('getLocalIPAddress')` 判断。
   */
  getLocalIPAddress: WeapiCrossPlatformAdapter['getLocalIPAddress']

  /**
   * 对应微信小程序 `wx.getLocation` 的 API。
   *
   * 分类：位置
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getLocation.html
   *
   * 说明：
   * - 用于获取当前经纬度、速度、精度等定位信息。
   * - 调用前通常需要确认定位授权状态，并根据业务选择 `wgs84` 或 `gcj02` 坐标系。
   * - 定位能力受用户授权、系统开关和宿主环境影响，调用失败时应准备好兜底分支。
   *
   * 示例：
   * ```ts
   * const location = await wpi.getLocation({
   *   type: 'gcj02',
   *   isHighAccuracy: true,
   * })
   *
   * console.log(location.latitude, location.longitude)
   * ```
   *
   * 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getLocation')` 与 `wpi.supports('getLocation')` 判断。
   */
  getLocation: WeapiCrossPlatformAdapter['getLocation']

  /**
   * 对应微信小程序 `wx.getMenuButtonBoundingClientRect` 的 API。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/menu/wx.getMenuButtonBoundingClientRect.html
   *
   * 说明：
   * - 用于获取右上角胶囊按钮的尺寸与位置信息，常用于自定义导航栏对齐和安全区计算。
   * - 适合把标题、返回按钮、搜索入口等元素与胶囊按钮做视觉对齐，减少不同机型偏移。
   * - 返回值依赖当前宿主 UI，实现差异较大时建议结合 `getWindowInfo` 或系统信息一起兜底。
   *
   * 示例：
   * ```ts
   * const rect = wpi.getMenuButtonBoundingClientRect()
   *
   * console.log(rect.top, rect.height, rect.right)
   * ```
   *
   * - 运行时跨平台映射、降级或不支持情况，可结合 `wpi.resolveTarget('getMenuButtonBoundingClientRect')` 与 `wpi.supports('getMenuButtonBoundingClientRect')` 判断。
   */
  getMenuButtonBoundingClientRect: WeapiCrossPlatformAdapter['getMenuButtonBoundingClientRect']
}
