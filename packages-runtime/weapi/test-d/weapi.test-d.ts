import type {
  WeapiAlipayMethodName,
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiCrossPlatformRawAdapter,
  WeapiDefaultInstance,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiDouyinMethodName,
  WeapiDouyinMiniProgramRawAdapterSource,
  WeapiDouyinRawAdapter,
  WeapiError,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiMiniProgramAdapter,
  WeapiMiniProgramAlipayMethodName,
  WeapiMiniProgramAlipayRawAdapter,
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramCrossPlatformRawAdapter,
  WeapiMiniProgramDouyinMethodName,
  WeapiMiniProgramDouyinRawAdapter,
  WeapiMiniProgramGeneralCallbackResult,
  WeapiMiniProgramLogManager,
  WeapiMiniProgramMethodName,
  WeapiMiniProgramPlatformRawAdapterSourceName,
  WeapiMiniProgramPlatformRawAdapterSourceRegistry,
  WeapiMiniProgramRawAdapter,
  WeapiMiniProgramRawAdapterSourceName,
  WeapiMiniProgramRequestFailResult,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramRuntimeRawAdapterSourceName,
  WeapiMiniProgramRuntimeRawAdapterSourceRegistry,
  WeapiMiniProgramSelectorQuery,
  WeapiMiniProgramSocketTask,
  WeapiMiniProgramSystemInfo,
  WeapiMiniProgramUpdateManager,
  WeapiMiniProgramVideoContext,
  WeapiMiniProgramWechatMethodName,
  WeapiMiniProgramWechatRawAdapter,
  WeapiMiniProgramWxAdapter,
  WeapiMiniProgramWxMethodName,
  WeapiMiniProgramWxRawAdapter,
  WeapiPlatformTypeSourceName,
  WeapiPromise,
  WeapiResolvedTarget,
  WeapiRuntimeTypeSourceName,
  WeapiSupportLevel,
  WeapiTtMiniProgramRawAdapterSource,
  WeapiTypeSourceName,
  WeapiWechatMethodName,
  WeapiWechatMiniProgramRawAdapterSource,
  WeapiWechatRawAdapter,
} from '@wevu/api'
import {
  createWeapi,
  WEAPI_PLATFORM_TYPE_SOURCES,
  WEAPI_RUNTIME_TYPE_SOURCES,
  WEAPI_TYPE_SOURCES,
  wpi,
} from '@wevu/api'
import { expectAssignable, expectError, expectType } from 'tsd'

type AssertTrue<T extends true> = T
type IsNever<T> = [T] extends [never] ? true : false
type ExtractMethodKeys<T> = Extract<{
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T], string>

type WxMethodKeys = ExtractMethodKeys<WeapiWechatMiniProgramRawAdapterSource>
type MyMethodKeys = ExtractMethodKeys<typeof my>
type TtMethodKeys = ExtractMethodKeys<typeof tt>
type WeapiDefaultKeys = Extract<keyof WeapiDefaultInstance, string>
type WeapiRawKeys = Extract<keyof WeapiCrossPlatformRawAdapter, string>
type AlipayMethodKeys = WeapiMiniProgramAlipayMethodName
type DouyinMethodKeys = WeapiMiniProgramDouyinMethodName
type MiniProgramMethodKeys = WeapiMiniProgramMethodName
type WechatMethodKeys = WeapiMiniProgramWechatMethodName

type _wxMethodCoverage = AssertTrue<IsNever<Exclude<WxMethodKeys, WeapiDefaultKeys>>>
type _miniProgramWechatMethodCoverage = AssertTrue<IsNever<Exclude<WechatMethodKeys, MiniProgramMethodKeys>>>
type _miniProgramAlipayMethodCoverage = AssertTrue<IsNever<Exclude<AlipayMethodKeys, WeapiRawKeys>>>
type _miniProgramMethodCoverage = AssertTrue<IsNever<Exclude<MiniProgramMethodKeys, WeapiDefaultKeys>>>
type _miniProgramWxMethodCoverage = AssertTrue<IsNever<Exclude<WeapiMiniProgramWxMethodName, WechatMethodKeys>>>
type _myMethodCoverage = AssertTrue<IsNever<Exclude<MyMethodKeys, WeapiRawKeys>>>
type _ttMethodCoverage = AssertTrue<IsNever<Exclude<TtMethodKeys, WeapiRawKeys>>>

