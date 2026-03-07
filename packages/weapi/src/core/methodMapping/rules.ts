import type { WeapiMethodMappingRule } from './types'
import { createNotSupportedError, isPlainObject } from '../utils.ts'

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
  if (Object.prototype.hasOwnProperty.call(nextOptions, 'showCancel') && nextOptions.showCancel === false) {
    throw createNotSupportedError('showModal', 'my')
  }
  if (Object.prototype.hasOwnProperty.call(nextOptions, 'editable') && nextOptions.editable === true) {
    throw createNotSupportedError('showModal', 'my')
  }
  if (Object.prototype.hasOwnProperty.call(nextOptions, 'placeholderText')) {
    throw createNotSupportedError('showModal', 'my')
  }
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
  let changed = false
  const nextResult = {
    ...result,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextResult, 'cancel') && Object.prototype.hasOwnProperty.call(nextResult, 'confirm')) {
    nextResult.cancel = !nextResult.confirm
    changed = true
  }
  if (!Object.prototype.hasOwnProperty.call(nextResult, 'content')) {
    nextResult.content = ''
    changed = true
  }
  return changed ? nextResult : result
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

function mapCreateRewardedVideoAdArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  if (Object.prototype.hasOwnProperty.call(lastArg, 'multiton') && lastArg.multiton === true) {
    throw createNotSupportedError('createRewardedVideoAd', 'my')
  }
  if (Object.prototype.hasOwnProperty.call(lastArg, 'disableFallbackSharePage') && lastArg.disableFallbackSharePage === true) {
    throw createNotSupportedError('createRewardedVideoAd', 'my')
  }
  const adUnitId = lastArg.adUnitId
  if (typeof adUnitId === 'string' && adUnitId.length > 0) {
    nextArgs[lastIndex] = adUnitId
  }
  return nextArgs
}

function mapRewardedAdInstance(result: any, args: unknown[] = []) {
  if (typeof result !== 'object' || result === null) {
    return result
  }
  const adUnitIdArg = args.length > 0 ? args[args.length - 1] : undefined
  const adUnitId = typeof adUnitIdArg === 'string' ? adUnitIdArg : undefined
  if (!adUnitId) {
    return result
  }
  const rewardedAd = result as Record<string, any>
  const wrapMethod = (name: 'destroy' | 'load' | 'show') => {
    const method = rewardedAd[name]
    if (typeof method !== 'function') {
      return method
    }
    return (options?: unknown) => {
      if (isPlainObject(options)) {
        return method.call(rewardedAd, {
          ...options,
          adUnitId,
        })
      }
      if (options === undefined) {
        return method.call(rewardedAd, {
          adUnitId,
        })
      }
      return method.call(rewardedAd, options)
    }
  }
  const nextRewardedAd = Object.create(rewardedAd) as Record<string, any>
  nextRewardedAd.destroy = wrapMethod('destroy')
  nextRewardedAd.load = wrapMethod('load')
  nextRewardedAd.show = wrapMethod('show')
  return nextRewardedAd
}

function mapCheckIsSoterEnrolledInDeviceArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  if (lastArg.checkAuthMode === 'speech') {
    throw createNotSupportedError('checkIsSoterEnrolledInDevice', 'my')
  }
  return nextArgs
}

function mapSoterCheckResult(methodName: string, result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (Object.prototype.hasOwnProperty.call(result, 'errMsg')) {
    return result
  }
  return {
    ...result,
    errMsg: `${methodName}:ok`,
  }
}

function toNumberCode(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function mapBleConnectionResult(methodName: 'createBLEConnection' | 'closeBLEConnection', codeKey: 'error' | 'errorCode', result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  const nextResult = {
    ...result,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextResult, 'errCode')) {
    const code = toNumberCode(nextResult[codeKey])
    if (typeof code === 'number') {
      nextResult.errCode = code
    }
  }
  if (!Object.prototype.hasOwnProperty.call(nextResult, 'errMsg')) {
    if (typeof nextResult.errorMessage === 'string' && nextResult.errorMessage.length > 0) {
      nextResult.errMsg = nextResult.errorMessage
    }
    else if (nextResult.errCode === 0) {
      nextResult.errMsg = `${methodName}:ok`
    }
  }
  return nextResult
}

function mapCreateBleConnectionResult(result: any) {
  return mapBleConnectionResult('createBLEConnection', 'error', result)
}

