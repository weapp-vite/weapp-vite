import { WEAPI_WX_METHODS } from '@/core/apiCatalog'
import {
  generateApiSupportCoverageReport,
  generateMethodCompatibilityMatrix,
  validateSupportMatrixConsistency,
  WEAPI_METHOD_SUPPORT_MATRIX,
  WEAPI_PLATFORM_SUPPORT_MATRIX,
} from '@/core/methodMapping'
import { createWeapi } from '@/index'

describe('weapi', () => {
  it('promisifies when no callbacks provided', async () => {
    interface RequestOptions {
      url?: string
      success?: (res: any) => void
    }
    const adapter = {
      request(options: RequestOptions) {
        options.success?.({ ok: true })
      },
    }
    const api = createWeapi({ adapter, platform: 'wx' })
    const res = await api.request({ url: 'https://example.com' })
    expect(res).toEqual({ ok: true })
  })

  it('keeps callback style when callbacks provided', () => {
    interface RequestOptions {
      url?: string
      success?: (res: any) => void
    }
    const adapter = {
      request(options: RequestOptions) {
        options.success?.('ok')
        return 'raw'
      },
    }
    const api = createWeapi({ adapter, platform: 'wx' })
    const result = api.request({
      success() {},
    })
    expect(result).toBe('raw')
  })

  it('bypasses promise for sync api', () => {
    const adapter = {
      getSystemInfoSync() {
        return { platform: 'wx' }
      },
    }
    const api = createWeapi({ adapter, platform: 'wx' })
    expect(api.getSystemInfoSync()).toEqual({ platform: 'wx' })
  })

  it('rejects when api is missing', async () => {
    const api = createWeapi({ adapter: {}, platform: 'wx' }) as Record<string, any>
    await expect(api.unknown({})).rejects.toMatchObject({
      errMsg: 'wx.unknown:fail method not supported',
    })
  })

  it('resolves mapped target and support state', () => {
    const confirm = vi.fn()
    const api = createWeapi({
      adapter: { confirm },
      platform: 'alipay',
    })
    expect(api.resolveTarget('showModal')).toMatchObject({
      method: 'showModal',
      target: 'confirm',
      platform: 'my',
      mapped: true,
      supported: true,
      supportLevel: 'mapped',
      semanticAligned: true,
    })
    expect(api.supports('showModal')).toBe(true)
    expect(api.supports('request')).toBe(false)
    expect(api.resolveTarget('request')).toMatchObject({
      method: 'request',
      target: 'request',
      platform: 'my',
      mapped: false,
      supported: false,
      supportLevel: 'unsupported',
      semanticAligned: false,
    })
  })

  it('treats missing api as unsupported by default', async () => {
    const hideToast = vi.fn((options: any) => {
      options.success?.({ errMsg: 'hideToast:ok' })
    })
    const api = createWeapi({
      adapter: { hideToast },
      platform: 'my',
    }) as Record<string, any>

    expect(api.resolveTarget('chooseInvoice')).toMatchObject({
      method: 'chooseInvoice',
      target: 'chooseInvoice',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.supports('chooseInvoice')).toBe(false)
    expect(api.supports('chooseInvoice', { semantic: true })).toBe(false)

    await expect(api.chooseInvoice()).rejects.toMatchObject({
      errMsg: 'my.chooseInvoice:fail method not supported',
    })
    expect(hideToast).not.toHaveBeenCalled()
  })

  it('keeps missing api unsupported in strictCompatibility mode', async () => {
    const hideToast = vi.fn((options: any) => {
      options.success?.({ errMsg: 'hideToast:ok' })
    })
    const api = createWeapi({
      adapter: { hideToast },
      platform: 'my',
      strictCompatibility: true,
    }) as Record<string, any>

    expect(api.resolveTarget('chooseInvoice')).toMatchObject({
      method: 'chooseInvoice',
      target: 'chooseInvoice',
      mapped: false,
      supported: false,
      supportLevel: 'unsupported',
      semanticAligned: false,
    })
    expect(api.supports('chooseInvoice')).toBe(false)

    await expect(api.chooseInvoice()).rejects.toMatchObject({
      errMsg: 'my.chooseInvoice:fail method not supported',
    })
    expect(hideToast).not.toHaveBeenCalled()
  })

  it('maps showToast options for alipay', async () => {
    const showToast = vi.fn((options: any) => {
      options.success?.({ errMsg: 'showToast:ok' })
    })
    const api = createWeapi({
      adapter: {
        showToast,
      },
      platform: 'alipay',
    })

    await api.showToast({ title: '失败', icon: 'error' })

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '失败',
      content: '失败',
      icon: 'error',
      type: 'fail',
    }))
  })

  it('maps showLoading options for alipay', async () => {
    const showLoading = vi.fn((options: any) => {
      options.success?.({ errMsg: 'showLoading:ok' })
    })
    const api = createWeapi({
      adapter: {
        showLoading,
      },
      platform: 'alipay',
    })

    await api.showLoading({ title: '加载中' })

    expect(showLoading).toHaveBeenCalledWith(expect.objectContaining({
      title: '加载中',
      content: '加载中',
    }))
  })

  it('maps showActionSheet args and promise result for alipay', async () => {
    const showActionSheet = vi.fn((options: any) => {
      options.success?.({ index: 1 })
    })
    const api = createWeapi({
      adapter: {
        showActionSheet,
      },
      platform: 'alipay',
    })

    const result = await api.showActionSheet({ itemList: ['复制链接', '打开页面'] })

    expect(showActionSheet).toHaveBeenCalledWith(expect.objectContaining({
      itemList: ['复制链接', '打开页面'],
      items: ['复制链接', '打开页面'],
    }))
    expect(result).toMatchObject({
      index: 1,
      tapIndex: 1,
    })
  })

  it('maps showActionSheet callback result for alipay', () => {
    const success = vi.fn()
    const showActionSheet = vi.fn((options: any) => {
      options.success?.({ index: 2 })
      return { index: 3 }
    })
    const api = createWeapi({
      adapter: {
        showActionSheet,
      },
      platform: 'alipay',
    })

    const result = api.showActionSheet({
      itemList: ['复制链接'],
      success,
    })

    expect(success).toHaveBeenCalledWith(expect.objectContaining({
      index: 2,
      tapIndex: 2,
    }))
    expect(result).toMatchObject({
      index: 3,
      tapIndex: 3,
    })
  })

  it('maps showModal to confirm for alipay', async () => {
    const confirm = vi.fn((options: any) => {
      options.success?.({ confirm: false })
    })
    const api = createWeapi({
      adapter: {
        confirm,
      },
      platform: 'alipay',
    })

    const result = await api.showModal({
      title: '提示',
      content: '是否继续',
      confirmText: '继续',
      cancelText: '取消',
    })

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: '提示',
      content: '是否继续',
      confirmText: '继续',
      cancelText: '取消',
      confirmButtonText: '继续',
      cancelButtonText: '取消',
    }))
    expect(result).toMatchObject({
      confirm: false,
      cancel: true,
    })
  })

  it('maps chooseImage result from apFilePaths to tempFilePaths', async () => {
    const api = createWeapi({
      adapter: {
        chooseImage(options: any) {
          options.success?.({ apFilePaths: ['/tmp/demo.png'] })
        },
      },
      platform: 'alipay',
    })

    const result = await api.chooseImage()
    expect(result).toMatchObject({
      apFilePaths: ['/tmp/demo.png'],
      tempFilePaths: ['/tmp/demo.png'],
    })
  })

  it('maps chooseMedia to chooseImage for alipay', async () => {
    const chooseImage = vi.fn((options: any) => {
      options.success?.({
        apFilePaths: ['/tmp/media-a.png', '/tmp/media-b.png'],
      })
    })
    const api = createWeapi({
      adapter: {
        chooseImage,
      },
      platform: 'alipay',
    })

    const result = await api.chooseMedia({
      count: 2,
      mediaType: ['image'],
      sourceType: ['album'],
    } as any)

    expect(chooseImage).toHaveBeenCalledWith(expect.objectContaining({
      count: 2,
      mediaType: ['image'],
      sourceType: ['album'],
    }))
    expect(result).toMatchObject({
      tempFilePaths: ['/tmp/media-a.png', '/tmp/media-b.png'],
      tempFiles: [
        { tempFilePath: '/tmp/media-a.png', fileType: 'image' },
        { tempFilePath: '/tmp/media-b.png', fileType: 'image' },
      ],
      type: 'image',
    })
  })

  it.each([
    { platform: 'alipay', response: { apFilePaths: ['/tmp/file-a.png'] } },
    { platform: 'tt', response: { tempFilePaths: '/tmp/file-b.png' } },
  ])('maps chooseMessageFile to chooseImage for $platform', async ({ platform, response }) => {
    const chooseImage = vi.fn((options: any) => {
      options.success?.(response)
    })
    const api = createWeapi({
      adapter: {
        chooseImage,
      },
      platform,
    })

    const result = await api.chooseMessageFile({
      count: 1,
      type: 'file',
    } as any)

    expect(chooseImage).toHaveBeenCalledWith(expect.objectContaining({
      count: 1,
      type: 'file',
    }))
    expect(result).toMatchObject({
      tempFiles: [
        expect.objectContaining({
          path: expect.stringContaining('/tmp/file-'),
          name: expect.stringMatching(/^file-[ab]\.png$/),
        }),
      ],
    })
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('maps getFuzzyLocation to getLocation for $platform', async ({ platform }) => {
    const getLocation = vi.fn((options: any) => {
      options.success?.({
        latitude: 30.2741,
        longitude: 120.1551,
      })
    })
    const api = createWeapi({
      adapter: {
        getLocation,
      },
      platform,
    })

    const result = await api.getFuzzyLocation({
      type: 'wgs84',
    } as any)
    expect(getLocation).toHaveBeenCalledWith(expect.objectContaining({
      type: 'wgs84',
    }))
    expect(result).toMatchObject({
      latitude: 30.2741,
      longitude: 120.1551,
    })
  })

  it('maps saveFile args and result for alipay', async () => {
    const saveFile = vi.fn((options: any) => {
      options.success?.({ apFilePath: '/store/demo.png' })
    })
    const api = createWeapi({
      adapter: {
        saveFile,
      },
      platform: 'alipay',
    })

    const result = await api.saveFile({ tempFilePath: '/tmp/demo.png' })

    expect(saveFile).toHaveBeenCalledWith(expect.objectContaining({
      tempFilePath: '/tmp/demo.png',
      apFilePath: '/tmp/demo.png',
    }))
    expect(result).toMatchObject({
      apFilePath: '/store/demo.png',
      savedFilePath: '/store/demo.png',
    })
  })

  it('maps setClipboardData to alipay setClipboard', async () => {
    const setClipboard = vi.fn((options: any) => {
      options.success?.({ errMsg: 'setClipboard:ok' })
    })
    const api = createWeapi({
      adapter: {
        setClipboard,
      },
      platform: 'alipay',
    })

    await api.setClipboardData({ data: 'hello' })

    expect(setClipboard).toHaveBeenCalledWith(expect.objectContaining({
      text: 'hello',
      data: 'hello',
    }))
  })

  it('maps getClipboardData result from alipay text to data', async () => {
    const api = createWeapi({
      adapter: {
        getClipboard(options: any) {
          options.success?.({ text: 'copied' })
        },
      },
      platform: 'alipay',
    })

    const result = await api.getClipboardData()
    expect(result).toMatchObject({ text: 'copied', data: 'copied' })
  })

  it('maps login to getAuthCode for alipay', async () => {
    const getAuthCode = vi.fn((options: any) => {
      options.success?.({ authCode: 'auth-code-1' })
    })
    const api = createWeapi({
      adapter: {
        getAuthCode,
      },
      platform: 'alipay',
    })

    const result = await api.login()

    expect(getAuthCode).toHaveBeenCalledWith(expect.any(Object))
    expect(result).toMatchObject({
      authCode: 'auth-code-1',
      code: 'auth-code-1',
    })
  })

  it('maps authorize scope to getAuthCode scopes for alipay', async () => {
    const getAuthCode = vi.fn((options: any) => {
      options.success?.({ authCode: 'auth-code-2' })
    })
    const api = createWeapi({
      adapter: {
        getAuthCode,
      },
      platform: 'alipay',
    })

    const result = await api.authorize({ scope: 'scope.userInfo' } as any)

    expect(getAuthCode).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'scope.userInfo',
      scopes: ['scope.userInfo'],
    }))
    expect(result).toMatchObject({
      authCode: 'auth-code-2',
      code: 'auth-code-2',
    })
  })

  it('maps checkSession to getAuthCode for alipay', async () => {
    const getAuthCode = vi.fn((options: any) => {
      options.success?.({ authCode: 'auth-code-3' })
    })
    const api = createWeapi({
      adapter: {
        getAuthCode,
      },
      platform: 'alipay',
    })

    const result = await api.checkSession()

    expect(getAuthCode).toHaveBeenCalledWith(expect.objectContaining({
      scopes: ['auth_base'],
    }))
    expect(result).toMatchObject({
      authCode: 'auth-code-3',
      errMsg: 'checkSession:ok',
    })
  })

  it('maps hideHomeButton to hideBackHome for alipay', async () => {
    const hideBackHome = vi.fn((options: any) => {
      options.success?.({})
    })
    const api = createWeapi({
      adapter: {
        hideBackHome,
      },
      platform: 'alipay',
    })

    await api.hideHomeButton()

    expect(hideBackHome).toHaveBeenCalledWith(expect.any(Object))
  })

  it('maps requestPayment family to tradePay for alipay', async () => {
    const tradePay = vi.fn((options: any) => {
      options.success?.({ resultCode: '9000' })
    })
    const api = createWeapi({
      adapter: {
        tradePay,
      },
      platform: 'alipay',
    })

    await api.requestPayment({ package: 'prepay=1' } as any)
    await api.requestOrderPayment({ package: 'prepay=2' } as any)
    await api.requestPluginPayment({ package: 'prepay=3' } as any)
    await api.requestVirtualPayment({ package: 'prepay=4' } as any)

    expect(tradePay).toHaveBeenCalledTimes(4)
    expect(tradePay).toHaveBeenNthCalledWith(1, expect.objectContaining({
      package: 'prepay=1',
      orderStr: 'prepay=1',
    }))
  })

  it('maps previewMedia to previewImage for alipay', async () => {
    const previewImage = vi.fn((options: any) => {
      options.success?.({ errMsg: 'previewImage:ok' })
    })
    const api = createWeapi({
      adapter: {
        previewImage,
      },
      platform: 'alipay',
    })

    await api.previewMedia({
      sources: [
        { url: 'https://example.com/a.jpg', type: 'image' },
        { url: 'https://example.com/b.jpg', type: 'image' },
      ],
      current: 1,
    } as any)

    expect(previewImage).toHaveBeenCalledWith(expect.objectContaining({
      urls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      current: 'https://example.com/b.jpg',
    }))
  })

  it('maps ad and live context apis for alipay', () => {
    const createRewardedAd = vi.fn(() => ({ show: vi.fn() }))
    const createVideoContext = vi.fn(() => ({ play: vi.fn() }))
    const api = createWeapi({
      adapter: {
        createRewardedAd,
        createVideoContext,
      },
      platform: 'alipay',
    }) as Record<string, any>

    api.createInterstitialAd({ adUnitId: 'adunit-1' })
    api.createRewardedVideoAd({ adUnitId: 'adunit-2' })
    api.createLivePlayerContext('live-player')
    api.createLivePusherContext('live-pusher')

    expect(createRewardedAd).toHaveBeenNthCalledWith(1, 'adunit-1', expect.any(Object))
    expect(createRewardedAd).toHaveBeenNthCalledWith(2, 'adunit-2', expect.any(Object))
    expect(createVideoContext).toHaveBeenNthCalledWith(1, 'live-player', expect.any(Object))
    expect(createVideoContext).toHaveBeenNthCalledWith(2, 'live-pusher', expect.any(Object))
  })

  it('normalizes platform alias for createWeapi', () => {
    const api = createWeapi({
      adapter: {},
      platform: 'douyin',
    })
    expect(api.platform).toBe('tt')
  })

  it.each([
    'nextTick',
    'getLogManager',
    'createVKSession',
  ])('treats %s as unsupported without strict-equivalent runtime API', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it('treats reportAnalytics as unsupported for alipay when method is missing', async () => {
    const api = createWeapi({
      adapter: {},
      platform: 'alipay',
    })

    expect(api.resolveTarget('reportAnalytics')).toMatchObject({
      method: 'reportAnalytics',
      target: 'reportAnalytics',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.reportAnalytics('event_name', { from: 'test' } as any)).rejects.toMatchObject({
      errMsg: 'my.reportAnalytics:fail method not supported',
    })
  })

  it('treats onWindowResize/offWindowResize as unsupported for alipay when method is missing', async () => {
    const api = createWeapi({
      adapter: {},
      platform: 'alipay',
    })

    expect(api.resolveTarget('onWindowResize')).toMatchObject({
      method: 'onWindowResize',
      target: 'onWindowResize',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('offWindowResize')).toMatchObject({
      method: 'offWindowResize',
      target: 'offWindowResize',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.onWindowResize(vi.fn() as any)).rejects.toMatchObject({
      errMsg: 'my.onWindowResize:fail method not supported',
    })
    await expect(api.offWindowResize(vi.fn() as any)).rejects.toMatchObject({
      errMsg: 'my.offWindowResize:fail method not supported',
    })
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('treats openCustomerServiceChat as unsupported for $platform', async ({ platform }) => {
    const normalizedPlatform = platform === 'alipay' ? 'my' : platform
    const api = createWeapi({
      adapter: {},
      platform,
    })
    expect(api.resolveTarget('openCustomerServiceChat')).toMatchObject({
      method: 'openCustomerServiceChat',
      target: 'openCustomerServiceChat',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.openCustomerServiceChat({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.openCustomerServiceChat:fail method not supported`,
    })
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('treats compressVideo/openVideoEditor/getShareInfo/joinVoIPChat as unsupported for $platform', async ({ platform }) => {
    const normalizedPlatform = platform === 'alipay' ? 'my' : platform
    const api = createWeapi({
      adapter: {},
      platform,
    })
    expect(api.resolveTarget('compressVideo')).toMatchObject({
      method: 'compressVideo',
      target: 'compressVideo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('getShareInfo')).toMatchObject({
      method: 'getShareInfo',
      target: 'getShareInfo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('openVideoEditor')).toMatchObject({
      method: 'openVideoEditor',
      target: 'openVideoEditor',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('joinVoIPChat')).toMatchObject({
      method: 'joinVoIPChat',
      target: 'joinVoIPChat',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.compressVideo({ src: '/tmp/demo.mp4' } as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.compressVideo:fail method not supported`,
    })
    await expect(api.getShareInfo({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.getShareInfo:fail method not supported`,
    })
    await expect(api.openVideoEditor({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.openVideoEditor:fail method not supported`,
    })
    await expect(api.joinVoIPChat({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.joinVoIPChat:fail method not supported`,
    })
  })

  it.each([
    'chooseInvoiceTitle',
    'chooseLicensePlate',
    'choosePoi',
    'closeBLEConnection',
    'createBLEConnection',
    'cropImage',
    'editImage',
    'exitVoIPChat',
    'faceDetect',
    'getApiCategory',
    'getBackgroundFetchToken',
    'getChannelsLiveInfo',
    'getChannelsLiveNoticeInfo',
    'getChannelsShareKey',
    'getChatToolInfo',
    'getCommonConfig',
    'getGroupEnterInfo',
    'getPrivacySetting',
    'initFaceDetect',
    'join1v1Chat',
  ])('treats %s as unsupported when adapter method is missing', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'shareAppMessageToGroup',
    'shareEmojiToGroup',
    'shareFileMessage',
    'shareFileToGroup',
    'shareImageToGroup',
    'shareToOfficialAccount',
    'shareToWeRun',
    'shareVideoMessage',
    'shareVideoToGroup',
    'showRedPackage',
    'startDeviceMotionListening',
    'startHCE',
    'startLocalServiceDiscovery',
    'startLocationUpdate',
    'startLocationUpdateBackground',
    'startRecord',
    'startSoterAuthentication',
    'stopBackgroundAudio',
    'stopDeviceMotionListening',
    'stopFaceDetect',
  ])('treats %s as unsupported in strict mode when adapter method is missing', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'requestCommonPayment',
    'requestDeviceVoIP',
    'requestMerchantTransfer',
    'requirePrivacyAuthorize',
    'reserveChannelsLive',
    'selectGroupMembers',
    'sendHCEMessage',
    'sendSms',
    'setBackgroundFetchToken',
    'setEnable1v1Chat',
    'setTopBarText',
    'setWindowSize',
    'stopHCE',
    'stopLocalServiceDiscovery',
    'stopLocationUpdate',
    'stopRecord',
    'stopVoice',
    'subscribeVoIPVideoMembers',
    'updateVoIPChatMuteConfig',
    'updateWeChatApp',
  ])('treats %s as unsupported when adapter does not expose it', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'getBackgroundAudioPlayerState',
    'getDeviceBenchmarkInfo',
    'getDeviceVoIPList',
    'getHCEState',
    'getInferenceEnvInfo',
    'getNFCAdapter',
    'getPerformance',
    'getRandomValues',
    'getRealtimeLogManager',
    'getRendererUserAgent',
    'getScreenRecordingState',
    'getSecureElementPasses',
    'getSelectedTextRange',
    'getShowSplashAdStatus',
    'getSkylineInfo',
    'getUserCryptoManager',
    'getWeRunData',
    'getXrFrameSystem',
    'isBluetoothDevicePaired',
    'isVKSupport',
  ])('treats %s as unsupported when no strict-equivalent api exists', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'createBLEPeripheralServer',
    'createBufferURL',
    'createCacheManager',
    'createGlobalPayment',
    'createInferenceSession',
    'createMediaAudioPlayer',
    'createMediaContainer',
    'createMediaRecorder',
    'createTCPSocket',
    'createUDPSocket',
    'createVideoDecoder',
  ])('treats %s as unsupported when adapter method is absent', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'loadBuiltInFontFace',
    'notifyGroupMembers',
    'requestIdleCallback',
    'revokeBufferURL',
    'rewriteRoute',
    'seekBackgroundAudio',
    'setEnableDebug',
    'setInnerAudioOption',
  ])('treats %s as unsupported for alipay and douyin when method is missing', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'openSystemBluetoothSetting',
    'reportEvent',
    'reportMonitor',
    'reportPerformance',
    'openSingleStickerView',
    'openStickerIPView',
    'openStickerSetView',
    'openStoreCouponDetail',
    'openStoreOrderDetail',
    'pauseBackgroundAudio',
    'pauseVoice',
    'playBackgroundAudio',
    'playVoice',
    'postMessageToReferrerMiniProgram',
    'postMessageToReferrerPage',
    'preDownloadSubpackage',
    'preloadAssets',
    'preloadSkylineView',
    'preloadWebview',
    'removeSecureElementPass',
  ])('treats %s as unsupported in strict compatibility mode', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'addCard',
    'addFileToFavorites',
    'addPaymentPassFinish',
    'addPaymentPassGetCertificateData',
    'addPhoneCalendar',
    'addPhoneRepeatCalendar',
    'addVideoToFavorites',
    'authorizeForMiniProgram',
    'authPrivateMessage',
    'bindEmployeeRelation',
    'canAddSecureElementPass',
    'openCard',
    'openChannelsActivity',
    'openChannelsEvent',
    'openChannelsLive',
    'openChannelsLiveNoticeInfo',
    'openChannelsUserProfile',
    'openChatTool',
    'openHKOfflinePayView',
    'openInquiriesTopic',
  ])('treats %s as unsupported when no strict-equivalent target exists', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'addPhoneContact',
    'openOfficialAccountArticle',
    'openOfficialAccountChat',
    'openOfficialAccountProfile',
    'openPrivacyContract',
  ])('treats %s as unsupported without strict-equivalent runtime API', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'canvasGetImageData',
    'canvasPutImageData',
    'checkDeviceSupportHevc',
    'checkEmployeeRelation',
    'checkIsAddedToMyMiniProgram',
    'checkIsOpenAccessibility',
    'checkIsPictureInPictureActive',
    'checkIsSoterEnrolledInDevice',
    'checkIsSupportSoterAuthentication',
  ])('treats %s as unsupported when no strict-equivalent target exists', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it.each([
    'batchSetStorage',
    'batchGetStorage',
    'batchSetStorageSync',
    'batchGetStorageSync',
    'createCameraContext',
    'cancelIdleCallback',
  ])('treats %s as unsupported when no strict-equivalent target exists', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it('treats offMemoryWarning as unsupported for douyin when method is missing', async () => {
    const api = createWeapi({
      adapter: {},
      platform: 'tt',
    })

    expect(api.resolveTarget('offMemoryWarning')).toMatchObject({
      method: 'offMemoryWarning',
      target: 'offMemoryWarning',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.offMemoryWarning(vi.fn() as any)).rejects.toMatchObject({
      errMsg: 'tt.offMemoryWarning:fail method not supported',
    })
  })

  it.each([
    'onAfterPageLoad',
    'onBeforeAppRoute',
    'onBLEMTUChange',
    'offAfterPageLoad',
    'offKeyboardHeightChange',
    'offLocalServiceDiscoveryStop',
  ])('does not map unrelated event %s to app show/hide fallback', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const onAppShow = vi.fn()
      const offAppShow = vi.fn()
      const api = createWeapi({
        adapter: {
          onAppShow,
          offAppShow,
        },
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName](vi.fn())).rejects.toMatchObject({
        errMsg: `${api.platform}.${methodName}:fail method not supported`,
      })
      expect(onAppShow).not.toHaveBeenCalled()
      expect(offAppShow).not.toHaveBeenCalled()
    }
  })

  it('maps BLE connection state event aliases to alipay changed suffix methods', () => {
    const onBLEConnectionStateChanged = vi.fn()
    const offBLEConnectionStateChanged = vi.fn()
    const api = createWeapi({
      adapter: {
        onBLEConnectionStateChanged,
        offBLEConnectionStateChanged,
      },
      platform: 'alipay',
    }) as Record<string, any>

    const listener = vi.fn()
    expect(api.resolveTarget('onBLEConnectionStateChange')).toMatchObject({
      method: 'onBLEConnectionStateChange',
      target: 'onBLEConnectionStateChanged',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })
    expect(api.resolveTarget('offBLEConnectionStateChange')).toMatchObject({
      method: 'offBLEConnectionStateChange',
      target: 'offBLEConnectionStateChanged',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })

    api.onBLEConnectionStateChange(listener)
    api.offBLEConnectionStateChange(listener)

    expect(onBLEConnectionStateChanged).toHaveBeenCalledWith(listener)
    expect(offBLEConnectionStateChanged).toHaveBeenCalledWith(listener)
  })

  it('maps showToast icon error to fail for douyin', async () => {
    const showToast = vi.fn((options: any) => {
      options.success?.({ errMsg: 'showToast:ok' })
    })
    const api = createWeapi({
      adapter: {
        showToast,
      },
      platform: 'douyin',
    })

    await api.showToast({ title: '提示', icon: 'error' as any })

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '提示',
      icon: 'fail',
    }))
  })

  it('normalizes douyin showActionSheet result from index to tapIndex', async () => {
    const api = createWeapi({
      adapter: {
        showActionSheet(options: any) {
          options.success?.({ index: 1 })
        },
      },
      platform: 'tt',
    })

    const result = await api.showActionSheet({ itemList: ['A', 'B'] })
    expect(result).toMatchObject({
      index: 1,
      tapIndex: 1,
    })
  })

  it('treats douyin showActionSheet as unsupported when adapter method is missing', async () => {
    const showModal = vi.fn((options: any) => {
      options.success?.({ confirm: true })
    })
    const api = createWeapi({
      adapter: {
        showModal,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('showActionSheet')).toMatchObject({
      method: 'showActionSheet',
      target: 'showActionSheet',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })

    await expect(api.showActionSheet({
      itemList: ['复制链接', '打开页面'],
      title: '操作',
    })).rejects.toMatchObject({
      errMsg: 'tt.showActionSheet:fail method not supported',
    })
    expect(showModal).not.toHaveBeenCalled()
  })

  it('treats openDocument as unsupported for douyin when adapter method is missing', async () => {
    const api = createWeapi({
      adapter: {},
      platform: 'tt',
    })
    expect(api.resolveTarget('openDocument')).toMatchObject({
      method: 'openDocument',
      target: 'openDocument',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.openDocument({ filePath: '/tmp/a.pdf' } as any)).rejects.toMatchObject({
      errMsg: 'tt.openDocument:fail method not supported',
    })
  })

  it('maps saveVideoToPhotosAlbum to saveImageToPhotosAlbum for douyin', async () => {
    const saveImageToPhotosAlbum = vi.fn((options: any) => {
      options.success?.({ errMsg: 'saveImageToPhotosAlbum:ok' })
    })
    const api = createWeapi({
      adapter: {
        saveImageToPhotosAlbum,
      },
      platform: 'tt',
    })

    const result = await api.saveVideoToPhotosAlbum({
      filePath: '/tmp/demo.mp4',
    } as any)
    expect(saveImageToPhotosAlbum).toHaveBeenCalledWith(expect.objectContaining({
      filePath: '/tmp/demo.mp4',
    }))
    expect(result).toMatchObject({
      errMsg: 'saveImageToPhotosAlbum:ok',
    })
  })

  it('maps chooseVideo to chooseMedia for douyin', async () => {
    const chooseMedia = vi.fn((options: any) => {
      options.success?.({
        tempFiles: [
          {
            tempFilePath: '/tmp/video.mp4',
            size: 123,
            duration: 8,
            width: 720,
            height: 1280,
            mediaType: 'video',
          },
        ],
      })
    })
    const api = createWeapi({
      adapter: {
        chooseMedia,
      },
      platform: 'tt',
    })

    const result = await api.chooseVideo({
      compressed: false,
      camera: 'back',
      sourceType: ['camera'],
    })

    expect(chooseMedia).toHaveBeenCalledWith(expect.objectContaining({
      mediaType: ['video'],
      count: 1,
      sizeType: ['original'],
      camera: 'back',
      sourceType: ['camera'],
    }))
    expect(result).toMatchObject({
      tempFilePath: '/tmp/video.mp4',
      size: 123,
      duration: 8,
      width: 720,
      height: 1280,
    })
  })

  it('maps getWindowInfo to getSystemInfo for douyin', async () => {
    const getSystemInfo = vi.fn((options: any) => {
      options.success?.({
        pixelRatio: 2,
        screenWidth: 1080,
        screenHeight: 1920,
        windowWidth: 360,
        windowHeight: 640,
        statusBarHeight: 24,
        safeArea: {
          top: 24,
          left: 0,
          right: 360,
          bottom: 640,
          width: 360,
          height: 616,
        },
      })
    })
    const api = createWeapi({
      adapter: {
        getSystemInfo,
      },
      platform: 'tt',
    })

    const result = await api.getWindowInfo()

    expect(getSystemInfo).toHaveBeenCalledWith(expect.any(Object))
    expect(result).toMatchObject({
      pixelRatio: 2,
      screenWidth: 1080,
      screenHeight: 1920,
      windowWidth: 360,
      windowHeight: 640,
      statusBarHeight: 24,
    })
  })

  it('maps setBackgroundColor and setBackgroundTextStyle to setNavigationBarColor for douyin', async () => {
    const setNavigationBarColor = vi.fn((options: any) => {
      options.success?.({ errMsg: 'setNavigationBarColor:ok' })
    })
    const api = createWeapi({
      adapter: {
        setNavigationBarColor,
      },
      platform: 'tt',
    })

    await api.setBackgroundColor({
      backgroundColorTop: '#112233',
      textStyle: 'light',
    } as any)
    await api.setBackgroundTextStyle({
      textStyle: 'dark',
    } as any)

    expect(setNavigationBarColor).toHaveBeenNthCalledWith(1, expect.objectContaining({
      backgroundColorTop: '#112233',
      backgroundColor: '#112233',
      frontColor: '#ffffff',
    }))
    expect(setNavigationBarColor).toHaveBeenNthCalledWith(2, expect.objectContaining({
      textStyle: 'dark',
      frontColor: '#000000',
    }))
  })

  it('maps getNetworkType to getSystemInfo for douyin', async () => {
    const getSystemInfo = vi.fn((options: any) => {
      options.success?.({
        isConnected: false,
      })
    })
    const api = createWeapi({
      adapter: {
        getSystemInfo,
      },
      platform: 'tt',
    })

    const result = await api.getNetworkType()
    expect(getSystemInfo).toHaveBeenCalledWith(expect.any(Object))
    expect(result).toMatchObject({
      isConnected: false,
      networkType: 'none',
    })
  })

  it('maps getBatteryInfo and getBatteryInfoSync via system info for douyin', async () => {
    const getSystemInfo = vi.fn((options: any) => {
      options.success?.({
        battery: 0.56,
        charging: true,
      })
    })
    const getSystemInfoSync = vi.fn(() => ({
      battery: 80,
      charging: false,
    }))
    const api = createWeapi({
      adapter: {
        getSystemInfo,
        getSystemInfoSync,
      },
      platform: 'tt',
    })

    const asyncResult = await api.getBatteryInfo()
    const syncResult = api.getBatteryInfoSync()

    expect(getSystemInfo).toHaveBeenCalledWith(expect.any(Object))
    expect(getSystemInfoSync).toHaveBeenCalledTimes(1)
    expect(asyncResult).toMatchObject({
      battery: 0.56,
      level: 56,
      isCharging: true,
    })
    expect(syncResult).toMatchObject({
      battery: 80,
      level: 80,
      isCharging: false,
    })
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('maps getDeviceInfo via getSystemInfo for $platform', async ({ platform }) => {
    const getSystemInfo = vi.fn((options: any) => {
      options.success?.({
        brand: 'demo-brand',
        model: 'demo-model',
        system: 'OS 1.0',
        platform: 'android',
        benchmarkLevel: 20,
      })
    })
    const api = createWeapi({
      adapter: {
        getSystemInfo,
      },
      platform,
    })

    const result = await api.getDeviceInfo()

    expect(getSystemInfo).toHaveBeenCalledWith(expect.any(Object))
    expect(result).toMatchObject({
      brand: 'demo-brand',
      model: 'demo-model',
      system: 'OS 1.0',
      platform: 'android',
      benchmarkLevel: 20,
    })
  })

  it('maps getAccountInfoSync to getEnvInfoSync for douyin', () => {
    const getEnvInfoSync = vi.fn(() => ({
      microapp: {
        appId: 'tt123',
        envType: 'release',
        mpVersion: '1.2.3',
      },
      plugin: {
        appId: 'plugin123',
        version: '0.0.1',
      },
      common: {},
    }))
    const api = createWeapi({
      adapter: {
        getEnvInfoSync,
      },
      platform: 'tt',
    })

    const result = api.getAccountInfoSync()

    expect(getEnvInfoSync).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      miniProgram: {
        appId: 'tt123',
        envVersion: 'release',
        version: '1.2.3',
      },
      plugin: {
        appId: 'plugin123',
        version: '0.0.1',
      },
    })
  })

  it('maps requestPayment family to pay for douyin', async () => {
    const pay = vi.fn((options: any) => {
      options.success?.({ code: 0 })
    })
    const api = createWeapi({
      adapter: {
        pay,
      },
      platform: 'tt',
    })

    await api.requestPayment({ package: 'order-info-1' } as any)
    await api.requestOrderPayment({ package: 'order-info-2' } as any)
    await api.requestPluginPayment({ package: 'order-info-3' } as any)
    await api.requestVirtualPayment({ package: 'order-info-4' } as any)

    expect(pay).toHaveBeenCalledTimes(4)
    expect(pay).toHaveBeenNthCalledWith(1, expect.objectContaining({
      package: 'order-info-1',
      orderInfo: 'order-info-1',
    }))
  })

  it('maps previewMedia to previewImage for douyin', async () => {
    const previewImage = vi.fn((options: any) => {
      options.success?.({ errMsg: 'previewImage:ok' })
    })
    const api = createWeapi({
      adapter: {
        previewImage,
      },
      platform: 'tt',
    })

    await api.previewMedia({
      sources: [
        { url: 'https://example.com/c.jpg', type: 'image' },
      ],
      current: 0,
    } as any)

    expect(previewImage).toHaveBeenCalledWith(expect.objectContaining({
      urls: ['https://example.com/c.jpg'],
      current: 'https://example.com/c.jpg',
    }))
  })

  it('maps getVideoInfo to getFileInfo for douyin', async () => {
    const getFileInfo = vi.fn((options: any) => {
      options.success?.({ size: 1024 })
    })
    const api = createWeapi({
      adapter: {
        getFileInfo,
      },
      platform: 'tt',
    })

    const result = await api.getVideoInfo({ src: '/tmp/demo.mp4' } as any)

    expect(getFileInfo).toHaveBeenCalledWith(expect.objectContaining({
      src: '/tmp/demo.mp4',
      filePath: '/tmp/demo.mp4',
    }))
    expect(result).toMatchObject({ size: 1024 })
  })

  it('maps ad and live context apis for douyin', () => {
    const createInterstitialAd = vi.fn(() => ({ show: vi.fn() }))
    const createLivePlayerContext = vi.fn(() => ({ play: vi.fn() }))
    const createVideoContext = vi.fn(() => ({ play: vi.fn() }))
    const api = createWeapi({
      adapter: {
        createInterstitialAd,
        createLivePlayerContext,
        createVideoContext,
      },
      platform: 'tt',
    }) as Record<string, any>

    api.createInterstitialAd({ adUnitId: 'tt-ad-1' })
    api.createRewardedVideoAd({ adUnitId: 'tt-ad-2' })
    api.createLivePlayerContext('tt-live-player')
    api.createLivePusherContext('tt-live-pusher')

    expect(createInterstitialAd).toHaveBeenNthCalledWith(1, expect.objectContaining({ adUnitId: 'tt-ad-1' }))
    expect(createInterstitialAd).toHaveBeenNthCalledWith(2, expect.objectContaining({ adUnitId: 'tt-ad-2' }))
    expect(createLivePlayerContext).toHaveBeenNthCalledWith(1, 'tt-live-player', expect.any(Object))
    expect(createVideoContext).toHaveBeenNthCalledWith(1, 'tt-live-pusher', expect.any(Object))
  })

  const douyinPromiseCases = [
    {
      name: 'chooseImage tempFilePaths string to array',
      createAdapter: () => ({
        chooseImage(options: any) {
          options.success?.({ tempFilePaths: '/tmp/demo.png' })
        },
      }),
      invoke: (api: any) => api.chooseImage(),
      expectedResult: {
        tempFilePaths: ['/tmp/demo.png'],
      },
    },
    {
      name: 'chooseImage tempFiles fallback to tempFilePaths',
      createAdapter: () => ({
        chooseImage(options: any) {
          options.success?.({
            tempFiles: [{ path: '/tmp/a.png' }, { filePath: '/tmp/b.png' }],
          })
        },
      }),
      invoke: (api: any) => api.chooseImage(),
      expectedResult: {
        tempFilePaths: ['/tmp/a.png', '/tmp/b.png'],
      },
    },
    {
      name: 'saveFile filePath fallback to savedFilePath',
      createAdapter: () => ({
        saveFile(options: any) {
          options.success?.({ filePath: 'ttfile://user/demo.png' })
        },
      }),
      invoke: (api: any) => api.saveFile({ tempFilePath: '/tmp/demo.png' }),
      expectedResult: {
        filePath: 'ttfile://user/demo.png',
        savedFilePath: 'ttfile://user/demo.png',
      },
    },
  ]

  it.each(douyinPromiseCases)('maps douyin $name in promise mode', async ({
    createAdapter,
    expectedResult,
    invoke,
  }) => {
    const api = createWeapi({
      adapter: createAdapter(),
      platform: 'tt',
    })

    const result = await invoke(api)
    expect(result).toMatchObject(expectedResult)
  })

  const douyinCallbackCases = [
    {
      name: 'showActionSheet',
      createAdapter: () => ({
        showActionSheet(options: any) {
          options.success?.({ index: 2 })
          options.complete?.({ index: 3 })
          return { index: 4 }
        },
      }),
      invoke: (api: any, handlers: { success: (res: any) => void, complete: (res: any) => void }) => api.showActionSheet({
        itemList: ['A', 'B'],
        ...handlers,
      }),
      expectedSuccess: {
        index: 2,
        tapIndex: 2,
      },
      expectedComplete: {
        index: 3,
        tapIndex: 3,
      },
      expectedResult: {
        index: 4,
        tapIndex: 4,
      },
    },
    {
      name: 'chooseImage',
      createAdapter: () => ({
        chooseImage(options: any) {
          options.success?.({ tempFiles: [{ path: '/tmp/a.png' }] })
          options.complete?.({ tempFilePaths: '/tmp/b.png' })
          return { tempFilePaths: '/tmp/c.png' }
        },
      }),
      invoke: (api: any, handlers: { success: (res: any) => void, complete: (res: any) => void }) => api.chooseImage(handlers),
      expectedSuccess: {
        tempFilePaths: ['/tmp/a.png'],
      },
      expectedComplete: {
        tempFilePaths: ['/tmp/b.png'],
      },
      expectedResult: {
        tempFilePaths: ['/tmp/c.png'],
      },
    },
    {
      name: 'saveFile',
      createAdapter: () => ({
        saveFile(options: any) {
          options.success?.({ filePath: 'ttfile://user/success.png' })
          options.complete?.({ filePath: 'ttfile://user/complete.png' })
          return { filePath: 'ttfile://user/return.png' }
        },
      }),
      invoke: (api: any, handlers: { success: (res: any) => void, complete: (res: any) => void }) => api.saveFile({
        tempFilePath: '/tmp/demo.png',
        ...handlers,
      }),
      expectedSuccess: {
        filePath: 'ttfile://user/success.png',
        savedFilePath: 'ttfile://user/success.png',
      },
      expectedComplete: {
        filePath: 'ttfile://user/complete.png',
        savedFilePath: 'ttfile://user/complete.png',
      },
      expectedResult: {
        filePath: 'ttfile://user/return.png',
        savedFilePath: 'ttfile://user/return.png',
      },
    },
  ]

  it.each(douyinCallbackCases)('maps douyin $name callback success and complete', ({
    createAdapter,
    expectedComplete,
    expectedResult,
    expectedSuccess,
    invoke,
  }) => {
    const success = vi.fn()
    const complete = vi.fn()
    const api = createWeapi({
      adapter: createAdapter(),
      platform: 'tt',
    })

    const result = invoke(api, { success, complete })

    expect(success).toHaveBeenCalledWith(expect.objectContaining(expectedSuccess))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining(expectedComplete))
    expect(result).toMatchObject(expectedResult)
  })

  it('generates api coverage report from mapping matrix', () => {
    const report = generateApiSupportCoverageReport()
    const compatibilityMatrix = generateMethodCompatibilityMatrix()
    const wxTotal = WEAPI_WX_METHODS.length
    const alipaySupported = compatibilityMatrix.filter(item => item.alipaySupported).length
    const alipaySemanticAligned = compatibilityMatrix.filter(item => item.alipaySemanticallyAligned).length
    const alipayFallback = compatibilityMatrix.filter(item => item.alipaySupportLevel === 'fallback').length
    const douyinSupported = compatibilityMatrix.filter(item => item.douyinSupported).length
    const douyinSemanticAligned = compatibilityMatrix.filter(item => item.douyinSemanticallyAligned).length
    const douyinFallback = compatibilityMatrix.filter(item => item.douyinSupportLevel === 'fallback').length
    const fullyAligned = compatibilityMatrix.filter(item => item.alipaySupported && item.douyinSupported).length
    const fullySemanticAligned = compatibilityMatrix.filter(item => item.alipaySemanticallyAligned && item.douyinSemanticallyAligned).length
    const formatCoverage = (supported: number) => `${((supported / wxTotal) * 100).toFixed(2)}%`
    expect(report.totalApis).toBe(wxTotal)
    expect(report.fullyAlignedApis).toBe(fullyAligned)
    expect(report.fullyAlignedCoverage).toBe(formatCoverage(fullyAligned))
    expect(report.fullySemanticallyAlignedApis).toBe(fullySemanticAligned)
    expect(report.fullySemanticallyAlignedCoverage).toBe(formatCoverage(fullySemanticAligned))
    expect(report.platforms).toEqual([
      {
        platform: '微信小程序',
        alias: 'wx',
        supportedApis: wxTotal,
        semanticAlignedApis: wxTotal,
        fallbackApis: 0,
        totalApis: wxTotal,
        coverage: '100.00%',
        semanticCoverage: '100.00%',
      },
      {
        platform: '支付宝小程序',
        alias: 'my',
        supportedApis: alipaySupported,
        semanticAlignedApis: alipaySemanticAligned,
        fallbackApis: alipayFallback,
        totalApis: wxTotal,
        coverage: formatCoverage(alipaySupported),
        semanticCoverage: formatCoverage(alipaySemanticAligned),
      },
      {
        platform: '抖音小程序',
        alias: 'tt',
        supportedApis: douyinSupported,
        semanticAlignedApis: douyinSemanticAligned,
        fallbackApis: douyinFallback,
        totalApis: wxTotal,
        coverage: formatCoverage(douyinSupported),
        semanticCoverage: formatCoverage(douyinSemanticAligned),
      },
    ])
  })

  it('keeps top high-frequency alias mappings in sync', () => {
    const expectedMappings = [
      { method: 'chooseAddress', my: 'getAddress', tt: 'chooseAddress' },
      { method: 'createAudioContext', my: 'createInnerAudioContext', tt: 'createInnerAudioContext' },
      { method: 'createWebAudioContext', my: 'createInnerAudioContext', tt: 'createInnerAudioContext' },
      { method: 'getSystemInfoAsync', my: 'getSystemInfo', tt: 'getSystemInfo' },
      { method: 'openAppAuthorizeSetting', my: 'openSetting', tt: 'openSetting' },
      { method: 'pluginLogin', my: 'getAuthCode', tt: 'login' },
      { method: 'login', my: 'getAuthCode', tt: 'login' },
      { method: 'authorize', my: 'getAuthCode', tt: 'authorize' },
      { method: 'checkSession', my: 'getAuthCode', tt: 'checkSession' },
      { method: 'requestSubscribeDeviceMessage', my: 'requestSubscribeMessage', tt: 'requestSubscribeMessage' },
      { method: 'requestSubscribeEmployeeMessage', my: 'requestSubscribeMessage', tt: 'requestSubscribeMessage' },
      { method: 'restartMiniProgram', my: 'reLaunch', tt: 'reLaunch' },
      { method: 'scanCode', my: 'scan', tt: 'scanCode' },
      { method: 'requestPayment', my: 'tradePay', tt: 'pay' },
      { method: 'requestOrderPayment', my: 'tradePay', tt: 'pay' },
      { method: 'requestPluginPayment', my: 'tradePay', tt: 'pay' },
      { method: 'requestVirtualPayment', my: 'tradePay', tt: 'pay' },
      { method: 'previewMedia', my: 'previewImage', tt: 'previewImage' },
      { method: 'createInterstitialAd', my: 'createRewardedAd', tt: 'createInterstitialAd' },
      { method: 'createRewardedVideoAd', my: 'createRewardedAd', tt: 'createInterstitialAd' },
      { method: 'createLivePlayerContext', my: 'createVideoContext', tt: 'createLivePlayerContext' },
      { method: 'createLivePusherContext', my: 'createVideoContext', tt: 'createVideoContext' },
      { method: 'getVideoInfo', my: 'getVideoInfo', tt: 'getFileInfo' },
      { method: 'showShareImageMenu', my: 'showSharePanel', tt: 'showShareMenu' },
      { method: 'updateShareMenu', my: 'showSharePanel', tt: 'showShareMenu' },
      { method: 'openEmbeddedMiniProgram', my: 'navigateToMiniProgram', tt: 'navigateToMiniProgram' },
      { method: 'saveFileToDisk', my: 'saveFileToDisk', tt: 'saveFile' },
      { method: 'getEnterOptionsSync', my: 'getEnterOptionsSync', tt: 'getLaunchOptionsSync' },
      { method: 'getSystemSetting', my: 'getSystemSetting', tt: 'getSetting' },
      { method: 'getUserProfile', my: 'getOpenUserInfo', tt: 'getUserProfile' },
      { method: 'getUserInfo', my: 'getOpenUserInfo', tt: 'getUserInfo' },
      { method: 'getAppAuthorizeSetting', my: 'getAppAuthorizeSetting', tt: 'getSetting' },
      { method: 'getAppBaseInfo', my: 'getAppBaseInfo', tt: 'getEnvInfoSync' },
      { method: 'chooseVideo', my: 'chooseVideo', tt: 'chooseMedia' },
      { method: 'chooseMedia', my: 'chooseImage', tt: 'chooseMedia' },
      { method: 'chooseMessageFile', my: 'chooseImage', tt: 'chooseImage' },
      { method: 'getFuzzyLocation', my: 'getLocation', tt: 'getLocation' },
      { method: 'hideHomeButton', my: 'hideBackHome', tt: 'hideHomeButton' },
      { method: 'getWindowInfo', my: 'getWindowInfo', tt: 'getSystemInfo' },
      { method: 'getDeviceInfo', my: 'getSystemInfo', tt: 'getSystemInfo' },
      { method: 'getAccountInfoSync', my: 'getAccountInfoSync', tt: 'getEnvInfoSync' },
      { method: 'getLogManager', my: 'getLogManager', tt: 'getLogManager', mySupported: false, ttSupported: false },
      { method: 'nextTick', my: 'nextTick', tt: 'nextTick', mySupported: false, ttSupported: false },
      { method: 'onWindowResize', my: 'onWindowResize', tt: 'onWindowResize', mySupported: false },
      { method: 'offWindowResize', my: 'offWindowResize', tt: 'offWindowResize', mySupported: false },
      { method: 'reportAnalytics', my: 'reportAnalytics', tt: 'reportAnalytics', mySupported: false },
      { method: 'setBackgroundColor', my: 'setBackgroundColor', tt: 'setNavigationBarColor' },
      { method: 'setBackgroundTextStyle', my: 'setBackgroundTextStyle', tt: 'setNavigationBarColor' },
      { method: 'getNetworkType', my: 'getNetworkType', tt: 'getSystemInfo' },
      { method: 'getBatteryInfo', my: 'getBatteryInfo', tt: 'getSystemInfo' },
      { method: 'getBatteryInfoSync', my: 'getBatteryInfoSync', tt: 'getSystemInfoSync' },
      { method: 'saveVideoToPhotosAlbum', my: 'saveVideoToPhotosAlbum', tt: 'saveImageToPhotosAlbum' },
      { method: 'batchSetStorage', my: 'batchSetStorage', tt: 'batchSetStorage', mySupported: false, ttSupported: false },
      { method: 'batchGetStorage', my: 'batchGetStorage', tt: 'batchGetStorage', mySupported: false, ttSupported: false },
      { method: 'batchSetStorageSync', my: 'batchSetStorageSync', tt: 'batchSetStorageSync', mySupported: false, ttSupported: false },
      { method: 'batchGetStorageSync', my: 'batchGetStorageSync', tt: 'batchGetStorageSync', mySupported: false, ttSupported: false },
      { method: 'createCameraContext', my: 'createCameraContext', tt: 'createCameraContext', mySupported: false, ttSupported: false },
      { method: 'offMemoryWarning', my: 'offMemoryWarning', tt: 'offMemoryWarning', ttSupported: false },
      { method: 'cancelIdleCallback', my: 'cancelIdleCallback', tt: 'cancelIdleCallback', mySupported: false, ttSupported: false },
    ] as const

    for (const item of expectedMappings) {
      expect(generateMethodCompatibilityMatrix().find(mapping => mapping.method === item.method)).toMatchObject({
        method: item.method,
        alipayTarget: item.my,
        douyinTarget: item.tt,
        alipaySupported: item.mySupported ?? true,
        douyinSupported: item.ttSupported ?? true,
      })
    }
  })

  it('keeps support matrix data in sync with mappings', () => {
    const {
      extraDouyinMappings,
      missingCatalogMethods,
      missingDocs,
      missingDouyinMappings,
      missingMappings,
    } = validateSupportMatrixConsistency()
    expect(missingDocs).toEqual([])
    expect(missingMappings).toEqual([])
    expect(missingDouyinMappings).toEqual([])
    expect(extraDouyinMappings).toEqual([])
    expect(missingCatalogMethods).toEqual([])
    expect(WEAPI_PLATFORM_SUPPORT_MATRIX.map(item => item.platform)).toEqual([
      '微信小程序',
      '支付宝小程序',
      '抖音小程序',
      '其他平台（swan/jd/xhs 等）',
    ])
    const methodNames = WEAPI_METHOD_SUPPORT_MATRIX.map(item => item.method)
    const uniqueMethodNames = new Set(methodNames)
    expect(uniqueMethodNames.size).toBe(methodNames.length)
    expect(methodNames).toEqual(expect.arrayContaining([
      'showToast',
      'showLoading',
      'showActionSheet',
      'showModal',
      'chooseImage',
      'chooseMedia',
      'chooseMessageFile',
      'getFuzzyLocation',
      'saveFile',
      'setClipboardData',
      'getClipboardData',
      'chooseAddress',
      'createAudioContext',
      'createWebAudioContext',
      'getSystemInfoAsync',
      'openAppAuthorizeSetting',
      'pluginLogin',
      'requestSubscribeDeviceMessage',
      'requestSubscribeEmployeeMessage',
      'restartMiniProgram',
      'scanCode',
      'showShareImageMenu',
      'updateShareMenu',
      'openEmbeddedMiniProgram',
      'saveFileToDisk',
      'getEnterOptionsSync',
      'getSystemSetting',
      'getUserProfile',
      'getUserInfo',
      'getAppAuthorizeSetting',
      'getAppBaseInfo',
      'login',
      'chooseVideo',
      'hideHomeButton',
      'getWindowInfo',
      'getDeviceInfo',
      'getAccountInfoSync',
      'getLogManager',
      'nextTick',
      'onWindowResize',
      'offWindowResize',
      'reportAnalytics',
      'setBackgroundColor',
      'setBackgroundTextStyle',
      'getNetworkType',
      'getBatteryInfo',
      'getBatteryInfoSync',
      'saveVideoToPhotosAlbum',
      'batchSetStorage',
      'batchGetStorage',
      'batchSetStorageSync',
      'batchGetStorageSync',
      'createCameraContext',
      'offMemoryWarning',
      'cancelIdleCallback',
      'onBLEConnectionStateChange',
      'offBLEConnectionStateChange',
    ]))
  })
})
