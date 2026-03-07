import { createTestWeapi } from '../helpers/createTestWeapi'

export function registerWeapiIndexCrossPlatformAliasAndSystemInfoMappingTests() {
  it('treats chooseContact as unsupported for douyin without aliasing chooseAddress', async () => {
    const chooseAddress = vi.fn((options: any) => {
      options.success?.({
        userName: 'demo',
        telNumber: '13800000000',
      })
    })
    const api = createTestWeapi({
      adapter: {
        chooseAddress,
      },
      platform: 'tt',
    }) as Record<string, any>

    expect(api.resolveTarget('chooseContact')).toMatchObject({
      method: 'chooseContact',
      target: 'chooseContact',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.chooseContact()).rejects.toMatchObject({
      errMsg: 'tt.chooseContact:fail method not supported',
    })
    expect(chooseAddress).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats on/offWifiConnectedWithPartialInfo as unsupported for $platform without aliasing non-partial wifi events', async ({ platform, normalizedPlatform }) => {
    const onWifiConnected = vi.fn()
    const offWifiConnected = vi.fn()
    const onGetWifiList = vi.fn()
    const offGetWifiList = vi.fn()
    const api = createTestWeapi({
      adapter: {
        onWifiConnected,
        offWifiConnected,
        onGetWifiList,
        offGetWifiList,
      },
      platform,
    }) as Record<string, any>

    for (const methodName of ['onWifiConnectedWithPartialInfo', 'offWifiConnectedWithPartialInfo'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName](vi.fn())).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }

    expect(onWifiConnected).not.toHaveBeenCalled()
    expect(offWifiConnected).not.toHaveBeenCalled()
    expect(onGetWifiList).not.toHaveBeenCalled()
    expect(offGetWifiList).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats restartMiniProgram as unsupported for $platform without strict-equivalent api', async ({ platform, normalizedPlatform }) => {
    const reLaunch = vi.fn()
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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

  it('maps getSystemInfoAsync to strict-equivalent getSystemInfo for alipay', async () => {
    const getSystemInfo = vi.fn((options: any) => {
      options.success?.({
        platform: 'android',
        brand: 'alipay',
      })
    })
    const api = createTestWeapi({
      adapter: {
        getSystemInfo,
      },
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('getSystemInfoAsync')).toMatchObject({
      method: 'getSystemInfoAsync',
      target: 'getSystemInfo',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })

    const result = await api.getSystemInfoAsync()
    expect(getSystemInfo).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      platform: 'android',
      brand: 'alipay',
    })
  })

  it('treats getSystemInfoAsync as unsupported for alipay when mapped target is missing', async () => {
    const getSystemInfoSync = vi.fn()
    const api = createTestWeapi({
      adapter: {
        getSystemInfoSync,
      },
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('getSystemInfoAsync')).toMatchObject({
      method: 'getSystemInfoAsync',
      target: 'getSystemInfo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getSystemInfoAsync()).rejects.toMatchObject({
      errMsg: 'my.getSystemInfoAsync:fail method not supported',
    })
    expect(getSystemInfoSync).not.toHaveBeenCalled()
  })

  it('maps getSystemInfoAsync to strict-equivalent getSystemInfo for douyin', async () => {
    const getSystemInfo = vi.fn((options: any) => {
      options.success?.({
        platform: 'android',
        brand: 'douyin',
      })
    })
    const api = createTestWeapi({
      adapter: {
        getSystemInfo,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('getSystemInfoAsync')).toMatchObject({
      method: 'getSystemInfoAsync',
      target: 'getSystemInfo',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })

    const result = await api.getSystemInfoAsync()
    expect(getSystemInfo).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      platform: 'android',
      brand: 'douyin',
    })
  })

  it('maps hideHomeButton to hideBackHome for alipay', async () => {
    const hideBackHome = vi.fn((options: any) => {
      options.success?.({})
    })
    const api = createTestWeapi({
      adapter: {
        hideBackHome,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('hideHomeButton')).toMatchObject({
      method: 'hideHomeButton',
      target: 'hideBackHome',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })
    await expect(api.hideHomeButton()).resolves.toEqual({})
    expect(hideBackHome).toHaveBeenCalledTimes(1)
  })

  it('treats hideHomeButton as unsupported for alipay when hideBackHome is unavailable', async () => {
    const hideBackHome = vi.fn()
    const api = createTestWeapi({
      adapter: {},
      platform: 'alipay',
    })

    expect(api.resolveTarget('hideHomeButton')).toMatchObject({
      method: 'hideHomeButton',
      target: 'hideBackHome',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.hideHomeButton()).rejects.toMatchObject({
      errMsg: 'my.hideHomeButton:fail method not supported',
    })
    expect(hideBackHome).not.toHaveBeenCalled()
  })
}
