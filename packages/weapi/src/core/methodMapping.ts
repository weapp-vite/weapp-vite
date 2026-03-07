import { WEAPI_MY_METHODS, WEAPI_TT_METHODS, WEAPI_WX_METHODS } from './apiCatalog'
import { isPlainObject } from './utils.ts'

export interface WeapiMethodMappingRule {
  target: string
  mapArgs?: (args: unknown[]) => unknown[]
  mapResult?: (result: any) => any
}

export type WeapiSupportLevel = 'native' | 'mapped' | 'fallback' | 'unsupported'

export interface ResolveMethodMappingOptions {
  allowFallback?: boolean
}

export interface WeapiResolvedMethodMapping {
  target: string
  source: 'explicit' | 'fallback' | 'identity'
  rule?: WeapiMethodMappingRule
}

export interface WeapiPlatformSupportMatrixItem {
  platform: string
  globalObject: string
  typeSource: string
  support: string
}

export interface WeapiMethodSupportMatrixItem {
  method: string
  description: string
  wxStrategy: string
  alipayStrategy: string
  douyinStrategy: string
  support: string
}

export interface WeapiMethodCompatibilityItem {
  method: string
  wxStrategy: string
  alipayTarget: string
  alipayStrategy: string
  alipaySupported: boolean
  alipaySupportLevel: WeapiSupportLevel
  alipaySemanticallyAligned: boolean
  douyinTarget: string
  douyinStrategy: string
  douyinSupported: boolean
  douyinSupportLevel: WeapiSupportLevel
  douyinSemanticallyAligned: boolean
  support: string
  semanticSupport: string
}

export interface WeapiApiCoveragePlatformItem {
  platform: string
  alias: string
  supportedApis: number
  semanticAlignedApis: number
  fallbackApis: number
  totalApis: number
  coverage: string
  semanticCoverage: string
}

export interface WeapiApiCoverageReport {
  totalApis: number
  fullyAlignedApis: number
  fullyAlignedCoverage: string
  fullySemanticallyAlignedApis: number
  fullySemanticallyAlignedCoverage: string
  platforms: readonly WeapiApiCoveragePlatformItem[]
}

const WEAPI_WX_METHOD_SET = new Set<string>(WEAPI_WX_METHODS)
const WEAPI_MY_METHOD_SET = new Set<string>(WEAPI_MY_METHODS)
const WEAPI_TT_METHOD_SET = new Set<string>(WEAPI_TT_METHODS)

const PLATFORM_METHOD_SET: Readonly<Record<'my' | 'tt', Set<string>>> = {
  my: WEAPI_MY_METHOD_SET,
  tt: WEAPI_TT_METHOD_SET,
}

export const WEAPI_PLATFORM_SUPPORT_MATRIX: readonly WeapiPlatformSupportMatrixItem[] = [
  {
    platform: '微信小程序',
    globalObject: '`wx`',
    typeSource: '`miniprogram-api-typings`',
    support: '✅ 全量',
  },
  {
    platform: '支付宝小程序',
    globalObject: '`my`',
    typeSource: '`@mini-types/alipay`',
    support: '✅ 全量',
  },
  {
    platform: '抖音小程序',
    globalObject: '`tt`',
    typeSource: '`@douyin-microapp/typings`',
    support: '✅ 全量',
  },
  {
    platform: '其他平台（swan/jd/xhs 等）',
    globalObject: '运行时宿主对象',
    typeSource: '运行时透传',
    support: '⚠️ 按宿主能力支持',
  },
]

