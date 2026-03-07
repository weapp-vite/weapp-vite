import type {
  WeapiCrossPlatformRawAdapter,
  WeapiDefaultInstance,
  WeapiDouyinRawAdapter,
  WeapiMethodSupportQueryOptions,
  WeapiResolvedTarget,
  WeapiSupportLevel,
} from '@wevu/api'
import { createWeapi, wpi } from '@wevu/api'
import { expectType } from 'tsd'

type AssertTrue<T extends true> = T
type IsNever<T> = [T] extends [never] ? true : false
type ExtractMethodKeys<T> = Extract<{
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T], string>

type WxMethodKeys = ExtractMethodKeys<WechatMiniprogram.Wx>
type MyMethodKeys = ExtractMethodKeys<typeof my>
type TtMethodKeys = ExtractMethodKeys<typeof tt>
type WeapiDefaultKeys = Extract<keyof WeapiDefaultInstance, string>
type WeapiRawKeys = Extract<keyof WeapiCrossPlatformRawAdapter, string>

type _wxMethodCoverage = AssertTrue<IsNever<Exclude<WxMethodKeys, WeapiDefaultKeys>>>
type _myMethodCoverage = AssertTrue<IsNever<Exclude<MyMethodKeys, WeapiRawKeys>>>
type _ttMethodCoverage = AssertTrue<IsNever<Exclude<TtMethodKeys, WeapiRawKeys>>>

expectType<string | undefined>(wpi.platform)
expectType<WeapiDefaultInstance>(wpi)
expectType<WeapiDefaultInstance['raw']>(wpi.raw)
expectType<WeapiDefaultInstance['showToast']>(wpi.showToast)
expectType<WeapiDefaultInstance['confirm']>(wpi.confirm)
expectType<WeapiResolvedTarget>(wpi.resolveTarget('showModal'))
expectType<boolean>(wpi.supports('showModal'))
expectType<boolean>(wpi.supports('showModal', { semantic: true } satisfies WeapiMethodSupportQueryOptions))
expectType<WeapiSupportLevel>(wpi.resolveTarget('showModal').supportLevel)
expectType<boolean>(wpi.resolveTarget('showModal').semanticAligned)

expectType<WechatMiniprogram.SystemInfo>(wpi.getSystemInfoSync())
expectType<WeapiDouyinRawAdapter>(tt)
expectType<void>(wpi.onMemoryWarning(() => {}))
expectType<void>(wpi.offMemoryWarning(() => {}))

