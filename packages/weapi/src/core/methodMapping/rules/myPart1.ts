import type { WeapiMethodMappingRule } from '../types'
import { mapActionSheetArgs, mapActionSheetResult, mapChooseImageResult, mapClipboardResult, mapCreateRewardedVideoAdArgs, mapLoadingArgs, mapModalArgs, mapModalResult, mapRewardedAdInstance, mapSaveFileArgs, mapSaveFileResult, mapSetClipboardArgs, mapToastArgs } from './helpers'

export const MY_METHOD_MAPPINGS_PART_1: Readonly<Record<string, WeapiMethodMappingRule>> = {
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
}