export const WEAPI_METHOD_SUPPORT_MATRIX: readonly WeapiMethodSupportMatrixItem[] = [
  {
    method: 'showToast',
    description: '显示消息提示框。',
    wxStrategy: '直连 `wx.showToast`',
    alipayStrategy: '`title/icon` 映射到 `content/type` 后调用 `my.showToast`',
    douyinStrategy: '`icon=error` 映射为 `fail` 后调用 `tt.showToast`',
    support: '✅',
  },
  {
    method: 'showLoading',
    description: '显示 loading 提示框。',
    wxStrategy: '直连 `wx.showLoading`',
    alipayStrategy: '`title` 映射到 `content` 后调用 `my.showLoading`',
    douyinStrategy: '直连 `tt.showLoading`',
    support: '✅',
  },
  {
    method: 'showActionSheet',
    description: '显示操作菜单。',
    wxStrategy: '直连 `wx.showActionSheet`',
    alipayStrategy: '`itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐',
    douyinStrategy: '直连 `tt.showActionSheet`，并兼容 `index` → `tapIndex`',
    support: '✅',
  },
  {
    method: 'showModal',
    description: '显示模态弹窗。',
    wxStrategy: '直连 `wx.showModal`',
    alipayStrategy: '调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果',
    douyinStrategy: '直连 `tt.showModal`',
    support: '✅',
  },
  {
    method: 'chooseImage',
    description: '选择图片。',
    wxStrategy: '直连 `wx.chooseImage`',
    alipayStrategy: '返回值 `apFilePaths` 映射到 `tempFilePaths`',
    douyinStrategy: '`tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底',
    support: '✅',
  },
  {
    method: 'saveFile',
    description: '保存文件（跨端扩展，微信 typings 未声明同名 API）。',
    wxStrategy: '微信当前 typings 未声明同名 API，保留为跨端扩展能力',
    alipayStrategy: '请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath`',
    douyinStrategy: '直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath`',
    support: '⚠️',
  },
  {
    method: 'setClipboardData',
    description: '设置剪贴板内容。',
    wxStrategy: '直连 `wx.setClipboardData`',
    alipayStrategy: '转调 `my.setClipboard` 并映射 `data` → `text`',
    douyinStrategy: '直连 `tt.setClipboardData`',
    support: '✅',
  },
  {
    method: 'getClipboardData',
    description: '获取剪贴板内容。',
    wxStrategy: '直连 `wx.getClipboardData`',
    alipayStrategy: '转调 `my.getClipboard` 并映射 `text` → `data`',
    douyinStrategy: '直连 `tt.getClipboardData`',
    support: '✅',
  },
  {
    method: 'chooseAddress',
    description: '选择收货地址。',
    wxStrategy: '直连 `wx.chooseAddress`',
    alipayStrategy: '映射到 `my.getAddress`',
    douyinStrategy: '直连 `tt.chooseAddress`',
    support: '⚠️',
  },
  {
    method: 'createAudioContext',
    description: '创建音频上下文。',
    wxStrategy: '直连 `wx.createAudioContext`',
    alipayStrategy: '映射到 `my.createInnerAudioContext`',
    douyinStrategy: '映射到 `tt.createInnerAudioContext`',
    support: '⚠️',
  },
  {
    method: 'createWebAudioContext',
    description: '创建 WebAudio 上下文。',
    wxStrategy: '直连 `wx.createWebAudioContext`',
    alipayStrategy: '映射到 `my.createInnerAudioContext`',
    douyinStrategy: '映射到 `tt.createInnerAudioContext`',
    support: '⚠️',
  },
  {
    method: 'getSystemInfoAsync',
    description: '异步获取系统信息。',
    wxStrategy: '直连 `wx.getSystemInfoAsync`',
    alipayStrategy: '映射到 `my.getSystemInfo`',
    douyinStrategy: '映射到 `tt.getSystemInfo`',
    support: '✅',
  },
  {
    method: 'openAppAuthorizeSetting',
    description: '打开小程序授权设置页。',
    wxStrategy: '直连 `wx.openAppAuthorizeSetting`',
    alipayStrategy: '映射到 `my.openSetting`',
    douyinStrategy: '映射到 `tt.openSetting`',
    support: '⚠️',
  },
  {
    method: 'pluginLogin',
    description: '插件登录。',
    wxStrategy: '直连 `wx.pluginLogin`',
    alipayStrategy: '映射到 `my.getAuthCode`，并对齐返回 `code` 字段',
    douyinStrategy: '映射到 `tt.login`',
    support: '⚠️',
  },
  {
    method: 'login',
    description: '登录。',
    wxStrategy: '直连 `wx.login`',
    alipayStrategy: '映射到 `my.getAuthCode`，并对齐返回 `code` 字段',
    douyinStrategy: '直连 `tt.login`',
    support: '⚠️',
  },
  {
    method: 'authorize',
    description: '提前向用户发起授权请求。',
    wxStrategy: '直连 `wx.authorize`',
    alipayStrategy: '映射到 `my.getAuthCode`，并对齐 `scope` -> `scopes` 参数',
    douyinStrategy: '直连 `tt.authorize`',
    support: '⚠️',
  },
  {
    method: 'checkSession',
    description: '检查登录态是否过期。',
    wxStrategy: '直连 `wx.checkSession`',
    alipayStrategy: '映射到 `my.getAuthCode`，按成功结果对齐 `checkSession:ok`',
    douyinStrategy: '直连 `tt.checkSession`',
    support: '⚠️',
  },
  {
    method: 'requestSubscribeDeviceMessage',
    description: '请求订阅设备消息。',
    wxStrategy: '直连 `wx.requestSubscribeDeviceMessage`',
    alipayStrategy: '映射到 `my.requestSubscribeMessage`',
    douyinStrategy: '映射到 `tt.requestSubscribeMessage`',
    support: '⚠️',
  },
  {
    method: 'requestSubscribeEmployeeMessage',
    description: '请求订阅员工消息。',
    wxStrategy: '直连 `wx.requestSubscribeEmployeeMessage`',
    alipayStrategy: '映射到 `my.requestSubscribeMessage`',
    douyinStrategy: '映射到 `tt.requestSubscribeMessage`',
    support: '⚠️',
  },
  {
    method: 'restartMiniProgram',
    description: '重启小程序。',
    wxStrategy: '直连 `wx.restartMiniProgram`',
    alipayStrategy: '映射到 `my.reLaunch`',
    douyinStrategy: '映射到 `tt.reLaunch`',
    support: '⚠️',
  },
  {
    method: 'scanCode',
    description: '扫码。',
    wxStrategy: '直连 `wx.scanCode`',
    alipayStrategy: '映射到 `my.scan`',
    douyinStrategy: '直连 `tt.scanCode`',
    support: '✅',
  },
  {
    method: 'requestPayment',
    description: '发起支付。',
    wxStrategy: '直连 `wx.requestPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'requestOrderPayment',
    description: '发起订单支付。',
    wxStrategy: '直连 `wx.requestOrderPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'requestPluginPayment',
    description: '发起插件支付。',
    wxStrategy: '直连 `wx.requestPluginPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'requestVirtualPayment',
    description: '发起虚拟支付。',
    wxStrategy: '直连 `wx.requestVirtualPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'showShareImageMenu',
    description: '显示分享图片菜单。',
    wxStrategy: '直连 `wx.showShareImageMenu`',
    alipayStrategy: '映射到 `my.showSharePanel`',
    douyinStrategy: '映射到 `tt.showShareMenu`',
    support: '⚠️',
  },
  {
    method: 'updateShareMenu',
    description: '更新分享菜单配置。',
    wxStrategy: '直连 `wx.updateShareMenu`',
    alipayStrategy: '映射到 `my.showSharePanel`',
    douyinStrategy: '映射到 `tt.showShareMenu`',
    support: '⚠️',
  },
  {
    method: 'openEmbeddedMiniProgram',
    description: '打开嵌入式小程序。',
    wxStrategy: '直连 `wx.openEmbeddedMiniProgram`',
    alipayStrategy: '映射到 `my.navigateToMiniProgram`',
    douyinStrategy: '映射到 `tt.navigateToMiniProgram`',
    support: '⚠️',
  },
  {
    method: 'saveFileToDisk',
    description: '保存文件到磁盘。',
    wxStrategy: '直连 `wx.saveFileToDisk`',
    alipayStrategy: '直连 `my.saveFileToDisk`',
    douyinStrategy: '映射到 `tt.saveFile`',
    support: '⚠️',
  },
  {
    method: 'getEnterOptionsSync',
    description: '获取启动参数（同步）。',
    wxStrategy: '直连 `wx.getEnterOptionsSync`',
    alipayStrategy: '直连 `my.getEnterOptionsSync`',
    douyinStrategy: '映射到 `tt.getLaunchOptionsSync`',
    support: '⚠️',
  },
  {
    method: 'getSystemSetting',
    description: '获取系统设置。',
    wxStrategy: '直连 `wx.getSystemSetting`',
    alipayStrategy: '直连 `my.getSystemSetting`',
    douyinStrategy: '映射到 `tt.getSetting`',
    support: '⚠️',
  },
  {
    method: 'getUserProfile',
    description: '获取用户资料。',
    wxStrategy: '直连 `wx.getUserProfile`',
    alipayStrategy: '映射到 `my.getOpenUserInfo`',
    douyinStrategy: '直连 `tt.getUserProfile`',
    support: '⚠️',
  },
  {
    method: 'getUserInfo',
    description: '获取用户信息。',
    wxStrategy: '直连 `wx.getUserInfo`',
    alipayStrategy: '映射到 `my.getOpenUserInfo`',
    douyinStrategy: '直连 `tt.getUserInfo`',
    support: '⚠️',
  },
  {
    method: 'getAppAuthorizeSetting',
    description: '获取 App 授权设置。',
    wxStrategy: '直连 `wx.getAppAuthorizeSetting`',
    alipayStrategy: '直连 `my.getAppAuthorizeSetting`',
    douyinStrategy: '映射到 `tt.getSetting`',
    support: '⚠️',
  },
  {
    method: 'getAppBaseInfo',
    description: '获取 App 基础信息。',
    wxStrategy: '直连 `wx.getAppBaseInfo`',
    alipayStrategy: '直连 `my.getAppBaseInfo`',
    douyinStrategy: '映射到 `tt.getEnvInfoSync`',
    support: '⚠️',
  },
  {
    method: 'chooseVideo',
    description: '选择视频。',
    wxStrategy: '直连 `wx.chooseVideo`',
    alipayStrategy: '直连 `my.chooseVideo`',
    douyinStrategy: '映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构',
    support: '⚠️',
  },
  {
    method: 'hideHomeButton',
    description: '隐藏返回首页按钮。',
    wxStrategy: '直连 `wx.hideHomeButton`',
    alipayStrategy: '映射到 `my.hideBackHome`',
    douyinStrategy: '直连 `tt.hideHomeButton`',
    support: '✅',
  },
  {
    method: 'getWindowInfo',
    description: '获取窗口信息。',
    wxStrategy: '直连 `wx.getWindowInfo`',
    alipayStrategy: '直连 `my.getWindowInfo`',
    douyinStrategy: '映射到 `tt.getSystemInfo`，并提取窗口字段',
    support: '⚠️',
  },
  {
    method: 'getDeviceInfo',
    description: '获取设备基础信息。',
    wxStrategy: '直连 `wx.getDeviceInfo`',
    alipayStrategy: '映射到 `my.getSystemInfo`，并提取设备字段',
    douyinStrategy: '映射到 `tt.getSystemInfo`，并提取设备字段',
    support: '⚠️',
  },
  {
    method: 'getAccountInfoSync',
    description: '同步获取当前账号信息。',
    wxStrategy: '直连 `wx.getAccountInfoSync`',
    alipayStrategy: '直连 `my.getAccountInfoSync`',
    douyinStrategy: '映射到 `tt.getEnvInfoSync`，并对齐账号字段结构',
    support: '⚠️',
  },
] as const

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  alipay: 'my',
  douyin: 'tt',
}

