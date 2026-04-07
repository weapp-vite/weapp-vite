import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsPluginLoginToGetAppBaseInfoRequestVirtualPaymentToGetAppBaseInfo {
  /**
   * 发起虚拟支付。
   *
   * 分类：payment
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.showShareImageMenu.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：转发
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.updateShareMenu.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：navigate
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.openEmbeddedMiniProgram.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：文件
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/file/wx.saveFileToDisk.html
   *
   * 说明：
   * - 用于把临时文件或已保存文件交给系统落盘，适合导出图片、下载附件、生成 PDF 后让用户保存到设备。
   * - 该能力通常会触发系统级保存交互，实际可见路径、用户确认流程和权限表现由宿主决定。
   * - 发起前建议确认文件类型、文件名和来源路径，避免用户保存到无意义或无法识别的文件。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.saveFileToDisk` | ⚠️ |
   * | 支付宝 | 直连 `my.saveFileToDisk` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   *
   * 示例：
   * ```ts
   * await wpi.saveFileToDisk({
   *   filePath,
   * })
   * ```
   */
  saveFileToDisk: WeapiCrossPlatformAdapter['saveFileToDisk']

  /**
   * 获取启动参数（同步）。
   *
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getEnterOptionsSync.html
   *
   * 说明：
   * - 用于同步读取当前进入小程序时的场景值、路径、查询参数与来源信息。
   * - 适合在应用初始化早期决定落地页、渠道归因、分享还原或扫码分支逻辑。
   * - 这是“本次进入”的快照信息，业务若依赖后续页面跳转参数，仍应结合路由状态单独处理。
   *
   * 示例：
   * ```ts
   * const enterOptions = wpi.getEnterOptionsSync()
   *
   * console.log(enterOptions.scene, enterOptions.path, enterOptions.query)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemSetting.html
   *
   * 说明：
   * - 用于读取蓝牙、定位、Wi-Fi 等系统开关状态，适合在发起设备能力前做环境预判。
   * - 这类信息通常反映“系统层是否开启”，不等同于应用层是否已经取得权限授权。
   * - 业务上可把它和 `getAppAuthorizeSetting` 组合使用，分别判断系统开关与授权状态。
   *
   * 示例：
   * ```ts
   * const systemSetting = wpi.getSystemSetting()
   *
   * console.log(systemSetting.bluetoothEnabled, systemSetting.locationEnabled)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html
   *
   * 说明：
   * - 用于在明确用户触发下拉起授权弹窗，获取头像、昵称等用户资料。
   * - 该能力通常要求“用户主动触发”，不适合在页面加载或静默流程中直接调用。
   * - 用户资料只适合作为展示或个性化初始化信息，涉及身份体系时仍应以后端鉴权结果为准。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getUserProfile({
   *   desc: '用于完善个人资料',
   * })
   *
   * console.log(result.userInfo.nickName)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：开放接口
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserInfo.html
   *
   * 说明：
   * - 用于读取用户信息结果，是否可成功获取受宿主策略、授权状态与平台能力影响。
   * - 与 `getUserProfile` 相比，这个接口在不同平台上的可用性和推荐程度差异更大，跨端项目应优先评估兼容策略。
   * - 业务上建议把它视为补充能力，而不是唯一的用户身份来源。
   *
   * 示例：
   * ```ts
   * const result = await wpi.getUserInfo({
   *   withCredentials: true,
   * })
   *
   * console.log(result.userInfo)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getAppAuthorizeSetting.html
   *
   * 说明：
   * - 用于读取相册、定位、通知等系统级授权状态，适合在真正发起能力调用前先做预判。
   * - 常见于进入拍照、选址、保存到相册等功能前，决定是直接执行还是先引导用户授权。
   * - 返回值更适合作为权限前置判断，不建议替代失败分支处理，因为用户状态可能在运行期变化。
   *
   * 示例：
   * ```ts
   * const setting = wpi.getAppAuthorizeSetting()
   *
   * console.log(setting.albumAuthorized, setting.locationAuthorized)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
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
   * 分类：基础
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getAppBaseInfo.html
   *
   * 说明：
   * - 用于获取当前宿主环境、主题、语言、版本等基础运行信息，适合日志上报和条件分支判断。
   * - 常见于初始化阶段记录运行上下文，或根据主题、宿主版本决定 UI 与兼容策略。
   * - 这类信息通常偏环境元数据，不建议直接作为业务安全判断的唯一依据。
   *
   * 示例：
   * ```ts
   * const info = wpi.getAppBaseInfo()
   *
   * console.log(info.language, info.theme, info.version)
   * ```
   *
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getAppBaseInfo` | ⚠️ |
   * | 支付宝 | 直连 `my.getAppBaseInfo` | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getAppBaseInfo: WeapiCrossPlatformAdapter['getAppBaseInfo']
}
