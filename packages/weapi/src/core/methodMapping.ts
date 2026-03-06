import { WEAPI_MY_METHODS, WEAPI_TT_METHODS, WEAPI_WX_METHODS } from './apiCatalog'
import { isPlainObject } from './utils.ts'

export interface WeapiMethodMappingRule {
  target: string
  mapArgs?: (args: unknown[]) => unknown[]
  mapResult?: (result: any) => any
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
  douyinTarget: string
  douyinStrategy: string
  douyinSupported: boolean
  support: string
}

export interface WeapiApiCoveragePlatformItem {
  platform: string
  alias: string
  supportedApis: number
  totalApis: number
  coverage: string
}

export interface WeapiApiCoverageReport {
  totalApis: number
  fullyAlignedApis: number
  fullyAlignedCoverage: string
  platforms: readonly WeapiApiCoveragePlatformItem[]
}

const WEAPI_WX_METHOD_SET = new Set<string>(WEAPI_WX_METHODS)
const WEAPI_MY_METHOD_SET = new Set<string>(WEAPI_MY_METHODS)
const WEAPI_TT_METHOD_SET = new Set<string>(WEAPI_TT_METHODS)

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
  },
}

function resolveTargetMethod(platform: 'my' | 'tt', methodName: string) {
  const rule = METHOD_MAPPINGS[platform]?.[methodName]
  return rule?.target ?? methodName
}

function resolveDefaultStrategy(platform: 'my' | 'tt', methodName: string, target: string, supported: boolean) {
  if (!supported) {
    return `未提供 ${platform}.${target}，调用时将返回 not supported`
  }
  if (target !== methodName) {
    return `映射到 \`${platform}.${target}\``
  }
  return `直连 \`${platform}.${methodName}\``
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

  const alipaySupportedApis = methodNames
    .filter(method => WEAPI_MY_METHOD_SET.has(resolveTargetMethod('my', method)))
    .length
  const douyinSupportedApis = methodNames
    .filter(method => WEAPI_TT_METHOD_SET.has(resolveTargetMethod('tt', method)))
    .length
  const wxSupportedApis = totalApis

  const fullyAlignedApis = methodNames.filter(method =>
    WEAPI_MY_METHOD_SET.has(resolveTargetMethod('my', method))
    && WEAPI_TT_METHOD_SET.has(resolveTargetMethod('tt', method)),
  ).length

  const platforms: readonly WeapiApiCoveragePlatformItem[] = [
    {
      platform: '微信小程序',
      alias: 'wx',
      supportedApis: wxSupportedApis,
      totalApis,
      coverage: formatCoverageRate(wxSupportedApis, totalApis),
    },
    {
      platform: '支付宝小程序',
      alias: 'my',
      supportedApis: alipaySupportedApis,
      totalApis,
      coverage: formatCoverageRate(alipaySupportedApis, totalApis),
    },
    {
      platform: '抖音小程序',
      alias: 'tt',
      supportedApis: douyinSupportedApis,
      totalApis,
      coverage: formatCoverageRate(douyinSupportedApis, totalApis),
    },
  ]

  return {
    totalApis,
    fullyAlignedApis,
    fullyAlignedCoverage: formatCoverageRate(fullyAlignedApis, totalApis),
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
    const alipayTarget = resolveTargetMethod('my', methodName)
    const douyinTarget = resolveTargetMethod('tt', methodName)
    const alipaySupported = WEAPI_MY_METHOD_SET.has(alipayTarget)
    const douyinSupported = WEAPI_TT_METHOD_SET.has(douyinTarget)
    const detail = detailByMethod.get(methodName)
    return {
      method: methodName,
      wxStrategy: detail?.wxStrategy ?? `直连 \`wx.${methodName}\``,
      alipayTarget,
      alipayStrategy: detail?.alipayStrategy ?? resolveDefaultStrategy('my', methodName, alipayTarget, alipaySupported),
      alipaySupported,
      douyinTarget,
      douyinStrategy: detail?.douyinStrategy ?? resolveDefaultStrategy('tt', methodName, douyinTarget, douyinSupported),
      douyinSupported,
      support: alipaySupported && douyinSupported ? '✅' : '⚠️',
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
  const platformMappings = METHOD_MAPPINGS[normalizedPlatform]
  if (!platformMappings) {
    return undefined
  }
  return platformMappings[methodName]
}