function mapCloseBleConnectionResult(result: any) {
  return mapBleConnectionResult('closeBLEConnection', 'errorCode', result)
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

export function normalizePlatformName(value?: string) {
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

function resolveFilePaths(result: any): string[] {
  if (!isPlainObject(result)) {
    return []
  }
  if (typeof result.tempFilePaths === 'string' && result.tempFilePaths) {
    return [result.tempFilePaths]
  }
  if (Array.isArray(result.tempFilePaths)) {
    return result.tempFilePaths.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
  }
  if (Array.isArray(result.apFilePaths)) {
    return result.apFilePaths.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
  }
  if (Array.isArray(result.tempFiles)) {
    return result.tempFiles
      .map((item: unknown) => {
        if (!isPlainObject(item)) {
          return undefined
        }
        if (typeof item.tempFilePath === 'string' && item.tempFilePath) {
          return item.tempFilePath
        }
        if (typeof item.path === 'string' && item.path) {
          return item.path
        }
        if (typeof item.filePath === 'string' && item.filePath) {
          return item.filePath
        }
        return undefined
      })
      .filter((item): item is string => typeof item === 'string')
  }
  return []
}

function mapChooseMediaResultFromImage(result: any) {
  const normalized = mapChooseImageResult(result)
  if (!isPlainObject(normalized)) {
    return normalized
  }
  if (Array.isArray(normalized.tempFiles) && normalized.tempFiles.length > 0) {
    return normalized
  }
  const tempFilePaths = resolveFilePaths(normalized)
  if (tempFilePaths.length === 0) {
    return normalized
  }
  return {
    ...normalized,
    tempFilePaths,
    tempFiles: tempFilePaths.map(tempFilePath => ({
      tempFilePath,
      fileType: 'image',
    })),
    type: 'image',
  }
}

export const METHOD_MAPPINGS: Readonly<Record<string, Readonly<Record<string, WeapiMethodMappingRule>>>> = {
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
    chooseMedia: {
      target: 'chooseMedia',
    },
    chooseMessageFile: {
      target: 'chooseMessageFile',
    },
    getFuzzyLocation: {
      target: 'getFuzzyLocation',
    },
    previewMedia: {
      target: 'previewMedia',
    },
    createInterstitialAd: {
      target: 'createInterstitialAd',
    },
    createRewardedVideoAd: {
      target: 'createRewardedAd',
      mapArgs: mapCreateRewardedVideoAdArgs,
      mapResult: mapRewardedAdInstance,
    },
    createLivePlayerContext: {
      target: 'createLivePlayerContext',
    },
    createLivePusherContext: {
      target: 'createLivePusherContext',
    },
    getVideoInfo: {
      target: 'getVideoInfo',
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
      target: 'chooseAddress',
    },
    createAudioContext: {
      target: 'createAudioContext',
    },
    createWebAudioContext: {
      target: 'createWebAudioContext',
    },
    getSystemInfoAsync: {
      target: 'getSystemInfo',
    },
    openAppAuthorizeSetting: {
      target: 'openAppAuthorizeSetting',
    },
    pluginLogin: {
      target: 'pluginLogin',
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
      target: 'requestSubscribeDeviceMessage',
    },
    requestSubscribeEmployeeMessage: {
      target: 'requestSubscribeEmployeeMessage',
    },
    restartMiniProgram: {
      target: 'restartMiniProgram',
    },
    scanCode: {
      target: 'scanCode',
    },
    requestPayment: {
      target: 'requestPayment',
    },
    requestOrderPayment: {
      target: 'requestOrderPayment',
    },
    requestPluginPayment: {
      target: 'requestPluginPayment',
    },
    requestVirtualPayment: {
      target: 'requestVirtualPayment',
    },
    showShareImageMenu: {
      target: 'showShareImageMenu',
    },
    updateShareMenu: {
      target: 'updateShareMenu',
    },
    openEmbeddedMiniProgram: {
      target: 'openEmbeddedMiniProgram',
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
      target: 'getUserProfile',
    },
    getUserInfo: {
      target: 'getUserInfo',
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
      target: 'getDeviceInfo',
    },
    getAccountInfoSync: {
      target: 'getAccountInfoSync',
    },
    setBackgroundColor: {
      target: 'setBackgroundColor',
    },
    setBackgroundTextStyle: {
      target: 'setBackgroundTextStyle',
    },
    getNetworkType: {
      target: 'getNetworkType',
    },
    getBatteryInfo: {
      target: 'getBatteryInfo',
    },
    getBatteryInfoSync: {
      target: 'getBatteryInfoSync',
    },
    getLogManager: {
      target: 'getLogManager',
    },
    nextTick: {
      target: 'nextTick',
    },
    onWindowResize: {
      target: 'onWindowResize',
    },
    offWindowResize: {
      target: 'offWindowResize',
    },
    reportAnalytics: {
      target: 'reportAnalytics',
    },
    addCard: {
      target: 'addCard',
    },
    addFileToFavorites: {
      target: 'addFileToFavorites',
    },
    addPaymentPassFinish: {
      target: 'addPaymentPassFinish',
    },
    addPaymentPassGetCertificateData: {
      target: 'addPaymentPassGetCertificateData',
    },
    addPhoneCalendar: {
      target: 'addPhoneCalendar',
    },
    addPhoneContact: {
      target: 'addPhoneContact',
    },
    addPhoneRepeatCalendar: {
      target: 'addPhoneRepeatCalendar',
    },
    addVideoToFavorites: {
      target: 'addVideoToFavorites',
    },
    authorizeForMiniProgram: {
      target: 'authorizeForMiniProgram',
    },
    authPrivateMessage: {
      target: 'authPrivateMessage',
    },
    bindEmployeeRelation: {
      target: 'bindEmployeeRelation',
    },
    canAddSecureElementPass: {
      target: 'canAddSecureElementPass',
    },
    canvasGetImageData: {
      target: 'canvasGetImageData',
    },
    canvasPutImageData: {
      target: 'canvasPutImageData',
    },
    checkDeviceSupportHevc: {
      target: 'checkDeviceSupportHevc',
    },
    checkEmployeeRelation: {
      target: 'checkEmployeeRelation',
    },
    checkIsAddedToMyMiniProgram: {
      target: 'checkIsAddedToMyMiniProgram',
    },
    checkIsOpenAccessibility: {
      target: 'checkIsOpenAccessibility',
    },
    checkIsPictureInPictureActive: {
      target: 'checkIsPictureInPictureActive',
    },
    checkIsSoterEnrolledInDevice: {
      target: 'checkIsIfaaEnrolledInDevice',
      mapArgs: mapCheckIsSoterEnrolledInDeviceArgs,
      mapResult: result => mapSoterCheckResult('checkIsSoterEnrolledInDevice', result),
    },
    checkIsSupportSoterAuthentication: {
      target: 'checkIsSupportIfaaAuthentication',
      mapResult: result => mapSoterCheckResult('checkIsSupportSoterAuthentication', result),
    },
    openCard: {
      target: 'openCard',
    },
    openChannelsActivity: {
      target: 'openChannelsActivity',
    },
    openChannelsEvent: {
      target: 'openChannelsEvent',
    },
    openChannelsLive: {
      target: 'openChannelsLive',
    },
    openChannelsLiveNoticeInfo: {
      target: 'openChannelsLiveNoticeInfo',
    },
    openChannelsUserProfile: {
      target: 'openChannelsUserProfile',
    },
    openChatTool: {
      target: 'openChatTool',
    },
    openHKOfflinePayView: {
      target: 'openHKOfflinePayView',
    },
    openInquiriesTopic: {
      target: 'openInquiriesTopic',
    },
    openOfficialAccountArticle: {
      target: 'openOfficialAccountArticle',
    },
    openOfficialAccountChat: {
      target: 'openOfficialAccountChat',
    },
    openOfficialAccountProfile: {
      target: 'openOfficialAccountProfile',
    },
    openPrivacyContract: {
      target: 'openPrivacyContract',
    },
    openSystemBluetoothSetting: {
      target: 'openSystemBluetoothSetting',
    },
    reportEvent: {
      target: 'reportEvent',
    },
    reportMonitor: {
      target: 'reportMonitor',
    },
    reportPerformance: {
      target: 'reportPerformance',
    },
    openSingleStickerView: {
      target: 'openSingleStickerView',
    },
    openStickerIPView: {
      target: 'openStickerIPView',
    },
    openStickerSetView: {
      target: 'openStickerSetView',
    },
    openStoreCouponDetail: {
      target: 'openStoreCouponDetail',
    },
    openStoreOrderDetail: {
      target: 'openStoreOrderDetail',
    },
    pauseBackgroundAudio: {
      target: 'pauseBackgroundAudio',
    },
    pauseVoice: {
      target: 'pauseVoice',
    },
    playBackgroundAudio: {
      target: 'playBackgroundAudio',
    },
    playVoice: {
      target: 'playVoice',
    },
    postMessageToReferrerMiniProgram: {
      target: 'postMessageToReferrerMiniProgram',
    },
    postMessageToReferrerPage: {
      target: 'postMessageToReferrerPage',
    },
    preDownloadSubpackage: {
      target: 'preDownloadSubpackage',
    },
    preloadAssets: {
      target: 'preloadAssets',
    },
    preloadSkylineView: {
      target: 'preloadSkylineView',
    },
    preloadWebview: {
      target: 'preloadWebview',
    },
    removeSecureElementPass: {
      target: 'removeSecureElementPass',
    },
    chooseInvoiceTitle: {
      target: 'chooseInvoiceTitle',
    },
    chooseLicensePlate: {
      target: 'chooseLicensePlate',
    },
    choosePoi: {
      target: 'choosePoi',
    },
    closeBLEConnection: {
      target: 'disconnectBLEDevice',
      mapResult: mapCloseBleConnectionResult,
    },
    createBLEConnection: {
      target: 'connectBLEDevice',
      mapResult: mapCreateBleConnectionResult,
    },
    cropImage: {
      target: 'cropImage',
    },
    editImage: {
      target: 'editImage',
    },
    exitVoIPChat: {
      target: 'exitVoIPChat',
    },
    faceDetect: {
      target: 'faceDetect',
    },
    getApiCategory: {
      target: 'getApiCategory',
    },
    getBackgroundFetchToken: {
      target: 'getBackgroundFetchToken',
    },
    getChannelsLiveInfo: {
      target: 'getChannelsLiveInfo',
    },
    getChannelsLiveNoticeInfo: {
      target: 'getChannelsLiveNoticeInfo',
    },
    getChannelsShareKey: {
      target: 'getChannelsShareKey',
    },
    getChatToolInfo: {
      target: 'getChatToolInfo',
    },
    getCommonConfig: {
      target: 'getCommonConfig',
    },
    getGroupEnterInfo: {
      target: 'getGroupEnterInfo',
    },
    getPrivacySetting: {
      target: 'getPrivacySetting',
    },
    initFaceDetect: {
      target: 'initFaceDetect',
    },
    join1v1Chat: {
      target: 'join1v1Chat',
    },
    requestCommonPayment: {
      target: 'requestCommonPayment',
    },
    requestDeviceVoIP: {
      target: 'requestDeviceVoIP',
    },
    requestMerchantTransfer: {
      target: 'requestMerchantTransfer',
    },
    requirePrivacyAuthorize: {
      target: 'requirePrivacyAuthorize',
    },
    reserveChannelsLive: {
      target: 'reserveChannelsLive',
    },
    selectGroupMembers: {
      target: 'selectGroupMembers',
    },
    sendHCEMessage: {
      target: 'sendHCEMessage',
    },
    sendSms: {
      target: 'sendSms',
    },
    setBackgroundFetchToken: {
      target: 'setBackgroundFetchToken',
    },
    setEnable1v1Chat: {
      target: 'setEnable1v1Chat',
    },
    setTopBarText: {
      target: 'setTopBarText',
    },
    setWindowSize: {
      target: 'setWindowSize',
    },
    stopHCE: {
      target: 'stopHCE',
    },
    stopLocalServiceDiscovery: {
      target: 'stopLocalServiceDiscovery',
    },
    stopLocationUpdate: {
      target: 'stopLocationUpdate',
    },
    stopRecord: {
      target: 'stopRecord',
    },
    stopVoice: {
      target: 'stopVoice',
    },
    subscribeVoIPVideoMembers: {
      target: 'subscribeVoIPVideoMembers',
    },
    updateVoIPChatMuteConfig: {
      target: 'updateVoIPChatMuteConfig',
    },
    updateWeChatApp: {
      target: 'updateWeChatApp',
    },
    getBackgroundAudioPlayerState: {
      target: 'getBackgroundAudioPlayerState',
    },
    getDeviceBenchmarkInfo: {
      target: 'getDeviceBenchmarkInfo',
    },
    getDeviceVoIPList: {
      target: 'getDeviceVoIPList',
    },
    getHCEState: {
      target: 'getHCEState',
    },
    getInferenceEnvInfo: {
      target: 'getInferenceEnvInfo',
    },
    getNFCAdapter: {
      target: 'getNFCAdapter',
    },
    getPerformance: {
      target: 'getPerformance',
    },
    getRandomValues: {
      target: 'getRandomValues',
    },
    getRealtimeLogManager: {
      target: 'getRealtimeLogManager',
    },
    getRendererUserAgent: {
      target: 'getRendererUserAgent',
    },
    getScreenRecordingState: {
      target: 'getScreenRecordingState',
    },
    getSecureElementPasses: {
      target: 'getSecureElementPasses',
    },
    getSelectedTextRange: {
      target: 'getSelectedTextRange',
    },
    getShowSplashAdStatus: {
      target: 'getShowSplashAdStatus',
    },
    getSkylineInfo: {
      target: 'getSkylineInfo',
    },
    getUserCryptoManager: {
      target: 'getUserCryptoManager',
    },
    getWeRunData: {
      target: 'getWeRunData',
    },
    getXrFrameSystem: {
      target: 'getXrFrameSystem',
    },
    isBluetoothDevicePaired: {
      target: 'isBluetoothDevicePaired',
    },
    isVKSupport: {
      target: 'isVKSupport',
    },
    createBLEPeripheralServer: {
      target: 'createBLEPeripheralServer',
    },
    createBufferURL: {
      target: 'createBufferURL',
    },
    createCacheManager: {
      target: 'createCacheManager',
    },
    createGlobalPayment: {
      target: 'createGlobalPayment',
    },
    createInferenceSession: {
      target: 'createInferenceSession',
    },
    createMediaAudioPlayer: {
      target: 'createMediaAudioPlayer',
    },
    createMediaContainer: {
      target: 'createMediaContainer',
    },
    createMediaRecorder: {
      target: 'createMediaRecorder',
    },
    createTCPSocket: {
      target: 'createTCPSocket',
    },
    createUDPSocket: {
      target: 'createUDPSocket',
    },
    createVideoDecoder: {
      target: 'createVideoDecoder',
    },
    loadBuiltInFontFace: {
      target: 'loadBuiltInFontFace',
    },
    notifyGroupMembers: {
      target: 'notifyGroupMembers',
    },
    requestIdleCallback: {
      target: 'requestIdleCallback',
    },
    revokeBufferURL: {
      target: 'revokeBufferURL',
    },
    rewriteRoute: {
      target: 'rewriteRoute',
    },
    seekBackgroundAudio: {
      target: 'seekBackgroundAudio',
    },
    setEnableDebug: {
      target: 'setEnableDebug',
    },
    setInnerAudioOption: {
      target: 'setInnerAudioOption',
    },
    shareAppMessageToGroup: {
      target: 'shareAppMessageToGroup',
    },
    shareEmojiToGroup: {
      target: 'shareEmojiToGroup',
    },
    shareFileMessage: {
      target: 'shareFileMessage',
    },
    shareFileToGroup: {
      target: 'shareFileToGroup',
    },
    shareImageToGroup: {
      target: 'shareImageToGroup',
    },
    shareToOfficialAccount: {
      target: 'shareToOfficialAccount',
    },
    shareToWeRun: {
      target: 'shareToWeRun',
    },
    shareVideoMessage: {
      target: 'shareVideoMessage',
    },
    shareVideoToGroup: {
      target: 'shareVideoToGroup',
    },
    showRedPackage: {
      target: 'showRedPackage',
    },
    startDeviceMotionListening: {
      target: 'startDeviceMotionListening',
    },
    startHCE: {
      target: 'startHCE',
    },
    startLocalServiceDiscovery: {
      target: 'startLocalServiceDiscovery',
    },
    startLocationUpdate: {
      target: 'startLocationUpdate',
    },
    startLocationUpdateBackground: {
      target: 'startLocationUpdateBackground',
    },
    startRecord: {
      target: 'startRecord',
    },
    startSoterAuthentication: {
      target: 'startSoterAuthentication',
    },
    stopBackgroundAudio: {
      target: 'stopBackgroundAudio',
    },
    stopDeviceMotionListening: {
      target: 'stopDeviceMotionListening',
    },
    stopFaceDetect: {
      target: 'stopFaceDetect',
    },
    openCustomerServiceChat: {
      target: 'openCustomerServiceChat',
    },
    createVKSession: {
      target: 'createVKSession',
    },
    compressVideo: {
      target: 'compressVideo',
    },
    openVideoEditor: {
      target: 'openVideoEditor',
    },
    getShareInfo: {
      target: 'getShareInfo',
    },
    joinVoIPChat: {
      target: 'joinVoIPChat',
    },
    openDocument: {
      target: 'openDocument',
    },
    saveVideoToPhotosAlbum: {
      target: 'saveVideoToPhotosAlbum',
    },
    batchSetStorage: {
      target: 'batchSetStorage',
    },
    batchGetStorage: {
      target: 'batchGetStorage',
    },
    batchSetStorageSync: {
      target: 'batchSetStorageSync',
    },
    batchGetStorageSync: {
      target: 'batchGetStorageSync',
    },
    createCameraContext: {
      target: 'createCameraContext',
    },
    offMemoryWarning: {
      target: 'offMemoryWarning',
    },
    cancelIdleCallback: {
      target: 'cancelIdleCallback',
    },
    onBLEConnectionStateChange: {
      target: 'onBLEConnectionStateChanged',
    },
    offBLEConnectionStateChange: {
      target: 'offBLEConnectionStateChanged',
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
    chooseMedia: {
      target: 'chooseMedia',
      mapResult: mapChooseMediaResultFromImage,
    },
    chooseMessageFile: {
      target: 'chooseMessageFile',
    },
    getFuzzyLocation: {
      target: 'getFuzzyLocation',
    },
    previewMedia: {
      target: 'previewMedia',
    },
    createInterstitialAd: {
      target: 'createInterstitialAd',
    },
    createRewardedVideoAd: {
      target: 'createRewardedVideoAd',
    },
    createLivePlayerContext: {
      target: 'createLivePlayerContext',
    },
    createLivePusherContext: {
      target: 'createLivePusherContext',
    },
    getVideoInfo: {
      target: 'getVideoInfo',
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
      target: 'createAudioContext',
    },
    createWebAudioContext: {
      target: 'createWebAudioContext',
    },
    getSystemInfoAsync: {
      target: 'getSystemInfo',
    },
    openAppAuthorizeSetting: {
      target: 'openAppAuthorizeSetting',
    },
    pluginLogin: {
      target: 'pluginLogin',
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
      target: 'requestSubscribeDeviceMessage',
    },
    requestSubscribeEmployeeMessage: {
      target: 'requestSubscribeEmployeeMessage',
    },
    restartMiniProgram: {
      target: 'restartMiniProgram',
    },
    scanCode: {
      target: 'scanCode',
    },
    requestPayment: {
      target: 'requestPayment',
    },
    requestOrderPayment: {
      target: 'requestOrderPayment',
    },
    requestPluginPayment: {
      target: 'requestPluginPayment',
    },
    requestVirtualPayment: {
      target: 'requestVirtualPayment',
    },
    showShareImageMenu: {
      target: 'showShareImageMenu',
    },
    updateShareMenu: {
      target: 'updateShareMenu',
    },
    openEmbeddedMiniProgram: {
      target: 'openEmbeddedMiniProgram',
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
      target: 'getUserProfile',
    },
    getUserInfo: {
      target: 'getUserInfo',
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
      target: 'hideHomeButton',
    },
    getWindowInfo: {
      target: 'getWindowInfo',
    },
    getDeviceInfo: {
      target: 'getDeviceInfo',
    },
    getAccountInfoSync: {
      target: 'getAccountInfoSync',
    },
    setBackgroundColor: {
      target: 'setBackgroundColor',
    },
    setBackgroundTextStyle: {
      target: 'setBackgroundTextStyle',
    },
    getNetworkType: {
      target: 'getNetworkType',
    },
    getBatteryInfo: {
      target: 'getBatteryInfo',
    },
    getBatteryInfoSync: {
      target: 'getBatteryInfoSync',
    },
    getLogManager: {
      target: 'getLogManager',
    },
    nextTick: {
      target: 'nextTick',
    },
    onWindowResize: {
      target: 'onWindowResize',
    },
    offWindowResize: {
      target: 'offWindowResize',
    },
    reportAnalytics: {
      target: 'reportAnalytics',
    },
    addCard: {
      target: 'addCard',
    },
    addFileToFavorites: {
      target: 'addFileToFavorites',
    },
    addPaymentPassFinish: {
      target: 'addPaymentPassFinish',
    },
    addPaymentPassGetCertificateData: {
      target: 'addPaymentPassGetCertificateData',
    },
    addPhoneCalendar: {
      target: 'addPhoneCalendar',
    },
    addPhoneContact: {
      target: 'addPhoneContact',
    },
    addPhoneRepeatCalendar: {
      target: 'addPhoneRepeatCalendar',
    },
    addVideoToFavorites: {
      target: 'addVideoToFavorites',
    },
    authorizeForMiniProgram: {
      target: 'authorizeForMiniProgram',
    },
    authPrivateMessage: {
      target: 'authPrivateMessage',
    },
    bindEmployeeRelation: {
      target: 'bindEmployeeRelation',
    },
    canAddSecureElementPass: {
      target: 'canAddSecureElementPass',
    },
    canvasGetImageData: {
      target: 'canvasGetImageData',
    },
    canvasPutImageData: {
      target: 'canvasPutImageData',
    },
    checkDeviceSupportHevc: {
      target: 'checkDeviceSupportHevc',
    },
    checkEmployeeRelation: {
      target: 'checkEmployeeRelation',
    },
    checkIsAddedToMyMiniProgram: {
      target: 'checkIsAddedToMyMiniProgram',
    },
    checkIsOpenAccessibility: {
      target: 'checkIsOpenAccessibility',
    },
    checkIsPictureInPictureActive: {
      target: 'checkIsPictureInPictureActive',
    },
    checkIsSoterEnrolledInDevice: {
      target: 'checkIsSoterEnrolledInDevice',
    },
    checkIsSupportSoterAuthentication: {
      target: 'checkIsSupportSoterAuthentication',
    },
    openCard: {
      target: 'openCard',
    },
    openChannelsActivity: {
      target: 'openChannelsActivity',
    },
    openChannelsEvent: {
      target: 'openChannelsEvent',
    },
    openChannelsLive: {
      target: 'openChannelsLive',
    },
    openChannelsLiveNoticeInfo: {
      target: 'openChannelsLiveNoticeInfo',
    },
    openChannelsUserProfile: {
      target: 'openChannelsUserProfile',
    },
    openChatTool: {
      target: 'openChatTool',
    },
    openHKOfflinePayView: {
      target: 'openHKOfflinePayView',
    },
    openInquiriesTopic: {
      target: 'openInquiriesTopic',
    },
    openOfficialAccountArticle: {
      target: 'openOfficialAccountArticle',
    },
    openOfficialAccountChat: {
      target: 'openOfficialAccountChat',
    },
    openOfficialAccountProfile: {
      target: 'openOfficialAccountProfile',
    },
    openPrivacyContract: {
      target: 'openPrivacyContract',
    },
    openSystemBluetoothSetting: {
      target: 'openSystemBluetoothSetting',
    },
    reportEvent: {
      target: 'reportEvent',
    },
    reportMonitor: {
      target: 'reportMonitor',
    },
    reportPerformance: {
      target: 'reportPerformance',
    },
    openSingleStickerView: {
      target: 'openSingleStickerView',
    },
    openStickerIPView: {
      target: 'openStickerIPView',
    },
    openStickerSetView: {
      target: 'openStickerSetView',
    },
    openStoreCouponDetail: {
      target: 'openStoreCouponDetail',
    },
    openStoreOrderDetail: {
      target: 'openStoreOrderDetail',
    },
    pauseBackgroundAudio: {
      target: 'pauseBackgroundAudio',
    },
    pauseVoice: {
      target: 'pauseVoice',
    },
    playBackgroundAudio: {
      target: 'playBackgroundAudio',
    },
    playVoice: {
      target: 'playVoice',
    },
    postMessageToReferrerMiniProgram: {
      target: 'postMessageToReferrerMiniProgram',
    },
    postMessageToReferrerPage: {
      target: 'postMessageToReferrerPage',
    },
    preDownloadSubpackage: {
      target: 'preDownloadSubpackage',
    },
    preloadAssets: {
      target: 'preloadAssets',
    },
    preloadSkylineView: {
      target: 'preloadSkylineView',
    },
    preloadWebview: {
      target: 'preloadWebview',
    },
    removeSecureElementPass: {
      target: 'removeSecureElementPass',
    },
    chooseInvoiceTitle: {
      target: 'chooseInvoiceTitle',
    },
    chooseLicensePlate: {
      target: 'chooseLicensePlate',
    },
    choosePoi: {
      target: 'choosePoi',
    },
    closeBLEConnection: {
      target: 'closeBLEConnection',
    },
    createBLEConnection: {
      target: 'createBLEConnection',
    },
    cropImage: {
      target: 'cropImage',
    },
    editImage: {
      target: 'editImage',
    },
    exitVoIPChat: {
      target: 'exitVoIPChat',
    },
    faceDetect: {
      target: 'faceDetect',
    },
    getApiCategory: {
      target: 'getApiCategory',
    },
    getBackgroundFetchToken: {
      target: 'getBackgroundFetchToken',
    },
    getChannelsLiveInfo: {
      target: 'getChannelsLiveInfo',
    },
    getChannelsLiveNoticeInfo: {
      target: 'getChannelsLiveNoticeInfo',
    },
    getChannelsShareKey: {
      target: 'getChannelsShareKey',
    },
    getChatToolInfo: {
      target: 'getChatToolInfo',
    },
    getCommonConfig: {
      target: 'getCommonConfig',
    },
    getGroupEnterInfo: {
      target: 'getGroupEnterInfo',
    },
    getPrivacySetting: {
      target: 'getPrivacySetting',
    },
    initFaceDetect: {
      target: 'initFaceDetect',
    },
    join1v1Chat: {
      target: 'join1v1Chat',
    },
    requestCommonPayment: {
      target: 'requestCommonPayment',
    },
    requestDeviceVoIP: {
      target: 'requestDeviceVoIP',
    },
    requestMerchantTransfer: {
      target: 'requestMerchantTransfer',
    },
    requirePrivacyAuthorize: {
      target: 'requirePrivacyAuthorize',
    },
    reserveChannelsLive: {
      target: 'reserveChannelsLive',
    },
    selectGroupMembers: {
      target: 'selectGroupMembers',
    },
    sendHCEMessage: {
      target: 'sendHCEMessage',
    },
    sendSms: {
      target: 'sendSms',
    },
    setBackgroundFetchToken: {
      target: 'setBackgroundFetchToken',
    },
    setEnable1v1Chat: {
      target: 'setEnable1v1Chat',
    },
    setTopBarText: {
      target: 'setTopBarText',
    },
    setWindowSize: {
      target: 'setWindowSize',
    },
    stopHCE: {
      target: 'stopHCE',
    },
    stopLocalServiceDiscovery: {
      target: 'stopLocalServiceDiscovery',
    },
    stopLocationUpdate: {
      target: 'stopLocationUpdate',
    },
    stopRecord: {
      target: 'stopRecord',
    },
    stopVoice: {
      target: 'stopVoice',
    },
    subscribeVoIPVideoMembers: {
      target: 'subscribeVoIPVideoMembers',
    },
    updateVoIPChatMuteConfig: {
      target: 'updateVoIPChatMuteConfig',
    },
    updateWeChatApp: {
      target: 'updateWeChatApp',
    },
    getBackgroundAudioPlayerState: {
      target: 'getBackgroundAudioPlayerState',
    },
    getDeviceBenchmarkInfo: {
      target: 'getDeviceBenchmarkInfo',
    },
    getDeviceVoIPList: {
      target: 'getDeviceVoIPList',
    },
    getHCEState: {
      target: 'getHCEState',
    },
    getInferenceEnvInfo: {
      target: 'getInferenceEnvInfo',
    },
    getNFCAdapter: {
      target: 'getNFCAdapter',
    },
    getPerformance: {
      target: 'getPerformance',
    },
    getRandomValues: {
      target: 'getRandomValues',
    },
    getRealtimeLogManager: {
      target: 'getRealtimeLogManager',
    },
    getRendererUserAgent: {
      target: 'getRendererUserAgent',
    },
    getScreenRecordingState: {
      target: 'getScreenRecordingState',
    },
    getSecureElementPasses: {
      target: 'getSecureElementPasses',
    },
    getSelectedTextRange: {
      target: 'getSelectedTextRange',
    },
    getShowSplashAdStatus: {
      target: 'getShowSplashAdStatus',
    },
    getSkylineInfo: {
      target: 'getSkylineInfo',
    },
    getUserCryptoManager: {
      target: 'getUserCryptoManager',
    },
    getWeRunData: {
      target: 'getWeRunData',
    },
    getXrFrameSystem: {
      target: 'getXrFrameSystem',
    },
    isBluetoothDevicePaired: {
      target: 'isBluetoothDevicePaired',
    },
    isVKSupport: {
      target: 'isVKSupport',
    },
    createBLEPeripheralServer: {
      target: 'createBLEPeripheralServer',
    },
    createBufferURL: {
      target: 'createBufferURL',
    },
    createCacheManager: {
      target: 'createCacheManager',
    },
    createGlobalPayment: {
      target: 'createGlobalPayment',
    },
    createInferenceSession: {
      target: 'createInferenceSession',
    },
    createMediaAudioPlayer: {
      target: 'createMediaAudioPlayer',
    },
    createMediaContainer: {
      target: 'createMediaContainer',
    },
    createMediaRecorder: {
      target: 'createMediaRecorder',
    },
    createTCPSocket: {
      target: 'createTCPSocket',
    },
    createUDPSocket: {
      target: 'createUDPSocket',
    },
    createVideoDecoder: {
      target: 'createVideoDecoder',
    },
    loadBuiltInFontFace: {
      target: 'loadBuiltInFontFace',
    },
    notifyGroupMembers: {
      target: 'notifyGroupMembers',
    },
    requestIdleCallback: {
      target: 'requestIdleCallback',
    },
    revokeBufferURL: {
      target: 'revokeBufferURL',
    },
    rewriteRoute: {
      target: 'rewriteRoute',
    },
    seekBackgroundAudio: {
      target: 'seekBackgroundAudio',
    },
    setEnableDebug: {
      target: 'setEnableDebug',
    },
    setInnerAudioOption: {
      target: 'setInnerAudioOption',
    },
    shareAppMessageToGroup: {
      target: 'shareAppMessageToGroup',
    },
    shareEmojiToGroup: {
      target: 'shareEmojiToGroup',
    },
    shareFileMessage: {
      target: 'shareFileMessage',
    },
    shareFileToGroup: {
      target: 'shareFileToGroup',
    },
    shareImageToGroup: {
      target: 'shareImageToGroup',
    },
    shareToOfficialAccount: {
      target: 'shareToOfficialAccount',
    },
    shareToWeRun: {
      target: 'shareToWeRun',
    },
    shareVideoMessage: {
      target: 'shareVideoMessage',
    },
    shareVideoToGroup: {
      target: 'shareVideoToGroup',
    },
    showRedPackage: {
      target: 'showRedPackage',
    },
    startDeviceMotionListening: {
      target: 'startDeviceMotionListening',
    },
    startHCE: {
      target: 'startHCE',
    },
    startLocalServiceDiscovery: {
      target: 'startLocalServiceDiscovery',
    },
    startLocationUpdate: {
      target: 'startLocationUpdate',
    },
    startLocationUpdateBackground: {
      target: 'startLocationUpdateBackground',
    },
    startRecord: {
      target: 'startRecord',
    },
    startSoterAuthentication: {
      target: 'startSoterAuthentication',
    },
    stopBackgroundAudio: {
      target: 'stopBackgroundAudio',
    },
    stopDeviceMotionListening: {
      target: 'stopDeviceMotionListening',
    },
    stopFaceDetect: {
      target: 'stopFaceDetect',
    },
    openCustomerServiceChat: {
      target: 'openCustomerServiceChat',
    },
    createVKSession: {
      target: 'createVKSession',
    },
    compressVideo: {
      target: 'compressVideo',
    },
    openVideoEditor: {
      target: 'openVideoEditor',
    },
    getShareInfo: {
      target: 'getShareInfo',
    },
    joinVoIPChat: {
      target: 'joinVoIPChat',
    },
    openDocument: {
      target: 'openDocument',
    },
    saveVideoToPhotosAlbum: {
      target: 'saveVideoToPhotosAlbum',
    },
    batchSetStorage: {
      target: 'batchSetStorage',
    },
    batchGetStorage: {
      target: 'batchGetStorage',
    },
    batchSetStorageSync: {
      target: 'batchSetStorageSync',
    },
    batchGetStorageSync: {
      target: 'batchGetStorageSync',
    },
    createCameraContext: {
      target: 'createCameraContext',
    },
    offMemoryWarning: {
      target: 'offMemoryWarning',
    },
    cancelIdleCallback: {
      target: 'cancelIdleCallback',
    },
    onBLEConnectionStateChange: {
      target: 'onBLEConnectionStateChange',
    },
    offBLEConnectionStateChange: {
      target: 'offBLEConnectionStateChange',
    },
  },
}