expectType<string | undefined>(wpi.platform)
expectAssignable<WeapiError>({ errMsg: 'failed' })
expectAssignable<WeapiError>({ errMsg: 'failed', errno: 10001 })
expectType<DouyinMethodKeys>('showToast' as DouyinMethodKeys)
expectType<WeapiWechatMethodName>('showToast' as WeapiWechatMethodName)
expectType<WeapiAlipayMethodName>('alert' as WeapiAlipayMethodName)
expectType<WeapiDouyinMethodName>('showToast' as WeapiDouyinMethodName)
expectType<WeapiDefaultInstance>(wpi)
expectType<WeapiMiniProgramAdapter>(wpi as WeapiMiniProgramAdapter)
expectType<WeapiInstance<WeapiMiniProgramCrossPlatformRawAdapter>>(wpi)
expectType<WeapiMiniProgramRawAdapter>({} as WeapiMiniProgramRawAdapter)
expectType<WeapiDefaultMiniProgramRawAdapterSource>({} as WeapiMiniProgramRawAdapter)
expectType<WeapiMiniProgramCrossPlatformRawAdapter>({} as WeapiCrossPlatformRawAdapter)
expectType<WeapiWechatRawAdapter>({} as WeapiMiniProgramRawAdapter)
expectType<WeapiMiniProgramWechatRawAdapter>({} as WeapiMiniProgramRawAdapter)
expectType<WeapiMiniProgramWxRawAdapter>({} as WeapiMiniProgramRawAdapter)
expectType<WeapiWechatMiniProgramRawAdapterSource>({} as WeapiMiniProgramWechatRawAdapter)
expectType<WeapiWechatMiniProgramRawAdapterSource>({} as WeapiMiniProgramWxRawAdapter)
expectType<WeapiMiniProgramWxAdapter>(wpi as WeapiMiniProgramWxAdapter)
expectType<WechatMiniprogram.RequestOption>({} as WeapiMiniProgramRequestOption)
expectType<WechatMiniprogram.RequestTask>({} as WeapiMiniProgramRequestTask)
expectType<WechatMiniprogram.RequestSuccessCallbackResult>({} as WeapiMiniProgramRequestSuccessResult)
expectType<WechatMiniprogram.RequestFailCallbackErr>({} as WeapiMiniProgramRequestFailResult)
expectType<WechatMiniprogram.GeneralCallbackResult>({} as WeapiMiniProgramGeneralCallbackResult)
expectType<WechatMiniprogram.ConnectSocketOption>({} as WeapiMiniProgramConnectSocketOption)
expectType<WechatMiniprogram.SocketTask>({} as WeapiMiniProgramSocketTask)
expectType<WechatMiniprogram.SystemInfo>({} as WeapiMiniProgramSystemInfo)
expectType<WechatMiniprogram.UpdateManager>({} as WeapiMiniProgramUpdateManager)
expectType<WechatMiniprogram.LogManager>({} as WeapiMiniProgramLogManager)
expectType<WechatMiniprogram.VideoContext>({} as WeapiMiniProgramVideoContext)
expectType<WechatMiniprogram.SelectorQuery>({} as WeapiMiniProgramSelectorQuery)
expectType<WechatMiniprogram.BluetoothError>({} as WeapiMiniProgramBluetoothError)
expectType<WechatMiniprogram.GetClipboardDataSuccessCallbackOption>({} as WeapiMiniProgramClipboardDataResult)
expectType<WeapiMiniProgramAlipayRawAdapter>(my)
expectType<WeapiAlipayMiniProgramRawAdapterSource>(my)
expectType<WeapiMiniProgramAlipayRawAdapter>({} as WeapiAlipayMiniProgramRawAdapterSource)
expectType<WeapiInstance<WeapiMiniProgramAlipayRawAdapter>>(createWeapi({ adapter: my }))
expectType<WeapiMiniProgramDouyinRawAdapter>(tt)
expectType<WeapiDouyinMiniProgramRawAdapterSource>(tt)
expectType<WeapiTtMiniProgramRawAdapterSource>(tt)
expectType<WeapiDouyinMiniProgramRawAdapterSource>({} as WeapiTtMiniProgramRawAdapterSource)
expectType<WeapiMiniProgramDouyinRawAdapter>({} as WeapiTtMiniProgramRawAdapterSource)
expectType<WeapiInstance<WeapiMiniProgramDouyinRawAdapter>>(createWeapi({ adapter: tt }))
expectAssignable<WeapiMiniProgramRawAdapterSourceName>('default')
expectAssignable<WeapiMiniProgramRawAdapterSourceName>('wechat')
expectAssignable<WeapiMiniProgramRawAdapterSourceName>('alipay')
expectAssignable<WeapiMiniProgramRawAdapterSourceName>('douyin')
expectAssignable<WeapiMiniProgramRawAdapterSourceName>('wx')
expectAssignable<WeapiMiniProgramRawAdapterSourceName>('my')
expectAssignable<WeapiMiniProgramRawAdapterSourceName>('tt')
expectAssignable<WeapiMiniProgramPlatformRawAdapterSourceName>('default')
expectAssignable<WeapiMiniProgramPlatformRawAdapterSourceName>('wechat')
expectAssignable<WeapiMiniProgramPlatformRawAdapterSourceName>('alipay')
expectAssignable<WeapiMiniProgramPlatformRawAdapterSourceName>('douyin')
expectAssignable<WeapiMiniProgramRuntimeRawAdapterSourceName>('wx')
expectAssignable<WeapiMiniProgramRuntimeRawAdapterSourceName>('my')
expectAssignable<WeapiMiniProgramRuntimeRawAdapterSourceName>('tt')
expectAssignable<WeapiPlatformTypeSourceName>('default')
expectAssignable<WeapiPlatformTypeSourceName>('wechat')
expectAssignable<WeapiPlatformTypeSourceName>('alipay')
expectAssignable<WeapiPlatformTypeSourceName>('douyin')
expectAssignable<WeapiRuntimeTypeSourceName>('wx')
expectAssignable<WeapiRuntimeTypeSourceName>('my')
expectAssignable<WeapiRuntimeTypeSourceName>('tt')
expectAssignable<WeapiTypeSourceName>('default')
expectAssignable<WeapiTypeSourceName>('douyin')
expectAssignable<WeapiTypeSourceName>('wx')
expectType<'miniprogram-api-typings'>(WEAPI_PLATFORM_TYPE_SOURCES.default.package)
expectType<'miniprogram-api-typings'>(WEAPI_PLATFORM_TYPE_SOURCES.wechat.package)
expectType<'@mini-types/alipay'>(WEAPI_PLATFORM_TYPE_SOURCES.alipay.package)
expectType<'@douyin-microapp/typings'>(WEAPI_PLATFORM_TYPE_SOURCES.douyin.package)
expectType<'miniprogram-api-typings'>(WEAPI_RUNTIME_TYPE_SOURCES.wx.package)
expectType<'@mini-types/alipay'>(WEAPI_RUNTIME_TYPE_SOURCES.my.package)
expectType<'@douyin-microapp/typings'>(WEAPI_RUNTIME_TYPE_SOURCES.tt.package)
expectType<typeof WEAPI_PLATFORM_TYPE_SOURCES.douyin>(WEAPI_TYPE_SOURCES.douyin)
expectType<typeof WEAPI_RUNTIME_TYPE_SOURCES.wx>(WEAPI_TYPE_SOURCES.wx)
expectType<WeapiWechatMiniProgramRawAdapterSource>({} as WeapiMiniProgramPlatformRawAdapterSourceRegistry['wechat'])
expectType<WeapiAlipayMiniProgramRawAdapterSource>({} as WeapiMiniProgramPlatformRawAdapterSourceRegistry['alipay'])
expectType<WeapiDouyinMiniProgramRawAdapterSource>({} as WeapiMiniProgramPlatformRawAdapterSourceRegistry['douyin'])
expectType<WeapiTtMiniProgramRawAdapterSource>({} as WeapiMiniProgramPlatformRawAdapterSourceRegistry['douyin'])
expectType<WeapiWechatMiniProgramRawAdapterSource>({} as WeapiMiniProgramRuntimeRawAdapterSourceRegistry['wx'])
expectType<WeapiAlipayMiniProgramRawAdapterSource>({} as WeapiMiniProgramRuntimeRawAdapterSourceRegistry['my'])
expectType<WeapiTtMiniProgramRawAdapterSource>({} as WeapiMiniProgramRuntimeRawAdapterSourceRegistry['tt'])
expectType<WeapiDefaultInstance['raw']>(wpi.raw)
expectType<WeapiDefaultInstance['showToast']>(wpi.showToast)
expectType<WeapiDefaultInstance['confirm']>(wpi.confirm)
expectType<WeapiResolvedTarget>(wpi.resolveTarget('showModal'))
expectType<boolean>(wpi.supports('showModal'))
expectType<boolean>(wpi.supports('showModal', { semantic: true } satisfies WeapiMethodSupportQueryOptions))
expectType<WeapiSupportLevel>(wpi.resolveTarget('showModal').supportLevel)
expectType<boolean>(wpi.resolveTarget('showModal').semanticAligned)

