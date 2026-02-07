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
    description: '保存文件。',
    wxStrategy: '直连 `wx.saveFile`',
    alipayStrategy: '请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath`',
    douyinStrategy: '直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath`',
    support: '✅',
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
] as const

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  alipay: 'my',
  douyin: 'tt',
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
  },
}

/**
 * @description 校验文档矩阵与实际映射规则是否保持一致
 */
export function validateSupportMatrixConsistency() {
  const mappedMethods = new Set(Object.keys(METHOD_MAPPINGS.my ?? {}))
  const douyinMappedMethods = new Set(Object.keys(METHOD_MAPPINGS.tt ?? {}))
  const documentedMethods = new Set(WEAPI_METHOD_SUPPORT_MATRIX.map(item => item.method))
  const missingDocs = Array.from(mappedMethods).filter(method => !documentedMethods.has(method))
  const missingMappings = Array.from(documentedMethods).filter(method => !mappedMethods.has(method))
  const missingDouyinMappings = Array.from(mappedMethods).filter(method => !douyinMappedMethods.has(method))
  const extraDouyinMappings = Array.from(douyinMappedMethods).filter(method => !mappedMethods.has(method))
  return {
    missingDocs,
    missingMappings,
    missingDouyinMappings,
    extraDouyinMappings,
  }
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
