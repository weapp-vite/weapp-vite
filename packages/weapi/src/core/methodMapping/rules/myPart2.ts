import type { WeapiMethodMappingRule } from '../types'
import { mapCheckIsSoterEnrolledInDeviceArgs, mapCloseBleConnectionResult, mapCreateBleConnectionResult, mapSoterCheckResult } from './helpers'

export const MY_METHOD_MAPPINGS_PART_2: Readonly<Record<string, WeapiMethodMappingRule>> = {
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
}