expectType<WeapiMiniProgramSystemInfo>(wpi.getSystemInfoSync())
expectType<boolean>(wpi.canIUse('getUpdateManager'))
expectType<WeapiMiniProgramUpdateManager>(wpi.getUpdateManager())
expectType<WeapiMiniProgramSelectorQuery>(wpi.createSelectorQuery())
expectType<WeapiMiniProgramLogManager>(wpi.getLogManager({ level: 1 }))
expectType<WeapiMiniProgramVideoContext>(wpi.createVideoContext('demo'))
expectType<WeapiDouyinRawAdapter>(tt)
expectType<void>(wpi.onMemoryWarning(() => {}))
expectType<void>(wpi.offMemoryWarning(() => {}))

const _requestPromise = wpi.request({
  url: 'https://example.com',
})
_requestPromise.catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number>(error.errno)
})
expectAssignable<Promise<WeapiMiniProgramRequestSuccessResult>>(_requestPromise)
expectAssignable<PromiseLike<WeapiMiniProgramRequestSuccessResult>>(_requestPromise)
expectType<Promise<WeapiMiniProgramRequestSuccessResult>>(Promise.resolve(_requestPromise))

const requestThenRejected = _requestPromise.then(undefined, (error) => {
  expectType<string>(error.errMsg)
  expectType<number>(error.errno)
  return 'recovered' as const
})
expectAssignable<Promise<WeapiMiniProgramRequestSuccessResult | 'recovered'>>(requestThenRejected)