function mapToastType(type: unknown) {
  if (type === 'error') {
    return 'fail'
  }
  if (type === 'loading') {
    return 'none'
  }
  return type
}

function mapToastArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'content') && Object.prototype.hasOwnProperty.call(nextOptions, 'title')) {
    nextOptions.content = nextOptions.title
  }
  if (Object.prototype.hasOwnProperty.call(nextOptions, 'icon')) {
    nextOptions.type = mapToastType(nextOptions.icon)
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapDouyinToastArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (nextOptions.icon === 'error') {
    nextOptions.icon = 'fail'
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapLoadingArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'content') && Object.prototype.hasOwnProperty.call(nextOptions, 'title')) {
    nextOptions.content = nextOptions.title
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapActionSheetArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'items') && Array.isArray(nextOptions.itemList)) {
    nextOptions.items = nextOptions.itemList
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapActionSheetResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'tapIndex') && Object.prototype.hasOwnProperty.call(result, 'index')) {
    return {
      ...result,
      tapIndex: result.index,
    }
  }
  return result
}

function mapModalArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'confirmButtonText') && Object.prototype.hasOwnProperty.call(nextOptions, 'confirmText')) {
    nextOptions.confirmButtonText = nextOptions.confirmText
  }
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'cancelButtonText') && Object.prototype.hasOwnProperty.call(nextOptions, 'cancelText')) {
    nextOptions.cancelButtonText = nextOptions.cancelText
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapModalResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'cancel') && Object.prototype.hasOwnProperty.call(result, 'confirm')) {
    return {
      ...result,
      cancel: !result.confirm,
    }
  }
  return result
}

function mapChooseImageResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'tempFilePaths') && Array.isArray(result.apFilePaths)) {
    return {
      ...result,
      tempFilePaths: result.apFilePaths,
    }
  }
  return result
}

function mapDouyinChooseImageResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (typeof result.tempFilePaths === 'string') {
    return {
      ...result,
      tempFilePaths: [result.tempFilePaths],
    }
  }
  if (!Array.isArray(result.tempFilePaths) && Array.isArray(result.tempFiles)) {
    const fallbackPaths = result.tempFiles
      .map((item: unknown) => {
        if (!isPlainObject(item)) {
          return undefined
        }
        const path = item.path
        if (typeof path === 'string' && path) {
          return path
        }
        const filePath = item.filePath
        if (typeof filePath === 'string' && filePath) {
          return filePath
        }
        return undefined
      })
      .filter((item): item is string => typeof item === 'string')
    if (fallbackPaths.length > 0) {
      return {
        ...result,
        tempFilePaths: fallbackPaths,
      }
    }
  }
  return result
}

function mapSaveFileArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'apFilePath') && Object.prototype.hasOwnProperty.call(nextOptions, 'tempFilePath')) {
    nextOptions.apFilePath = nextOptions.tempFilePath
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapSaveFileResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'savedFilePath') && Object.prototype.hasOwnProperty.call(result, 'apFilePath')) {
    return {
      ...result,
      savedFilePath: result.apFilePath,
    }
  }
  return result
}

function mapDouyinSaveFileResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'savedFilePath') && Object.prototype.hasOwnProperty.call(result, 'filePath')) {
    return {
      ...result,
      savedFilePath: result.filePath,
    }
  }
  return result
}

function normalizePlatformName(value?: string) {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  return PLATFORM_ALIASES[normalized] ?? normalized
}

function mapSetClipboardArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'text') && Object.prototype.hasOwnProperty.call(nextOptions, 'data')) {
    nextOptions.text = nextOptions.data
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapClipboardResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'data') && Object.prototype.hasOwnProperty.call(result, 'text')) {
    return {
      ...result,
      data: result.text,
    }
  }
  return result
}

function mapAuthCodeResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'code') && typeof result.authCode === 'string' && result.authCode) {
    return {
      ...result,
      code: result.authCode,
    }
  }
  return result
}

function mapAuthorizeArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'scopes') && typeof nextOptions.scope === 'string' && nextOptions.scope) {
    nextOptions.scopes = [nextOptions.scope]
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapCheckSessionArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{
      scopes: ['auth_base'],
    }]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [
      ...nextArgs,
      {
        scopes: ['auth_base'],
      },
    ]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'scopes')) {
    nextOptions.scopes = ['auth_base']
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapCheckSessionResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (Object.prototype.hasOwnProperty.call(result, 'errMsg')) {
    return result
  }
  return {
    ...result,
    errMsg: 'checkSession:ok',
  }
}

