import type { WeapiCrossPlatformAdapter } from '../../types'

export interface WeapiCrossPlatformMethodDocsShowToastToOpenAppAuthorizeSettingShowToastToCreateRewardedVideoAd {
  /**
   * 显示消息提示框。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showToast.html
   *
   * 说明：
   * - 适合展示轻量反馈，例如保存成功、操作失败、表单校验提示等。
   * - 通常应避免把它当成阻塞交互使用，复杂确认流程更适合 `showModal`。
   * - 如果你需要统一业务提示风格，可以在应用层再包一层 `toastSuccess/toastError`。
   *
   * 示例：
   * ```ts
   * await wpi.showToast({
   *   title: '保存成功',
   *   icon: 'success',
   * })
   * ```
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showToast` | ✅ |
   * | 支付宝 | `title/icon` 映射到 `content/type` 后调用 `my.showToast` | ✅ |
   * | 抖音 | `icon=error` 映射为 `fail` 后调用 `tt.showToast` | ✅ |
   */
  showToast: WeapiCrossPlatformAdapter['showToast']

  /**
   * 显示 loading 提示框。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showLoading.html
   *
   * 说明：
   * - 适合在请求提交、初始化加载、资源预取等耗时操作期间给用户持续反馈。
   * - 一般应与 `hideLoading` 成对使用，避免页面切换后残留 loading 状态。
   *
   * 示例：
   * ```ts
   * await wpi.showLoading({
   *   title: '提交中',
   * })
   *
   * try {
   *   await submitForm()
   * }
   * finally {
   *   wx.hideLoading()
   * }
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showLoading` | ✅ |
   * | 支付宝 | `title` 映射到 `content` 后调用 `my.showLoading` | ✅ |
   * | 抖音 | 直连 `tt.showLoading` | ✅ |
   */
  showLoading: WeapiCrossPlatformAdapter['showLoading']

  /**
   * 显示操作菜单。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showActionSheet.html
   *
   * 说明：
   * - 适合展示一组平级操作，例如“拍照 / 从相册选择 / 删除”。
   * - 返回结果通常通过点击索引区分具体动作，业务侧最好自行映射为明确语义。
   *
   * 示例：
   * ```ts
   * const result = await wpi.showActionSheet({
   *   itemList: ['拍照', '从相册选择'],
   * })
   *
   * if (result.tapIndex === 0) {
   *   await openCamera()
   * }
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showActionSheet` | ✅ |
   * | 支付宝 | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐 | ✅ |
   * | 抖音 | 直连 `tt.showActionSheet`；缺失时按 unsupported 报错 | ✅ |
   */
  showActionSheet: WeapiCrossPlatformAdapter['showActionSheet']

  /**
   * 显示模态弹窗。
   *
   * 分类：界面
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showModal.html
   *
   * 说明：
   * - 用于展示确认/取消类交互，也可承载输入框等补充信息收集场景。
   * - Promise 风格下可直接 `await` 结果，再根据 `confirm/cancel` 分支处理后续逻辑。
   * - 支付宝侧会映射到 `my.confirm`，因此 `showCancel=false`、`editable` 等微信特性并非所有平台都能等价工作。
   *
   * 示例：
   * ```ts
   * const result = await wpi.showModal({
   *   title: '删除确认',
   *   content: '删除后不可恢复，是否继续？',
   *   confirmText: '删除',
   *   cancelText: '取消',
   * })
   *
   * if (result.confirm) {
   *   await removeItem()
   * }
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.showModal` | ⚠️ |
   * | 支付宝 | 调用 `my.confirm` 并对齐按钮字段与 `cancel/content`；`showCancel=false`、`editable` 等场景按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.showModal` | ⚠️ |
   */
  showModal: WeapiCrossPlatformAdapter['showModal']

  /**
   * 选择图片。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.chooseImage.html
   *
   * 说明：
   * - 常用于头像上传、表单附件、发帖配图等场景。
   * - 可通过 `count`、`sizeType`、`sourceType` 约束用户选择数量、原图/压缩图和来源。
   * - 返回值通常可直接交给 `uploadFile` 或页面预览组件使用。
   *
   * 示例：
   * ```ts
   * const result = await wpi.chooseImage({
   *   count: 3,
   *   sizeType: ['compressed'],
   *   sourceType: ['album', 'camera'],
   * })
   *
   * const [firstFile] = result.tempFilePaths
   * if (firstFile) {
   *   previewImage(firstFile)
   * }
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseImage` | ✅ |
   * | 支付宝 | 返回值 `apFilePaths` 映射到 `tempFilePaths` | ✅ |
   * | 抖音 | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底 | ✅ |
   */
  chooseImage: WeapiCrossPlatformAdapter['chooseImage']

  /**
   * 选择图片或视频。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.html
   *
   * 说明：
   * - 适合发帖、动态发布、素材上传等同时接受图片和视频的场景。
   * - 当业务需要统一接收媒体资源时，它通常比 `chooseImage` / `chooseVideo` 分开调用更省判断逻辑。
   *
   * 示例：
   * ```ts
   * const result = await wpi.chooseMedia({
   *   count: 1,
   *   mediaType: ['image', 'video'],
   *   sourceType: ['album', 'camera'],
   * })
   *
   * console.log(result.tempFiles)
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseMedia` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType` | ⚠️ |
   */
  chooseMedia: WeapiCrossPlatformAdapter['chooseMedia']

  /**
   * 选择会话文件。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.chooseMessageFile.html
   *
   * 说明：
   * - 适合聊天附件、工单上传、提交文档或导入本地文件等场景。
   * - 当业务不只接收图片时，它通常比 `chooseImage` 更合适，因为可以限制文件类型和数量。
   *
   * 示例：
   * ```ts
   * const result = await wpi.chooseMessageFile({
   *   count: 1,
   *   type: 'file',
   * })
   *
   * console.log(result.tempFiles)
   * ```
   *
   * 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.chooseMessageFile` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  chooseMessageFile: WeapiCrossPlatformAdapter['chooseMessageFile']

  /**
   * 获取模糊地理位置。
   *
   * 分类：位置
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getFuzzyLocation.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.getFuzzyLocation` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  getFuzzyLocation: WeapiCrossPlatformAdapter['getFuzzyLocation']

  /**
   * 预览图片和视频。
   *
   * 分类：媒体
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.previewMedia.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.previewMedia` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   */
  previewMedia: WeapiCrossPlatformAdapter['previewMedia']

  /**
   * 创建插屏广告实例。
   *
   * 分类：广告
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createInterstitialAd` | ⚠️ |
   * | 支付宝 | 无同等 API，调用时按 unsupported 报错 | ⚠️ |
   * | 抖音 | 直连 `tt.createInterstitialAd` | ⚠️ |
   */
  createInterstitialAd: WeapiCrossPlatformAdapter['createInterstitialAd']

  /**
   * 创建激励视频广告实例。
   *
   * 分类：广告
   * 文档链接：https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.html
   *
   * 说明：
   * - 这里保留微信命名与参数、返回类型。
   * - 支持度与跨平台对齐策略见下表。
   *
   * | 平台 | 对齐策略 | 支持度 |
   * | --- | --- | --- |
   * | 微信 | 直连 `wx.createRewardedVideoAd` | ⚠️ |
   * | 支付宝 | 映射到 `my.createRewardedAd`，并将 `load/show/destroy` 参数对齐为微信调用方式 | ⚠️ |
   * | 抖音 | 直连 `tt.createRewardedVideoAd` | ⚠️ |
   */
  createRewardedVideoAd: WeapiCrossPlatformAdapter['createRewardedVideoAd']
}