_requestPromise.then().catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number>(error.errno)
})
_requestPromise.finally(() => {}).catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number>(error.errno)
})

async function verifyAwaitCompatibility() {
  expectType<WeapiMiniProgramRequestSuccessResult>(await _requestPromise)
}
void verifyAwaitCompatibility

interface TypedPromiseError {
  code: 'TYPED_PROMISE_ERROR'
}
const typedPromise = {} as WeapiPromise<number, TypedPromiseError>
expectAssignable<Promise<number>>(typedPromise)
typedPromise.then(value => value.toString()).catch((error) => {
  expectType<TypedPromiseError>(error)
})
const defaultTypedPromise = {} as WeapiPromise<number>
defaultTypedPromise.catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errno)
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
expectType<WeapiDefaultInstance['getBackgroundAudioPlayerState']>(wpi.getBackgroundAudioPlayerState)
expectType<WeapiDefaultInstance['getDeviceBenchmarkInfo']>(wpi.getDeviceBenchmarkInfo)
expectType<WeapiDefaultInstance['getDeviceVoIPList']>(wpi.getDeviceVoIPList)
expectType<WeapiDefaultInstance['getHCEState']>(wpi.getHCEState)
expectType<WeapiDefaultInstance['getInferenceEnvInfo']>(wpi.getInferenceEnvInfo)
expectType<WeapiDefaultInstance['getNFCAdapter']>(wpi.getNFCAdapter)
expectType<WeapiDefaultInstance['getPerformance']>(wpi.getPerformance)
expectType<WeapiDefaultInstance['getRandomValues']>(wpi.getRandomValues)
expectType<WeapiDefaultInstance['getRealtimeLogManager']>(wpi.getRealtimeLogManager)
expectType<WeapiDefaultInstance['getRendererUserAgent']>(wpi.getRendererUserAgent)
expectType<WeapiDefaultInstance['getScreenRecordingState']>(wpi.getScreenRecordingState)
expectType<WeapiDefaultInstance['getSecureElementPasses']>(wpi.getSecureElementPasses)
expectType<WeapiDefaultInstance['getSelectedTextRange']>(wpi.getSelectedTextRange)
expectType<WeapiDefaultInstance['getShowSplashAdStatus']>(wpi.getShowSplashAdStatus)
expectType<WeapiDefaultInstance['getSkylineInfo']>(wpi.getSkylineInfo)
expectType<WeapiDefaultInstance['getUserCryptoManager']>(wpi.getUserCryptoManager)
expectType<WeapiDefaultInstance['getWeRunData']>(wpi.getWeRunData)
expectType<WeapiDefaultInstance['getXrFrameSystem']>(wpi.getXrFrameSystem)
expectType<WeapiDefaultInstance['isBluetoothDevicePaired']>(wpi.isBluetoothDevicePaired)
expectType<WeapiDefaultInstance['isVKSupport']>(wpi.isVKSupport)
expectType<WeapiDefaultInstance['createBLEPeripheralServer']>(wpi.createBLEPeripheralServer)
expectType<WeapiDefaultInstance['createBufferURL']>(wpi.createBufferURL)
expectType<WeapiDefaultInstance['createCacheManager']>(wpi.createCacheManager)
expectType<WeapiDefaultInstance['createGlobalPayment']>(wpi.createGlobalPayment)
expectType<WeapiDefaultInstance['createInferenceSession']>(wpi.createInferenceSession)
expectType<WeapiDefaultInstance['createMediaAudioPlayer']>(wpi.createMediaAudioPlayer)
expectType<WeapiDefaultInstance['createMediaContainer']>(wpi.createMediaContainer)
expectType<WeapiDefaultInstance['createMediaRecorder']>(wpi.createMediaRecorder)
expectType<WeapiDefaultInstance['createTCPSocket']>(wpi.createTCPSocket)
expectType<WeapiDefaultInstance['createUDPSocket']>(wpi.createUDPSocket)
expectType<WeapiDefaultInstance['createVideoDecoder']>(wpi.createVideoDecoder)
expectType<WeapiDefaultInstance['loadBuiltInFontFace']>(wpi.loadBuiltInFontFace)
expectType<WeapiDefaultInstance['notifyGroupMembers']>(wpi.notifyGroupMembers)
expectType<WeapiDefaultInstance['requestIdleCallback']>(wpi.requestIdleCallback)
expectType<WeapiDefaultInstance['revokeBufferURL']>(wpi.revokeBufferURL)
expectType<WeapiDefaultInstance['rewriteRoute']>(wpi.rewriteRoute)
expectType<WeapiDefaultInstance['seekBackgroundAudio']>(wpi.seekBackgroundAudio)
expectType<WeapiDefaultInstance['setEnableDebug']>(wpi.setEnableDebug)
expectType<WeapiDefaultInstance['setInnerAudioOption']>(wpi.setInnerAudioOption)
expectType<WeapiDefaultInstance['onAfterPageLoad']>(wpi.onAfterPageLoad)
expectType<WeapiDefaultInstance['onAfterPageUnload']>(wpi.onAfterPageUnload)
expectType<WeapiDefaultInstance['onApiCategoryChange']>(wpi.onApiCategoryChange)
expectType<WeapiDefaultInstance['onAppRoute']>(wpi.onAppRoute)
expectType<WeapiDefaultInstance['onAppRouteDone']>(wpi.onAppRouteDone)
expectType<WeapiDefaultInstance['onBackgroundAudioPause']>(wpi.onBackgroundAudioPause)
expectType<WeapiDefaultInstance['onBackgroundAudioPlay']>(wpi.onBackgroundAudioPlay)
expectType<WeapiDefaultInstance['onBackgroundAudioStop']>(wpi.onBackgroundAudioStop)
expectType<WeapiDefaultInstance['onBackgroundFetchData']>(wpi.onBackgroundFetchData)
expectType<WeapiDefaultInstance['onBatteryInfoChange']>(wpi.onBatteryInfoChange)
expectType<WeapiDefaultInstance['offAfterPageLoad']>(wpi.offAfterPageLoad)
expectType<WeapiDefaultInstance['offAfterPageUnload']>(wpi.offAfterPageUnload)
expectType<WeapiDefaultInstance['offApiCategoryChange']>(wpi.offApiCategoryChange)
expectType<WeapiDefaultInstance['offAppRoute']>(wpi.offAppRoute)
expectType<WeapiDefaultInstance['offAppRouteDone']>(wpi.offAppRouteDone)
expectType<WeapiDefaultInstance['offBatteryInfoChange']>(wpi.offBatteryInfoChange)
expectType<WeapiDefaultInstance['offBeforeAppRoute']>(wpi.offBeforeAppRoute)
expectType<WeapiDefaultInstance['offBeforePageLoad']>(wpi.offBeforePageLoad)
expectType<WeapiDefaultInstance['offBeforePageUnload']>(wpi.offBeforePageUnload)
expectType<WeapiDefaultInstance['offBLEConnectionStateChange']>(wpi.offBLEConnectionStateChange)
expectType<WeapiDefaultInstance['onBeforeAppRoute']>(wpi.onBeforeAppRoute)
expectType<WeapiDefaultInstance['onBeforePageLoad']>(wpi.onBeforePageLoad)
expectType<WeapiDefaultInstance['onBeforePageUnload']>(wpi.onBeforePageUnload)
expectType<WeapiDefaultInstance['onBLEConnectionStateChange']>(wpi.onBLEConnectionStateChange)
expectType<WeapiDefaultInstance['onBLEMTUChange']>(wpi.onBLEMTUChange)
expectType<WeapiDefaultInstance['onBLEPeripheralConnectionStateChanged']>(wpi.onBLEPeripheralConnectionStateChanged)
expectType<WeapiDefaultInstance['onCopyUrl']>(wpi.onCopyUrl)
expectType<WeapiDefaultInstance['onEmbeddedMiniProgramHeightChange']>(wpi.onEmbeddedMiniProgramHeightChange)
expectType<WeapiDefaultInstance['onGeneratePoster']>(wpi.onGeneratePoster)
expectType<WeapiDefaultInstance['onHCEMessage']>(wpi.onHCEMessage)
expectType<WeapiDefaultInstance['offBLEMTUChange']>(wpi.offBLEMTUChange)
expectType<WeapiDefaultInstance['offBLEPeripheralConnectionStateChanged']>(wpi.offBLEPeripheralConnectionStateChanged)
expectType<WeapiDefaultInstance['offCopyUrl']>(wpi.offCopyUrl)
expectType<WeapiDefaultInstance['offEmbeddedMiniProgramHeightChange']>(wpi.offEmbeddedMiniProgramHeightChange)
expectType<WeapiDefaultInstance['offGeneratePoster']>(wpi.offGeneratePoster)
expectType<WeapiDefaultInstance['offHCEMessage']>(wpi.offHCEMessage)
expectType<WeapiDefaultInstance['offKeyboardHeightChange']>(wpi.offKeyboardHeightChange)
expectType<WeapiDefaultInstance['offKeyDown']>(wpi.offKeyDown)
expectType<WeapiDefaultInstance['offKeyUp']>(wpi.offKeyUp)
expectType<WeapiDefaultInstance['offLocalServiceDiscoveryStop']>(wpi.offLocalServiceDiscoveryStop)

