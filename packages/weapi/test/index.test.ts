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

  it('treats chooseAddress as unsupported for alipay without strict-equivalent api', async () => {
    const getAddress = vi.fn((options: any) => {
      options.success?.({ provinceName: 'Zhejiang' })
    })
    const api = createWeapi({
      adapter: {
        getAddress,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('chooseAddress')).toMatchObject({
      method: 'chooseAddress',
      target: 'chooseAddress',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.chooseAddress()).rejects.toMatchObject({
      errMsg: 'my.chooseAddress:fail method not supported',
    })
    expect(getAddress).not.toHaveBeenCalled()
  })

  it('treats chooseMedia as unsupported for alipay without strict-equivalent api', async () => {
    const chooseImage = vi.fn()
    const api = createWeapi({
      adapter: {
        chooseImage,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('chooseMedia')).toMatchObject({
      method: 'chooseMedia',
      target: 'chooseMedia',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.chooseMedia({
      count: 2,
      mediaType: ['image'],
      sourceType: ['album'],
    } as any)).rejects.toMatchObject({
      errMsg: 'my.chooseMedia:fail method not supported',
    })
    expect(chooseImage).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('treats chooseMessageFile as unsupported for $platform without strict-equivalent api', async ({ platform }) => {
    const normalizedPlatform = platform === 'alipay' ? 'my' : platform
    const chooseImage = vi.fn()
    const api = createWeapi({
      adapter: {
        chooseImage,
      },
      platform,
    })

    expect(api.resolveTarget('chooseMessageFile')).toMatchObject({
      method: 'chooseMessageFile',
      target: 'chooseMessageFile',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.chooseMessageFile({
      count: 1,
      type: 'file',
    } as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.chooseMessageFile:fail method not supported`,
    })
    expect(chooseImage).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('treats getFuzzyLocation as unsupported for $platform without strict-equivalent api', async ({ platform }) => {
    const normalizedPlatform = platform === 'alipay' ? 'my' : platform
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

    expect(api.resolveTarget('getFuzzyLocation')).toMatchObject({
      method: 'getFuzzyLocation',
      target: 'getFuzzyLocation',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getFuzzyLocation({
      type: 'wgs84',
    } as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.getFuzzyLocation:fail method not supported`,
    })
    expect(getLocation).not.toHaveBeenCalled()
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

  it('treats login, authorize and checkSession as unsupported for alipay', async () => {
    const getAuthCode = vi.fn()
    const api = createWeapi({
      adapter: {
        getAuthCode,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('login')).toMatchObject({
      method: 'login',
      target: 'login',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.login()).rejects.toMatchObject({
      errMsg: 'my.login:fail method not supported',
    })

    expect(api.resolveTarget('authorize')).toMatchObject({
      method: 'authorize',
      target: 'authorize',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.authorize({ scope: 'scope.userInfo' } as any)).rejects.toMatchObject({
      errMsg: 'my.authorize:fail method not supported',
    })

    expect(api.resolveTarget('checkSession')).toMatchObject({
      method: 'checkSession',
      target: 'checkSession',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.checkSession()).rejects.toMatchObject({
      errMsg: 'my.checkSession:fail method not supported',
    })

    expect(getAuthCode).not.toHaveBeenCalled()
  })

  it('treats getUserProfile/getUserInfo as unsupported for alipay without strict-equivalent api', async () => {
    const getOpenUserInfo = vi.fn((options: any) => {
      options.success?.({
        nickName: 'demo',
      })
    })
    const api = createWeapi({
      adapter: {
        getOpenUserInfo,
      },
      platform: 'alipay',
    })

    for (const methodName of ['getUserProfile', 'getUserInfo'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({ desc: 'need profile' } as any)).rejects.toMatchObject({
        errMsg: `my.${methodName}:fail method not supported`,
      })
    }
    expect(getOpenUserInfo).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats requestSubscribe*Message as unsupported for $platform without strict-equivalent api', async ({ platform, normalizedPlatform }) => {
    const requestSubscribeMessage = vi.fn()
    const api = createWeapi({
      adapter: {
        requestSubscribeMessage,
      },
      platform,
    }) as Record<string, any>

    for (const methodName of ['requestSubscribeDeviceMessage', 'requestSubscribeEmployeeMessage'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({ tmplIds: ['t1'] })).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }

    expect(requestSubscribeMessage).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats restartMiniProgram as unsupported for $platform without strict-equivalent api', async ({ platform, normalizedPlatform }) => {
    const reLaunch = vi.fn()
    const api = createWeapi({
      adapter: {
        reLaunch,
      },
      platform,
    }) as Record<string, any>

    expect(api.resolveTarget('restartMiniProgram')).toMatchObject({
      method: 'restartMiniProgram',
      target: 'restartMiniProgram',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.restartMiniProgram()).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.restartMiniProgram:fail method not supported`,
    })
    expect(reLaunch).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats openAppAuthorizeSetting as unsupported for $platform without strict-equivalent api', async ({ platform, normalizedPlatform }) => {
    const openSetting = vi.fn()
    const api = createWeapi({
      adapter: {
        openSetting,
      },
      platform,
    }) as Record<string, any>

    expect(api.resolveTarget('openAppAuthorizeSetting')).toMatchObject({
      method: 'openAppAuthorizeSetting',
      target: 'openAppAuthorizeSetting',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.openAppAuthorizeSetting()).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.openAppAuthorizeSetting:fail method not supported`,
    })
    expect(openSetting).not.toHaveBeenCalled()
  })

  it('treats hideHomeButton as unsupported for alipay without strict-equivalent api', async () => {
    const hideBackHome = vi.fn((options: any) => {
      options.success?.({})
    })
    const api = createWeapi({
      adapter: {
        hideBackHome,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('hideHomeButton')).toMatchObject({
      method: 'hideHomeButton',
      target: 'hideHomeButton',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.hideHomeButton()).rejects.toMatchObject({
      errMsg: 'my.hideHomeButton:fail method not supported',
    })
    expect(hideBackHome).not.toHaveBeenCalled()
  })

  it('treats scanCode as unsupported for alipay without strict-equivalent api', async () => {
    const scan = vi.fn()
    const api = createWeapi({
      adapter: {
        scan,
      },
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('scanCode')).toMatchObject({
      method: 'scanCode',
      target: 'scanCode',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.scanCode()).rejects.toMatchObject({
      errMsg: 'my.scanCode:fail method not supported',
    })
    expect(scan).not.toHaveBeenCalled()
  })

  it('treats requestPayment family as unsupported for alipay', async () => {
    const tradePay = vi.fn()
    const api = createWeapi({
      adapter: {
        tradePay,
      },
      platform: 'alipay',
    })

    for (const methodName of ['requestPayment', 'requestOrderPayment', 'requestPluginPayment', 'requestVirtualPayment'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({ package: 'prepay=1' })).rejects.toMatchObject({
        errMsg: `my.${methodName}:fail method not supported`,
      })
    }

    expect(tradePay).not.toHaveBeenCalled()
  })

  it('treats requestPayment family as unsupported for douyin', async () => {
    const pay = vi.fn()
    const api = createWeapi({
      adapter: {
        pay,
      },
      platform: 'tt',
    })

    for (const methodName of ['requestPayment', 'requestOrderPayment', 'requestPluginPayment', 'requestVirtualPayment'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({ package: 'order-info-1' })).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }

    expect(pay).not.toHaveBeenCalled()
  })

  it.each([
    'requestPayment',
    'requestOrderPayment',
    'requestPluginPayment',
    'requestVirtualPayment',
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
      await expect(api[methodName]({ package: 'test' })).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it('treats previewMedia as unsupported for alipay without strict-equivalent api', async () => {
    const previewImage = vi.fn((options: any) => {
      options.success?.({ errMsg: 'previewImage:ok' })
    })
    const api = createWeapi({
      adapter: {
        previewImage,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('previewMedia')).toMatchObject({
      method: 'previewMedia',
      target: 'previewMedia',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.previewMedia({
      sources: [
        { url: 'https://example.com/a.jpg', type: 'image' },
        { url: 'https://example.com/b.jpg', type: 'image' },
      ],
      current: 1,
    } as any)).rejects.toMatchObject({
      errMsg: 'my.previewMedia:fail method not supported',
    })
    expect(previewImage).not.toHaveBeenCalled()
  })

  it('treats rewarded ad api and live contexts as unsupported for alipay', async () => {
    const createRewardedAd = vi.fn(() => ({ show: vi.fn() }))
    const createVideoContext = vi.fn(() => ({ play: vi.fn() }))
    const api = createWeapi({
      adapter: {
        createRewardedAd,
        createVideoContext,
      },
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('createRewardedVideoAd')).toMatchObject({
      method: 'createRewardedVideoAd',
      target: 'createRewardedVideoAd',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createRewardedVideoAd({ adUnitId: 'adunit-2' } as any)).rejects.toMatchObject({
      errMsg: 'my.createRewardedVideoAd:fail method not supported',
    })
    expect(createRewardedAd).not.toHaveBeenCalled()
    expect(createVideoContext).not.toHaveBeenCalled()

    expect(api.resolveTarget('createInterstitialAd')).toMatchObject({
      method: 'createInterstitialAd',
      target: 'createInterstitialAd',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createInterstitialAd({ adUnitId: 'adunit-1' })).rejects.toMatchObject({
      errMsg: 'my.createInterstitialAd:fail method not supported',
    })
    expect(api.resolveTarget('createLivePlayerContext')).toMatchObject({
      method: 'createLivePlayerContext',
      target: 'createLivePlayerContext',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('createLivePusherContext')).toMatchObject({
      method: 'createLivePusherContext',
      target: 'createLivePusherContext',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createLivePlayerContext('live-player' as any)).rejects.toMatchObject({
      errMsg: 'my.createLivePlayerContext:fail method not supported',
    })
    await expect(api.createLivePusherContext('live-pusher' as any)).rejects.toMatchObject({
      errMsg: 'my.createLivePusherContext:fail method not supported',
    })
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
    'createAudioContext',
    'createWebAudioContext',
    'pluginLogin',
    'showShareImageMenu',
    'updateShareMenu',
    'openEmbeddedMiniProgram',
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

  it('treats saveVideoToPhotosAlbum as unsupported for douyin without strict-equivalent api', async () => {
    const saveImageToPhotosAlbum = vi.fn((options: any) => {
      options.success?.({ errMsg: 'saveImageToPhotosAlbum:ok' })
    })
    const api = createWeapi({
      adapter: {
        saveImageToPhotosAlbum,
      },
      platform: 'tt',
    })

    await expect(api.saveVideoToPhotosAlbum({
      filePath: '/tmp/demo.mp4',
    } as any)).rejects.toMatchObject({
      errMsg: 'tt.saveVideoToPhotosAlbum:fail method not supported',
    })
    expect(saveImageToPhotosAlbum).not.toHaveBeenCalled()
  })

  it('treats chooseVideo as unsupported for douyin without strict-equivalent api', async () => {
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

    expect(api.resolveTarget('chooseVideo')).toMatchObject({
      method: 'chooseVideo',
      target: 'chooseVideo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.chooseVideo({
      compressed: false,
      camera: 'back',
      sourceType: ['camera'],
    })).rejects.toMatchObject({
      errMsg: 'tt.chooseVideo:fail method not supported',
    })
    expect(chooseMedia).not.toHaveBeenCalled()
  })

  it('treats getWindowInfo as unsupported for douyin without strict-equivalent api', async () => {
    const getSystemInfo = vi.fn()
    const api = createWeapi({
      adapter: {
        getSystemInfo,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('getWindowInfo')).toMatchObject({
      method: 'getWindowInfo',
      target: 'getWindowInfo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getWindowInfo()).rejects.toMatchObject({
      errMsg: 'tt.getWindowInfo:fail method not supported',
    })
    expect(getSystemInfo).not.toHaveBeenCalled()
  })

  it('treats setBackgroundColor/setBackgroundTextStyle as unsupported for douyin without strict-equivalent api', async () => {
    const setNavigationBarColor = vi.fn()
    const api = createWeapi({
      adapter: {
        setNavigationBarColor,
      },
      platform: 'tt',
    })

    for (const methodName of ['setBackgroundColor', 'setBackgroundTextStyle'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({
        backgroundColorTop: '#112233',
        textStyle: 'light',
      })).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }
    expect(setNavigationBarColor).not.toHaveBeenCalled()
  })

  it('treats getNetworkType as unsupported for douyin without strict-equivalent api', async () => {
    const getSystemInfo = vi.fn()
    const api = createWeapi({
      adapter: {
        getSystemInfo,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('getNetworkType')).toMatchObject({
      method: 'getNetworkType',
      target: 'getNetworkType',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getNetworkType()).rejects.toMatchObject({
      errMsg: 'tt.getNetworkType:fail method not supported',
    })
    expect(getSystemInfo).not.toHaveBeenCalled()
  })

  it('treats getBatteryInfo/getBatteryInfoSync as unsupported for douyin without strict-equivalent api', async () => {
    const getSystemInfo = vi.fn()
    const getSystemInfoSync = vi.fn()
    const api = createWeapi({
      adapter: {
        getSystemInfo,
        getSystemInfoSync,
      },
      platform: 'tt',
    })

    for (const methodName of ['getBatteryInfo', 'getBatteryInfoSync'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]()).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }

    expect(getSystemInfo).not.toHaveBeenCalled()
    expect(getSystemInfoSync).not.toHaveBeenCalled()
  })

  it.each([
    'getNetworkType',
    'getBatteryInfo',
    'getBatteryInfoSync',
  ])('treats %s as unsupported in strict compatibility mode', async (methodName) => {
    const api = createWeapi({
      adapter: {},
      platform: 'tt',
    })

    expect(api.resolveTarget(methodName)).toMatchObject({
      method: methodName,
      target: methodName,
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api[methodName]()).rejects.toMatchObject({
      errMsg: `tt.${methodName}:fail method not supported`,
    })
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats getDeviceInfo as unsupported for $platform without strict-equivalent api', async ({ platform, normalizedPlatform }) => {
    const getSystemInfo = vi.fn()
    const api = createWeapi({
      adapter: {
        getSystemInfo,
      },
      platform,
    })

    expect(api.resolveTarget('getDeviceInfo')).toMatchObject({
      method: 'getDeviceInfo',
      target: 'getDeviceInfo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getDeviceInfo()).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.getDeviceInfo:fail method not supported`,
    })
    expect(getSystemInfo).not.toHaveBeenCalled()
  })

  it('treats getAppBaseInfo/getAccountInfoSync as unsupported for douyin without strict-equivalent api', async () => {
    const getEnvInfoSync = vi.fn()
    const api = createWeapi({
      adapter: {
        getEnvInfoSync,
      },
      platform: 'tt',
    })

    for (const methodName of ['getAppBaseInfo', 'getAccountInfoSync'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]()).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }
    expect(getEnvInfoSync).not.toHaveBeenCalled()
  })

  it('treats getEnterOptionsSync as unsupported for douyin without strict-equivalent api', async () => {
    const getLaunchOptionsSync = vi.fn(() => ({
      path: 'pages/index/index',
      query: {},
      scene: 1001,
    }))
    const api = createWeapi({
      adapter: {
        getLaunchOptionsSync,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('getEnterOptionsSync')).toMatchObject({
      method: 'getEnterOptionsSync',
      target: 'getEnterOptionsSync',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getEnterOptionsSync()).rejects.toMatchObject({
      errMsg: 'tt.getEnterOptionsSync:fail method not supported',
    })
    expect(getLaunchOptionsSync).not.toHaveBeenCalled()
  })

  it('treats previewMedia as unsupported for douyin without strict-equivalent api', async () => {
    const previewImage = vi.fn((options: any) => {
      options.success?.({ errMsg: 'previewImage:ok' })
    })
    const api = createWeapi({
      adapter: {
        previewImage,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('previewMedia')).toMatchObject({
      method: 'previewMedia',
      target: 'previewMedia',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.previewMedia({
      sources: [
        { url: 'https://example.com/c.jpg', type: 'image' },
      ],
      current: 0,
    } as any)).rejects.toMatchObject({
      errMsg: 'tt.previewMedia:fail method not supported',
    })
    expect(previewImage).not.toHaveBeenCalled()
  })

  it('treats getVideoInfo as unsupported for douyin without strict-equivalent api', async () => {
    const getFileInfo = vi.fn((options: any) => {
      options.success?.({ size: 1024 })
    })
    const api = createWeapi({
      adapter: {
        getFileInfo,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('getVideoInfo')).toMatchObject({
      method: 'getVideoInfo',
      target: 'getVideoInfo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getVideoInfo({ src: '/tmp/demo.mp4' } as any)).rejects.toMatchObject({
      errMsg: 'tt.getVideoInfo:fail method not supported',
    })
    expect(getFileInfo).not.toHaveBeenCalled()
  })

  it('treats saveFileToDisk as unsupported for douyin without strict-equivalent api', async () => {
    const saveFile = vi.fn((options: any) => {
      options.success?.({ savedFilePath: '/tmp/tt-saved.txt' })
    })
    const api = createWeapi({
      adapter: {
        saveFile,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('saveFileToDisk')).toMatchObject({
      method: 'saveFileToDisk',
      target: 'saveFileToDisk',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.saveFileToDisk({ filePath: '/tmp/tt-temp.txt' } as any)).rejects.toMatchObject({
      errMsg: 'tt.saveFileToDisk:fail method not supported',
    })
    expect(saveFile).not.toHaveBeenCalled()
  })

  it('treats getSystemSetting/getAppAuthorizeSetting as unsupported for douyin without strict-equivalent api', async () => {
    const getSetting = vi.fn((options: any) => {
      options.success?.({ authSetting: { 'scope.userInfo': true } })
    })
    const api = createWeapi({
      adapter: {
        getSetting,
      },
      platform: 'tt',
    })

    for (const methodName of ['getSystemSetting', 'getAppAuthorizeSetting'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]()).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }
    expect(getSetting).not.toHaveBeenCalled()
  })

  it('maps interstitial and live-player context apis for douyin', async () => {
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
    api.createLivePlayerContext('tt-live-player')

    expect(createInterstitialAd).toHaveBeenNthCalledWith(1, expect.objectContaining({ adUnitId: 'tt-ad-1' }))
    expect(createLivePlayerContext).toHaveBeenNthCalledWith(1, 'tt-live-player', expect.any(Object))
    expect(createVideoContext).not.toHaveBeenCalled()

    expect(api.resolveTarget('createLivePusherContext')).toMatchObject({
      method: 'createLivePusherContext',
      target: 'createLivePusherContext',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createLivePusherContext('tt-live-pusher' as any)).rejects.toMatchObject({
      errMsg: 'tt.createLivePusherContext:fail method not supported',
    })
  })

  it('treats createRewardedVideoAd as unsupported for douyin without strict-equivalent api', async () => {
    const createInterstitialAd = vi.fn(() => ({ show: vi.fn() }))
    const api = createWeapi({
      adapter: {
        createInterstitialAd,
      },
      platform: 'tt',
    })
    expect(api.resolveTarget('createRewardedVideoAd')).toMatchObject({
      method: 'createRewardedVideoAd',
      target: 'createRewardedVideoAd',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createRewardedVideoAd({ adUnitId: 'tt-ad-2' } as any)).rejects.toMatchObject({
      errMsg: 'tt.createRewardedVideoAd:fail method not supported',
    })
    expect(createInterstitialAd).not.toHaveBeenCalled()
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
      { method: 'chooseAddress', my: 'chooseAddress', tt: 'chooseAddress', mySupported: false },
      { method: 'createAudioContext', my: 'createAudioContext', tt: 'createAudioContext', mySupported: false, ttSupported: false },
      { method: 'createWebAudioContext', my: 'createWebAudioContext', tt: 'createWebAudioContext', mySupported: false, ttSupported: false },
      { method: 'getSystemInfoAsync', my: 'getSystemInfo', tt: 'getSystemInfo' },
      { method: 'openAppAuthorizeSetting', my: 'openAppAuthorizeSetting', tt: 'openAppAuthorizeSetting', mySupported: false, ttSupported: false },
      { method: 'pluginLogin', my: 'pluginLogin', tt: 'pluginLogin', mySupported: false, ttSupported: false },
      { method: 'login', my: 'login', tt: 'login', mySupported: false },
      { method: 'authorize', my: 'authorize', tt: 'authorize', mySupported: false },
      { method: 'checkSession', my: 'checkSession', tt: 'checkSession', mySupported: false },
      { method: 'requestSubscribeDeviceMessage', my: 'requestSubscribeDeviceMessage', tt: 'requestSubscribeDeviceMessage', mySupported: false, ttSupported: false },
      { method: 'requestSubscribeEmployeeMessage', my: 'requestSubscribeEmployeeMessage', tt: 'requestSubscribeEmployeeMessage', mySupported: false, ttSupported: false },
      { method: 'restartMiniProgram', my: 'restartMiniProgram', tt: 'restartMiniProgram', mySupported: false, ttSupported: false },
      { method: 'scanCode', my: 'scanCode', tt: 'scanCode', mySupported: false },
      { method: 'requestPayment', my: 'requestPayment', tt: 'requestPayment', mySupported: false, ttSupported: false },
      { method: 'requestOrderPayment', my: 'requestOrderPayment', tt: 'requestOrderPayment', mySupported: false, ttSupported: false },
      { method: 'requestPluginPayment', my: 'requestPluginPayment', tt: 'requestPluginPayment', mySupported: false, ttSupported: false },
      { method: 'requestVirtualPayment', my: 'requestVirtualPayment', tt: 'requestVirtualPayment', mySupported: false, ttSupported: false },
      { method: 'previewMedia', my: 'previewMedia', tt: 'previewMedia', mySupported: false, ttSupported: false },
      { method: 'createInterstitialAd', my: 'createInterstitialAd', tt: 'createInterstitialAd', mySupported: false },
      { method: 'createRewardedVideoAd', my: 'createRewardedVideoAd', tt: 'createRewardedVideoAd', mySupported: false, ttSupported: false },
      { method: 'createLivePlayerContext', my: 'createLivePlayerContext', tt: 'createLivePlayerContext', mySupported: false },
      { method: 'createLivePusherContext', my: 'createLivePusherContext', tt: 'createLivePusherContext', mySupported: false, ttSupported: false },
      { method: 'getVideoInfo', my: 'getVideoInfo', tt: 'getVideoInfo', ttSupported: false },
      { method: 'showShareImageMenu', my: 'showShareImageMenu', tt: 'showShareImageMenu', mySupported: false, ttSupported: false },
      { method: 'updateShareMenu', my: 'updateShareMenu', tt: 'updateShareMenu', mySupported: false, ttSupported: false },
      { method: 'openEmbeddedMiniProgram', my: 'openEmbeddedMiniProgram', tt: 'openEmbeddedMiniProgram', mySupported: false, ttSupported: false },
      { method: 'saveFileToDisk', my: 'saveFileToDisk', tt: 'saveFileToDisk', ttSupported: false },
      { method: 'getEnterOptionsSync', my: 'getEnterOptionsSync', tt: 'getEnterOptionsSync', ttSupported: false },
      { method: 'getSystemSetting', my: 'getSystemSetting', tt: 'getSystemSetting', ttSupported: false },
      { method: 'getUserProfile', my: 'getUserProfile', tt: 'getUserProfile', mySupported: false },
      { method: 'getUserInfo', my: 'getUserInfo', tt: 'getUserInfo', mySupported: false },
      { method: 'getAppAuthorizeSetting', my: 'getAppAuthorizeSetting', tt: 'getAppAuthorizeSetting', ttSupported: false },
      { method: 'getAppBaseInfo', my: 'getAppBaseInfo', tt: 'getAppBaseInfo', ttSupported: false },
      { method: 'chooseVideo', my: 'chooseVideo', tt: 'chooseVideo', ttSupported: false },
      { method: 'chooseMedia', my: 'chooseMedia', tt: 'chooseMedia', mySupported: false },
      { method: 'chooseMessageFile', my: 'chooseMessageFile', tt: 'chooseMessageFile', mySupported: false, ttSupported: false },
      { method: 'getFuzzyLocation', my: 'getFuzzyLocation', tt: 'getFuzzyLocation', mySupported: false, ttSupported: false },
      { method: 'hideHomeButton', my: 'hideHomeButton', tt: 'hideHomeButton', mySupported: false },
      { method: 'getWindowInfo', my: 'getWindowInfo', tt: 'getWindowInfo', ttSupported: false },
      { method: 'getDeviceInfo', my: 'getDeviceInfo', tt: 'getDeviceInfo', mySupported: false, ttSupported: false },
      { method: 'getAccountInfoSync', my: 'getAccountInfoSync', tt: 'getAccountInfoSync', ttSupported: false },
      { method: 'getLogManager', my: 'getLogManager', tt: 'getLogManager', mySupported: false, ttSupported: false },
      { method: 'nextTick', my: 'nextTick', tt: 'nextTick', mySupported: false, ttSupported: false },
      { method: 'onWindowResize', my: 'onWindowResize', tt: 'onWindowResize', mySupported: false },
      { method: 'offWindowResize', my: 'offWindowResize', tt: 'offWindowResize', mySupported: false },
      { method: 'reportAnalytics', my: 'reportAnalytics', tt: 'reportAnalytics', mySupported: false },
      { method: 'setBackgroundColor', my: 'setBackgroundColor', tt: 'setBackgroundColor', ttSupported: false },
      { method: 'setBackgroundTextStyle', my: 'setBackgroundTextStyle', tt: 'setBackgroundTextStyle', ttSupported: false },
      { method: 'getNetworkType', my: 'getNetworkType', tt: 'getNetworkType', ttSupported: false },
      { method: 'getBatteryInfo', my: 'getBatteryInfo', tt: 'getBatteryInfo', ttSupported: false },
      { method: 'getBatteryInfoSync', my: 'getBatteryInfoSync', tt: 'getBatteryInfoSync', ttSupported: false },
      { method: 'saveVideoToPhotosAlbum', my: 'saveVideoToPhotosAlbum', tt: 'saveVideoToPhotosAlbum', ttSupported: false },
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