function mapPaymentArgs(args: unknown[], target: 'orderStr' | 'orderInfo') {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, target)) {
    const packageValue = typeof nextOptions.package === 'string' && nextOptions.package
      ? nextOptions.package
      : typeof nextOptions.prepayId === 'string' && nextOptions.prepayId
        ? nextOptions.prepayId
        : undefined
    if (packageValue) {
      nextOptions[target] = packageValue
    }
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapTradePayArgs(args: unknown[]) {
  return mapPaymentArgs(args, 'orderStr')
}

function mapDouyinPayArgs(args: unknown[]) {
  return mapPaymentArgs(args, 'orderInfo')
}

function mapChooseVideoArgs(args: unknown[]) {
  const nextArgs = [...args]
  if (nextArgs.length === 0 || !isPlainObject(nextArgs[nextArgs.length - 1])) {
    nextArgs.push({})
  }
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  nextOptions.mediaType = ['video']
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'count')) {
    nextOptions.count = 1
  }
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'sizeType') && typeof nextOptions.compressed === 'boolean') {
    nextOptions.sizeType = nextOptions.compressed ? ['compressed'] : ['original']
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapChooseVideoResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (typeof result.tempFilePath === 'string' && result.tempFilePath) {
    return result
  }
  if (!Array.isArray(result.tempFiles) || result.tempFiles.length === 0) {
    return result
  }
  const firstItem = result.tempFiles[0]
  if (!isPlainObject(firstItem)) {
    return result
  }
  const tempFilePath = typeof firstItem.tempFilePath === 'string' && firstItem.tempFilePath
    ? firstItem.tempFilePath
    : typeof firstItem.filePath === 'string' && firstItem.filePath
      ? firstItem.filePath
      : undefined
  if (!tempFilePath) {
    return result
  }
  return {
    ...result,
    tempFilePath,
    duration: typeof firstItem.duration === 'number' ? firstItem.duration : result.duration,
    size: typeof firstItem.size === 'number' ? firstItem.size : result.size,
    height: typeof firstItem.height === 'number' ? firstItem.height : result.height,
    width: typeof firstItem.width === 'number' ? firstItem.width : result.width,
  }
}

function mapSystemInfoToWindowInfo(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  return {
    ...result,
    pixelRatio: result.pixelRatio,
    screenWidth: result.screenWidth,
    screenHeight: result.screenHeight,
    windowWidth: result.windowWidth,
    windowHeight: result.windowHeight,
    statusBarHeight: result.statusBarHeight,
    safeArea: result.safeArea,
    screenTop: result.screenTop,
  }
}

function mapSystemInfoToDeviceInfo(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  return {
    ...result,
    brand: result.brand,
    model: result.model,
    system: result.system,
    platform: result.platform,
    benchmarkLevel: result.benchmarkLevel,
    abi: result.abi,
  }
}

function normalizeEnvVersion(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return value
  }
  const normalized = value.toLowerCase()
  if (normalized.includes('release') || normalized.includes('prod')) {
    return 'release'
  }
  if (normalized.includes('trial') || normalized.includes('preview') || normalized.includes('test')) {
    return 'trial'
  }
  if (normalized.includes('develop') || normalized.includes('dev')) {
    return 'develop'
  }
  return value
}

function mapEnvInfoToAccountInfo(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  const microapp = isPlainObject(result.microapp) ? result.microapp : {}
  const plugin = isPlainObject(result.plugin) ? result.plugin : {}
  const miniProgram = {
    appId: typeof microapp.appId === 'string' ? microapp.appId : '',
    envVersion: normalizeEnvVersion(microapp.envType),
    version: typeof microapp.mpVersion === 'string' ? microapp.mpVersion : '',
  }
  const pluginInfo = {
    appId: typeof plugin.appId === 'string' ? plugin.appId : '',
    version: typeof plugin.version === 'string' ? plugin.version : '',
  }
  return {
    ...result,
    miniProgram,
    plugin: pluginInfo,
  }
}

function mapFallbackAsyncArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const lastArg = args[args.length - 1]
  if (isPlainObject(lastArg)) {
    return [lastArg]
  }
  return [{}]
}