const requestTask = wpi.request({
  url: 'https://example.com',
  success: (result) => {
    expectType<WeapiMiniProgramRequestSuccessResult>(result)
  },
  fail: (error) => {
    expectType<WechatMiniprogram.RequestFailCallbackErr & { errno?: number }>(error)
    expectType<number>(error.errno)
  },
})
expectType<WeapiMiniProgramRequestTask>(requestTask)

const connectSocketOption = {} as WeapiMiniProgramConnectSocketOption
expectType<WeapiMiniProgramConnectSocketOption>(connectSocketOption)

const socketTask = ({} as WeapiMiniProgramRawAdapter).connectSocket(connectSocketOption)
expectType<WeapiMiniProgramSocketTask>(socketTask)

const saveFilePromise = wpi.saveFile({
  apFilePath: '/tmp/demo.png',
  filePath: '/tmp/demo.png',
})
expectType<ReturnType<WeapiDefaultInstance['saveFile']>>(saveFilePromise)

const createBleConnectionPromise = wpi.createBLEConnection({
  deviceId: 'device-id',
})
expectAssignable<Promise<WeapiMiniProgramBluetoothError>>(createBleConnectionPromise)
createBleConnectionPromise.catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number>(error.errCode)
  expectType<number | undefined>(error.errno)
})

