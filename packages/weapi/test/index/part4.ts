import { createWeapi } from '@/index'

export function registerWeapiIndexPart4Tests() {
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

  it('treats addPhoneCalendar as unsupported for alipay without aliasing addPhoneContact', async () => {
    const addPhoneContact = vi.fn((options: any) => {
      options.success?.({ errMsg: 'addPhoneContact:ok' })
    })
    const api = createWeapi({
      adapter: {
        addPhoneContact,
      },
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('addPhoneCalendar')).toMatchObject({
      method: 'addPhoneCalendar',
      target: 'addPhoneCalendar',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.addPhoneCalendar({
      title: 'demo',
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
    })).rejects.toMatchObject({
      errMsg: 'my.addPhoneCalendar:fail method not supported',
    })
    expect(addPhoneContact).not.toHaveBeenCalled()
  })

  it.each([
    'onWifiConnected',
    'offWifiConnected',
    'setWifiList',
  ])('treats %s as unsupported for douyin without aliasing near wifi apis', async (methodName) => {
    const onGetWifiList = vi.fn()
    const offGetWifiList = vi.fn()
    const getConnectedWifi = vi.fn()
    const getWifiList = vi.fn()
    const api = createWeapi({
      adapter: {
        onGetWifiList,
        offGetWifiList,
        getConnectedWifi,
        getWifiList,
      },
      platform: 'tt',
    }) as Record<string, any>

    expect(api.resolveTarget(methodName)).toMatchObject({
      method: methodName,
      target: methodName,
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })

    const payload = methodName === 'setWifiList' ? { wifiList: [] } : vi.fn()
    await expect(api[methodName](payload)).rejects.toMatchObject({
      errMsg: `tt.${methodName}:fail method not supported`,
    })

    expect(onGetWifiList).not.toHaveBeenCalled()
    expect(offGetWifiList).not.toHaveBeenCalled()
    expect(getConnectedWifi).not.toHaveBeenCalled()
    expect(getWifiList).not.toHaveBeenCalled()
  })
}