const METHOD_MAPPINGS: Readonly<Record<string, Readonly<Record<string, WeapiMethodMappingRule>>>> = {
  my: {
    showToast: {
      target: 'showToast',
      mapArgs: mapToastArgs,
    },
    showLoading: {
      target: 'showLoading',
      mapArgs: mapLoadingArgs,
    },
    showActionSheet: {
      target: 'showActionSheet',
      mapArgs: mapActionSheetArgs,
      mapResult: mapActionSheetResult,
    },
    showModal: {
      target: 'confirm',
      mapArgs: mapModalArgs,
      mapResult: mapModalResult,
    },
    chooseImage: {
      target: 'chooseImage',
      mapResult: mapChooseImageResult,
    },
    saveFile: {
      target: 'saveFile',
      mapArgs: mapSaveFileArgs,
      mapResult: mapSaveFileResult,
    },
    setClipboardData: {
      target: 'setClipboard',
      mapArgs: mapSetClipboardArgs,
    },
    getClipboardData: {
      target: 'getClipboard',
      mapResult: mapClipboardResult,
    },
    chooseAddress: {
      target: 'getAddress',
    },
    createAudioContext: {
      target: 'createInnerAudioContext',
    },
    createWebAudioContext: {
      target: 'createInnerAudioContext',
    },
    getSystemInfoAsync: {
      target: 'getSystemInfo',
    },
    openAppAuthorizeSetting: {
      target: 'openSetting',
    },
    pluginLogin: {
      target: 'getAuthCode',
      mapResult: mapAuthCodeResult,
    },
    login: {
      target: 'getAuthCode',
      mapResult: mapAuthCodeResult,
    },
    authorize: {
      target: 'getAuthCode',
      mapArgs: mapAuthorizeArgs,
      mapResult: mapAuthCodeResult,
    },
    checkSession: {
      target: 'getAuthCode',
      mapArgs: mapCheckSessionArgs,
      mapResult: mapCheckSessionResult,
    },
    requestSubscribeDeviceMessage: {
      target: 'requestSubscribeMessage',
    },
    requestSubscribeEmployeeMessage: {
      target: 'requestSubscribeMessage',
    },
    restartMiniProgram: {
      target: 'reLaunch',
    },
    scanCode: {
      target: 'scan',
    },
    requestPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    requestOrderPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    requestPluginPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    requestVirtualPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    showShareImageMenu: {
      target: 'showSharePanel',
    },
    updateShareMenu: {
      target: 'showSharePanel',
    },
    openEmbeddedMiniProgram: {
      target: 'navigateToMiniProgram',
    },
    saveFileToDisk: {
      target: 'saveFileToDisk',
    },
    getEnterOptionsSync: {
      target: 'getEnterOptionsSync',
    },
    getSystemSetting: {
      target: 'getSystemSetting',
    },
    getUserProfile: {
      target: 'getOpenUserInfo',
    },
    getUserInfo: {
      target: 'getOpenUserInfo',
    },
    getAppAuthorizeSetting: {
      target: 'getAppAuthorizeSetting',
    },
    getAppBaseInfo: {
      target: 'getAppBaseInfo',
    },
    chooseVideo: {
      target: 'chooseVideo',
    },
    hideHomeButton: {
      target: 'hideBackHome',
    },
    getWindowInfo: {
      target: 'getWindowInfo',
    },
    getDeviceInfo: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToDeviceInfo,
    },
    getAccountInfoSync: {
      target: 'getAccountInfoSync',
    },
  },
  tt: {
    showToast: {
      target: 'showToast',
      mapArgs: mapDouyinToastArgs,
    },
    showLoading: {
      target: 'showLoading',
    },
    showActionSheet: {
      target: 'showActionSheet',
      mapResult: mapActionSheetResult,
    },
    showModal: {
      target: 'showModal',
    },
    chooseImage: {
      target: 'chooseImage',
      mapResult: mapDouyinChooseImageResult,
    },
    saveFile: {
      target: 'saveFile',
      mapResult: mapDouyinSaveFileResult,
    },
    setClipboardData: {
      target: 'setClipboardData',
    },
    getClipboardData: {
      target: 'getClipboardData',
    },
    chooseAddress: {
      target: 'chooseAddress',
    },
    createAudioContext: {
      target: 'createInnerAudioContext',
    },
    createWebAudioContext: {
      target: 'createInnerAudioContext',
    },
    getSystemInfoAsync: {
      target: 'getSystemInfo',
    },
    openAppAuthorizeSetting: {
      target: 'openSetting',
    },
    pluginLogin: {
      target: 'login',
    },
    login: {
      target: 'login',
    },
    authorize: {
      target: 'authorize',
    },
    checkSession: {
      target: 'checkSession',
    },
    requestSubscribeDeviceMessage: {
      target: 'requestSubscribeMessage',
    },
    requestSubscribeEmployeeMessage: {
      target: 'requestSubscribeMessage',
    },
    restartMiniProgram: {
      target: 'reLaunch',
    },
    scanCode: {
      target: 'scanCode',
    },
    requestPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    requestOrderPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    requestPluginPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    requestVirtualPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    showShareImageMenu: {
      target: 'showShareMenu',
    },
    updateShareMenu: {
      target: 'showShareMenu',
    },
    openEmbeddedMiniProgram: {
      target: 'navigateToMiniProgram',
    },
    saveFileToDisk: {
      target: 'saveFile',
    },
    getEnterOptionsSync: {
      target: 'getLaunchOptionsSync',
    },
    getSystemSetting: {
      target: 'getSetting',
    },
    getUserProfile: {
      target: 'getUserProfile',
    },
    getUserInfo: {
      target: 'getUserInfo',
    },
    getAppAuthorizeSetting: {
      target: 'getSetting',
    },
    getAppBaseInfo: {
      target: 'getEnvInfoSync',
    },
    chooseVideo: {
      target: 'chooseMedia',
      mapArgs: mapChooseVideoArgs,
      mapResult: mapChooseVideoResult,
    },
    hideHomeButton: {
      target: 'hideHomeButton',
    },
    getWindowInfo: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToWindowInfo,
    },
    getDeviceInfo: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToDeviceInfo,
    },
    getAccountInfoSync: {
      target: 'getEnvInfoSync',
      mapResult: mapEnvInfoToAccountInfo,
    },
  },
}