wpi.openBluetoothAdapter({
  success: (result) => {
    expectType<WechatMiniprogram.BluetoothError>(result)
    expectType<string>(result.errMsg)
    expectType<number>(result.errCode)
    expectError(result.errno)
  },
  fail: (error) => {
    expectType<string>(error.errMsg)
    expectType<number>(error.errCode)
    expectType<number | undefined>(error.errno)
  },
  complete: (result) => {
    expectType<WechatMiniprogram.BluetoothError>(result)
    expectType<string>(result.errMsg)
    expectType<number>(result.errCode)
    expectError(result.errno)
  },
})

wpi.request({
  url: 'https://example.com',
  success: (result) => {
    expectType<WeapiMiniProgramRequestSuccessResult>(result)
    expectType<number>(result.statusCode)
  },
  fail: (error) => {
    expectType<WechatMiniprogram.RequestFailCallbackErr & { errno?: number }>(error)
    expectType<number>(error.errno)
  },
  complete: (result) => {
    expectType<WechatMiniprogram.GeneralCallbackResult>(result)
    expectType<string>(result.errMsg)
  },
})

wpi.createBLEConnection({
  deviceId: 'device-id',
  fail: (error) => {
    expectType<string>(error.errMsg)
    expectType<number>(error.errCode)
    expectType<number | undefined>(error.errno)
  },
})