const _requestPromise = wpi.request({
  url: 'https://example.com',
})
expectType<WeapiDefaultInstance['request']>(wpi.request)
expectType<WeapiDefaultInstance['canvasGetImageData']>(wpi.canvasGetImageData)
expectType<WeapiDefaultInstance['canvasPutImageData']>(wpi.canvasPutImageData)
expectType<WeapiDefaultInstance['checkDeviceSupportHevc']>(wpi.checkDeviceSupportHevc)
expectType<WeapiDefaultInstance['checkEmployeeRelation']>(wpi.checkEmployeeRelation)
expectType<WeapiDefaultInstance['checkIsAddedToMyMiniProgram']>(wpi.checkIsAddedToMyMiniProgram)
expectType<WeapiDefaultInstance['checkIsOpenAccessibility']>(wpi.checkIsOpenAccessibility)
expectType<WeapiDefaultInstance['checkIsPictureInPictureActive']>(wpi.checkIsPictureInPictureActive)
expectType<WeapiDefaultInstance['checkIsSoterEnrolledInDevice']>(wpi.checkIsSoterEnrolledInDevice)
expectType<WeapiDefaultInstance['checkIsSupportSoterAuthentication']>(wpi.checkIsSupportSoterAuthentication)
expectType<WeapiDefaultInstance['openCard']>(wpi.openCard)
expectType<WeapiDefaultInstance['openChannelsActivity']>(wpi.openChannelsActivity)
expectType<WeapiDefaultInstance['openChannelsEvent']>(wpi.openChannelsEvent)
expectType<WeapiDefaultInstance['openChannelsLive']>(wpi.openChannelsLive)
expectType<WeapiDefaultInstance['openChannelsLiveNoticeInfo']>(wpi.openChannelsLiveNoticeInfo)
expectType<WeapiDefaultInstance['openChannelsUserProfile']>(wpi.openChannelsUserProfile)
expectType<WeapiDefaultInstance['openChatTool']>(wpi.openChatTool)
expectType<WeapiDefaultInstance['openHKOfflinePayView']>(wpi.openHKOfflinePayView)
expectType<WeapiDefaultInstance['openInquiriesTopic']>(wpi.openInquiriesTopic)
expectType<WeapiDefaultInstance['openOfficialAccountArticle']>(wpi.openOfficialAccountArticle)
expectType<WeapiDefaultInstance['openOfficialAccountChat']>(wpi.openOfficialAccountChat)
expectType<WeapiDefaultInstance['openOfficialAccountProfile']>(wpi.openOfficialAccountProfile)
expectType<WeapiDefaultInstance['openPrivacyContract']>(wpi.openPrivacyContract)
expectType<WeapiDefaultInstance['openSystemBluetoothSetting']>(wpi.openSystemBluetoothSetting)
expectType<WeapiDefaultInstance['reportEvent']>(wpi.reportEvent)
expectType<WeapiDefaultInstance['reportMonitor']>(wpi.reportMonitor)
expectType<WeapiDefaultInstance['reportPerformance']>(wpi.reportPerformance)
expectType<WeapiDefaultInstance['openSingleStickerView']>(wpi.openSingleStickerView)
expectType<WeapiDefaultInstance['openStickerIPView']>(wpi.openStickerIPView)
expectType<WeapiDefaultInstance['openStickerSetView']>(wpi.openStickerSetView)
expectType<WeapiDefaultInstance['openStoreCouponDetail']>(wpi.openStoreCouponDetail)
expectType<WeapiDefaultInstance['openStoreOrderDetail']>(wpi.openStoreOrderDetail)
expectType<WeapiDefaultInstance['pauseBackgroundAudio']>(wpi.pauseBackgroundAudio)
expectType<WeapiDefaultInstance['pauseVoice']>(wpi.pauseVoice)
expectType<WeapiDefaultInstance['playBackgroundAudio']>(wpi.playBackgroundAudio)
expectType<WeapiDefaultInstance['playVoice']>(wpi.playVoice)
expectType<WeapiDefaultInstance['postMessageToReferrerMiniProgram']>(wpi.postMessageToReferrerMiniProgram)
expectType<WeapiDefaultInstance['postMessageToReferrerPage']>(wpi.postMessageToReferrerPage)
expectType<WeapiDefaultInstance['preDownloadSubpackage']>(wpi.preDownloadSubpackage)
expectType<WeapiDefaultInstance['preloadAssets']>(wpi.preloadAssets)
expectType<WeapiDefaultInstance['preloadSkylineView']>(wpi.preloadSkylineView)
expectType<WeapiDefaultInstance['preloadWebview']>(wpi.preloadWebview)
expectType<WeapiDefaultInstance['removeSecureElementPass']>(wpi.removeSecureElementPass)
expectType<WeapiDefaultInstance['chooseInvoiceTitle']>(wpi.chooseInvoiceTitle)
expectType<WeapiDefaultInstance['chooseLicensePlate']>(wpi.chooseLicensePlate)
expectType<WeapiDefaultInstance['choosePoi']>(wpi.choosePoi)
expectType<WeapiDefaultInstance['closeBLEConnection']>(wpi.closeBLEConnection)
expectType<WeapiDefaultInstance['createBLEConnection']>(wpi.createBLEConnection)
expectType<WeapiDefaultInstance['cropImage']>(wpi.cropImage)
expectType<WeapiDefaultInstance['editImage']>(wpi.editImage)
expectType<WeapiDefaultInstance['exitVoIPChat']>(wpi.exitVoIPChat)
expectType<WeapiDefaultInstance['faceDetect']>(wpi.faceDetect)
expectType<WeapiDefaultInstance['getApiCategory']>(wpi.getApiCategory)
expectType<WeapiDefaultInstance['getBackgroundFetchToken']>(wpi.getBackgroundFetchToken)
expectType<WeapiDefaultInstance['getChannelsLiveInfo']>(wpi.getChannelsLiveInfo)
expectType<WeapiDefaultInstance['getChannelsLiveNoticeInfo']>(wpi.getChannelsLiveNoticeInfo)
expectType<WeapiDefaultInstance['getChannelsShareKey']>(wpi.getChannelsShareKey)
expectType<WeapiDefaultInstance['getChatToolInfo']>(wpi.getChatToolInfo)
expectType<WeapiDefaultInstance['getCommonConfig']>(wpi.getCommonConfig)
expectType<WeapiDefaultInstance['getGroupEnterInfo']>(wpi.getGroupEnterInfo)
expectType<WeapiDefaultInstance['getPrivacySetting']>(wpi.getPrivacySetting)
expectType<WeapiDefaultInstance['initFaceDetect']>(wpi.initFaceDetect)
expectType<WeapiDefaultInstance['join1v1Chat']>(wpi.join1v1Chat)
expectType<WeapiDefaultInstance['shareAppMessageToGroup']>(wpi.shareAppMessageToGroup)
expectType<WeapiDefaultInstance['shareEmojiToGroup']>(wpi.shareEmojiToGroup)
expectType<WeapiDefaultInstance['shareFileMessage']>(wpi.shareFileMessage)
expectType<WeapiDefaultInstance['shareFileToGroup']>(wpi.shareFileToGroup)
expectType<WeapiDefaultInstance['shareImageToGroup']>(wpi.shareImageToGroup)
expectType<WeapiDefaultInstance['shareToOfficialAccount']>(wpi.shareToOfficialAccount)
expectType<WeapiDefaultInstance['shareToWeRun']>(wpi.shareToWeRun)
expectType<WeapiDefaultInstance['shareVideoMessage']>(wpi.shareVideoMessage)
expectType<WeapiDefaultInstance['shareVideoToGroup']>(wpi.shareVideoToGroup)
expectType<WeapiDefaultInstance['showRedPackage']>(wpi.showRedPackage)
expectType<WeapiDefaultInstance['startDeviceMotionListening']>(wpi.startDeviceMotionListening)
expectType<WeapiDefaultInstance['startHCE']>(wpi.startHCE)
expectType<WeapiDefaultInstance['startLocalServiceDiscovery']>(wpi.startLocalServiceDiscovery)
expectType<WeapiDefaultInstance['startLocationUpdate']>(wpi.startLocationUpdate)
expectType<WeapiDefaultInstance['startLocationUpdateBackground']>(wpi.startLocationUpdateBackground)
expectType<WeapiDefaultInstance['startRecord']>(wpi.startRecord)
expectType<WeapiDefaultInstance['startSoterAuthentication']>(wpi.startSoterAuthentication)
expectType<WeapiDefaultInstance['stopBackgroundAudio']>(wpi.stopBackgroundAudio)
expectType<WeapiDefaultInstance['stopDeviceMotionListening']>(wpi.stopDeviceMotionListening)
expectType<WeapiDefaultInstance['stopFaceDetect']>(wpi.stopFaceDetect)
expectType<WeapiDefaultInstance['requestCommonPayment']>(wpi.requestCommonPayment)
expectType<WeapiDefaultInstance['requestDeviceVoIP']>(wpi.requestDeviceVoIP)
expectType<WeapiDefaultInstance['requestMerchantTransfer']>(wpi.requestMerchantTransfer)
expectType<WeapiDefaultInstance['requirePrivacyAuthorize']>(wpi.requirePrivacyAuthorize)
expectType<WeapiDefaultInstance['reserveChannelsLive']>(wpi.reserveChannelsLive)
expectType<WeapiDefaultInstance['selectGroupMembers']>(wpi.selectGroupMembers)
expectType<WeapiDefaultInstance['sendHCEMessage']>(wpi.sendHCEMessage)
expectType<WeapiDefaultInstance['sendSms']>(wpi.sendSms)
expectType<WeapiDefaultInstance['setBackgroundFetchToken']>(wpi.setBackgroundFetchToken)
expectType<WeapiDefaultInstance['setEnable1v1Chat']>(wpi.setEnable1v1Chat)
expectType<WeapiDefaultInstance['setTopBarText']>(wpi.setTopBarText)
expectType<WeapiDefaultInstance['setWindowSize']>(wpi.setWindowSize)
expectType<WeapiDefaultInstance['stopHCE']>(wpi.stopHCE)
expectType<WeapiDefaultInstance['stopLocalServiceDiscovery']>(wpi.stopLocalServiceDiscovery)
expectType<WeapiDefaultInstance['stopLocationUpdate']>(wpi.stopLocationUpdate)
expectType<WeapiDefaultInstance['stopRecord']>(wpi.stopRecord)
expectType<WeapiDefaultInstance['stopVoice']>(wpi.stopVoice)
expectType<WeapiDefaultInstance['subscribeVoIPVideoMembers']>(wpi.subscribeVoIPVideoMembers)
expectType<WeapiDefaultInstance['updateVoIPChatMuteConfig']>(wpi.updateVoIPChatMuteConfig)
expectType<WeapiDefaultInstance['updateWeChatApp']>(wpi.updateWeChatApp)