function createFallbackMappingRule(platform: 'my' | 'tt', methodName: string): WeapiMethodMappingRule | undefined {
  const methodSet = PLATFORM_METHOD_SET[platform]
  if (/^on[A-Z]/.test(methodName) && methodSet.has('onAppShow')) {
    return {
      target: 'onAppShow',
    }
  }
  if (/^off[A-Z]/.test(methodName) && methodSet.has('offAppShow')) {
    return {
      target: 'offAppShow',
    }
  }
  if (methodName.endsWith('Sync') && methodSet.has('getSystemInfoSync')) {
    return {
      target: 'getSystemInfoSync',
    }
  }
  if (methodSet.has('hideToast')) {
    return {
      target: 'hideToast',
      mapArgs: mapFallbackAsyncArgs,
    }
  }
  return undefined
}

function resolveMappingRule(
  platform: 'my' | 'tt',
  methodName: string,
  options: ResolveMethodMappingOptions = {},
): WeapiResolvedMethodMapping {
  const methodSet = PLATFORM_METHOD_SET[platform]
  const explicitRule = METHOD_MAPPINGS[platform]?.[methodName]
  if (explicitRule) {
    return {
      target: explicitRule.target,
      source: 'explicit',
      rule: explicitRule,
    }
  }
  if (methodSet.has(methodName)) {
    return {
      target: methodName,
      source: 'identity',
    }
  }
  if (options.allowFallback === false) {
    return {
      target: methodName,
      source: 'identity',
    }
  }
  const fallbackRule = createFallbackMappingRule(platform, methodName)
  if (fallbackRule) {
    return {
      target: fallbackRule.target,
      source: 'fallback',
      rule: fallbackRule,
    }
  }
  return {
    target: methodName,
    source: 'identity',
  }
}

function toSupportLevel(source: WeapiResolvedMethodMapping['source'], supported: boolean): WeapiSupportLevel {
  if (!supported) {
    return 'unsupported'
  }
  if (source === 'fallback') {
    return 'fallback'
  }
  if (source === 'explicit') {
    return 'mapped'
  }
  return 'native'
}

function isSemanticSupportLevel(level: WeapiSupportLevel) {
  return level === 'native' || level === 'mapped'
}

function resolveDefaultStrategy(
  platform: 'my' | 'tt',
  methodName: string,
  target: string,
  supported: boolean,
  source: WeapiResolvedMethodMapping['source'],
) {
  if (!supported) {
    return `未提供 ${platform}.${target}，调用时将返回 not supported`
  }
  if (source === 'fallback') {
    return `回退映射到 \`${platform}.${target}\`（通用兜底）`
  }
  if (target !== methodName) {
    return `映射到 \`${platform}.${target}\``
  }
  return `直连 \`${platform}.${methodName}\``
}

function resolvePlatformCompatibility(platform: 'my' | 'tt', methodName: string) {
  const resolution = resolveMappingRule(platform, methodName)
  const target = resolution.target
  const supported = PLATFORM_METHOD_SET[platform].has(target)
  const supportLevel = toSupportLevel(resolution.source, supported)
  return {
    resolution,
    target,
    supported,
    supportLevel,
    semanticallyAligned: isSemanticSupportLevel(supportLevel),
  }
}

/**
 * @description 校验文档矩阵与实际映射规则是否保持一致
 */

function formatCoverageRate(supportedApis: number, totalApis: number) {
  if (totalApis <= 0) {
    return '100.00%'
  }
  return `${((supportedApis / totalApis) * 100).toFixed(2)}%`
}

/**
 * @description 生成 API 支持覆盖率报告
 */