const closeBleConnectionPromise = wpi.closeBLEConnection({
  deviceId: 'device-id',
})
expectAssignable<Promise<WeapiMiniProgramBluetoothError>>(closeBleConnectionPromise)

const getSystemInfoAsyncPromise = wpi.getSystemInfoAsync()
expectAssignable<Promise<WeapiMiniProgramSystemInfo>>(getSystemInfoAsyncPromise)
getSystemInfoAsyncPromise.catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errno)
})

const clipboardPromise = wpi.getClipboardData()
expectAssignable<Promise<WeapiMiniProgramClipboardDataResult>>(clipboardPromise)

const getSettingPromise = wpi.getSetting()
expectAssignable<Promise<WechatMiniprogram.GetSettingSuccessCallbackResult>>(getSettingPromise)

const scanCodePromise = wpi.scanCode()
expectAssignable<Promise<WechatMiniprogram.ScanCodeSuccessCallbackResult>>(scanCodePromise)

const scanCodePromiseWithOption = wpi.scanCode({})
expectAssignable<Promise<WechatMiniprogram.ScanCodeSuccessCallbackResult>>(scanCodePromiseWithOption)

const stopPullDownRefreshPromise = wpi.stopPullDownRefresh()
expectAssignable<Promise<WechatMiniprogram.GeneralCallbackResult>>(stopPullDownRefreshPromise)
stopPullDownRefreshPromise.catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errno)
})