const requestTask = wpi.request({
  url: 'https://example.com',
  success: () => {},
})
expectType<ReturnType<WeapiDefaultInstance['request']>>(requestTask)

const saveFilePromise = wpi.saveFile({
  apFilePath: '/tmp/demo.png',
  filePath: '/tmp/demo.png',
})
expectType<ReturnType<WeapiDefaultInstance['saveFile']>>(saveFilePromise)

const clipboardPromise = wpi.getClipboardData()
expectType<Promise<WechatMiniprogram.GetClipboardDataSuccessCallbackOption>>(clipboardPromise)

interface CustomAdapter {
  foo: (option: { success?: (res: { ok: true }) => void }) => number
  bazSync: (value: string) => number
  onReady: (callback: () => void) => void
}

const custom = createWeapi<CustomAdapter>()
const strictCustom = createWeapi<CustomAdapter>({ strictCompatibility: true })

const fooPromise = custom.foo({})
expectType<Promise<{ ok: true }>>(fooPromise)

const fooReturn = custom.foo({
  success: (res) => {
    expectType<{ ok: true }>(res)
  },
})
expectType<number>(fooReturn)

expectType<number>(custom.bazSync('ok'))
expectType<void>(custom.onReady(() => {}))
expectType<void>(strictCustom.onReady(() => {}))