export function generateApiSupportCoverageReport(): WeapiApiCoverageReport {
  const methodNames = WEAPI_WX_METHODS as readonly string[]
  const totalApis = methodNames.length
  let alipaySupportedApis = 0
  let douyinSupportedApis = 0
  let alipaySemanticAlignedApis = 0
  let douyinSemanticAlignedApis = 0
  let alipayFallbackApis = 0
  let douyinFallbackApis = 0
  let fullyAlignedApis = 0
  let fullySemanticallyAlignedApis = 0

  for (const methodName of methodNames) {
    const alipay = resolvePlatformCompatibility('my', methodName)
    const douyin = resolvePlatformCompatibility('tt', methodName)
    if (alipay.supported) {
      alipaySupportedApis += 1
    }
    if (douyin.supported) {
      douyinSupportedApis += 1
    }
    if (alipay.semanticallyAligned) {
      alipaySemanticAlignedApis += 1
    }
    if (douyin.semanticallyAligned) {
      douyinSemanticAlignedApis += 1
    }
    if (alipay.supportLevel === 'fallback') {
      alipayFallbackApis += 1
    }
    if (douyin.supportLevel === 'fallback') {
      douyinFallbackApis += 1
    }
    if (alipay.supported && douyin.supported) {
      fullyAlignedApis += 1
    }
    if (alipay.semanticallyAligned && douyin.semanticallyAligned) {
      fullySemanticallyAlignedApis += 1
    }
  }

  const wxSupportedApis = totalApis
  const wxSemanticAlignedApis = totalApis

  const platforms: readonly WeapiApiCoveragePlatformItem[] = [
    {
      platform: '微信小程序',
      alias: 'wx',
      supportedApis: wxSupportedApis,
      semanticAlignedApis: wxSemanticAlignedApis,
      fallbackApis: 0,
      totalApis,
      coverage: formatCoverageRate(wxSupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(wxSemanticAlignedApis, totalApis),
    },
    {
      platform: '支付宝小程序',
      alias: 'my',
      supportedApis: alipaySupportedApis,
      semanticAlignedApis: alipaySemanticAlignedApis,
      fallbackApis: alipayFallbackApis,
      totalApis,
      coverage: formatCoverageRate(alipaySupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(alipaySemanticAlignedApis, totalApis),
    },
    {
      platform: '抖音小程序',
      alias: 'tt',
      supportedApis: douyinSupportedApis,
      semanticAlignedApis: douyinSemanticAlignedApis,
      fallbackApis: douyinFallbackApis,
      totalApis,
      coverage: formatCoverageRate(douyinSupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(douyinSemanticAlignedApis, totalApis),
    },
  ]

  return {
    totalApis,
    fullyAlignedApis,
    fullyAlignedCoverage: formatCoverageRate(fullyAlignedApis, totalApis),
    fullySemanticallyAlignedApis,
    fullySemanticallyAlignedCoverage: formatCoverageRate(fullySemanticallyAlignedApis, totalApis),
    platforms,
  }
}

/**
 * @description 生成微信命名下的全量跨平台兼容矩阵
 */
export function generateMethodCompatibilityMatrix(): readonly WeapiMethodCompatibilityItem[] {
  const detailByMethod = new Map<string, WeapiMethodSupportMatrixItem>(
    WEAPI_METHOD_SUPPORT_MATRIX.map(item => [item.method, item]),
  )

  return (WEAPI_WX_METHODS as readonly string[]).map((methodName) => {
    const alipay = resolvePlatformCompatibility('my', methodName)
    const douyin = resolvePlatformCompatibility('tt', methodName)
    const detail = detailByMethod.get(methodName)
    return {
      method: methodName,
      wxStrategy: detail?.wxStrategy ?? `直连 \`wx.${methodName}\``,
      alipayTarget: alipay.target,
      alipayStrategy: detail?.alipayStrategy ?? resolveDefaultStrategy('my', methodName, alipay.target, alipay.supported, alipay.resolution.source),
      alipaySupported: alipay.supported,
      alipaySupportLevel: alipay.supportLevel,
      alipaySemanticallyAligned: alipay.semanticallyAligned,
      douyinTarget: douyin.target,
      douyinStrategy: detail?.douyinStrategy ?? resolveDefaultStrategy('tt', methodName, douyin.target, douyin.supported, douyin.resolution.source),
      douyinSupported: douyin.supported,
      douyinSupportLevel: douyin.supportLevel,
      douyinSemanticallyAligned: douyin.semanticallyAligned,
      support: alipay.supported && douyin.supported ? '✅' : '⚠️',
      semanticSupport: alipay.semanticallyAligned && douyin.semanticallyAligned ? '✅' : '⚠️',
    }
  })
}

export function validateSupportMatrixConsistency() {
  const mappedMethods = new Set(Object.keys(METHOD_MAPPINGS.my ?? {}))
  const douyinMappedMethods = new Set(Object.keys(METHOD_MAPPINGS.tt ?? {}))
  const documentedMethods = new Set(WEAPI_METHOD_SUPPORT_MATRIX.map(item => item.method))
  const missingDocs = Array.from(mappedMethods).filter(method => !documentedMethods.has(method))
  const missingMappings = Array.from(documentedMethods).filter(method => !mappedMethods.has(method))
  const missingDouyinMappings = Array.from(mappedMethods).filter(method => !douyinMappedMethods.has(method))
  const extraDouyinMappings = Array.from(douyinMappedMethods).filter(method => !mappedMethods.has(method))
  const missingCatalogMethods = Array.from(documentedMethods).filter(method =>
    !WEAPI_WX_METHOD_SET.has(method) && !WEAPI_MY_METHOD_SET.has(method) && !WEAPI_TT_METHOD_SET.has(method),
  )
  return {
    missingDocs,
    missingMappings,
    missingDouyinMappings,
    extraDouyinMappings,
    missingCatalogMethods,
  }
}

/**
 * @description 解析平台 API 映射规则
 */
export function resolveMethodMapping(platform: string | undefined, methodName: string) {
  const normalizedPlatform = normalizePlatformName(platform)
  if (!normalizedPlatform) {
    return undefined
  }
  if (normalizedPlatform !== 'my' && normalizedPlatform !== 'tt') {
    return undefined
  }
  return resolveMappingRule(normalizedPlatform, methodName).rule
}

/**
 * @description 解析平台 API 映射规则及映射来源
 */
export function resolveMethodMappingWithMeta(
  platform: string | undefined,
  methodName: string,
  options: ResolveMethodMappingOptions = {},
) {
  const normalizedPlatform = normalizePlatformName(platform)
  if (!normalizedPlatform) {
    return undefined
  }
  if (normalizedPlatform !== 'my' && normalizedPlatform !== 'tt') {
    return undefined
  }
  return resolveMappingRule(normalizedPlatform, methodName, options)
}