interface CustomAdapter {
  foo: (option: { success?: (res: { ok: true }) => void }) => number
  anyError: (option: {
    fail?: (error: any) => void
    success?: (res: { ok: true }) => void
  }) => number
  customError: (option: {
    complete?: (result: { ok: true }) => void
    fail?: (error: { code: 'CUSTOM_ERROR', detail: string }) => void
    success?: (res: { ok: true }) => void
  }) => number
  unknownError: (option: {
    fail?: (error: unknown) => void
    success?: (res: { ok: true }) => void
  }) => number
  bazSync: (value: string) => number
  onReady: (callback: () => void) => void
}

const custom = createWeapi<CustomAdapter>()
const strictCustom = createWeapi<CustomAdapter>({ strictCompatibility: true })
const strictNetwork = createWeapi({
  network: {
    overflowPolicy: 'strict',
    maxQueueSize: 32,
  },
})
const queueNetwork = createWeapi({
  network: {
    overflowPolicy: 'queue',
  },
})

const fooPromise = custom.foo({})
expectAssignable<Promise<{ ok: true }>>(fooPromise)
fooPromise.catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errno)
})

custom.anyError({}).catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errno)
})
custom.anyError({
  fail: (error) => {
    expectType<string>(error.errMsg)
    expectType<number | undefined>(error.errno)
  },
})
custom.unknownError({}).catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errno)
})
custom.customError({}).catch((error) => {
  expectType<'CUSTOM_ERROR'>(error.code)
  expectType<string>(error.detail)
  expectError(error.errno)
})
const customCallbackReturn = custom.customError({
  success: (result) => {
    expectType<{ ok: true }>(result)
  },
  fail: (error) => {
    expectType<'CUSTOM_ERROR'>(error.code)
    expectType<string>(error.detail)
    expectError(error.errno)
  },
  complete: (result) => {
    expectType<{ ok: true }>(result)
  },
})
expectType<number>(customCallbackReturn)

const wechat = createWeapi({ adapter: wx })
wechat.stopPullDownRefresh().catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errno)
})

const alipay = createWeapi({ adapter: my })
alipay.showToast({ content: 'done' }).catch((error) => {
  expectType<number | undefined>(error.error)
  expectType<string | undefined>(error.errorMessage)
  expectError(error.errno)
})
alipay.showToast({
  content: 'done',
  success: (result) => {
    expectAssignable<object>(result)
    expectError(result.errMsg)
  },
  fail: (error) => {
    expectType<number | undefined>(error.error)
    expectType<string | undefined>(error.errorMessage)
    expectError(error.errno)
  },
  complete: (result) => {
    expectType<number | undefined>(result.error)
    expectType<string | undefined>(result.errorMessage)
    expectError(result.errno)
  },
})

const douyin = createWeapi({ adapter: tt })
douyin.showToast({ title: 'done' }).catch((error) => {
  expectType<string>(error.errMsg)
  expectType<number | undefined>(error.errNo)
  expectError(error.errno)
})
douyin.showToast({
  title: 'done',
  success: (result) => {
    expectType<string>(result.errMsg)
    expectError(result.errNo)
  },
  fail: (error) => {
    expectType<string>(error.errMsg)
    expectType<number | undefined>(error.errNo)
    expectError(error.errno)
  },
  complete: (result) => {
    expectType<string>(result.errMsg)
    expectType<number | undefined>(result.errNo)
    expectError(result.errno)
  },
})

const fooReturn = custom.foo({
  success: (res) => {
    expectType<{ ok: true }>(res)
  },
})
expectType<number>(fooReturn)

expectType<number>(custom.bazSync('ok'))
expectType<void>(custom.onReady(() => {}))
expectType<void>(strictCustom.onReady(() => {}))
expectType<string | undefined>(strictNetwork.platform)
expectType<string | undefined>(queueNetwork.platform)
