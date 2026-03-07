import { createWeapi } from '@/index'

export function registerWeapiIndexPart3Tests() {
  it('treats startSoterAuthentication as unsupported for alipay without strict-equivalent api', async () => {
    const startIfaaAuthentication = vi.fn((options: any) => {
      options.success?.({ resultJSONSignature: '{}' })
    })
    const api = createWeapi({
      adapter: {
        startIfaaAuthentication,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('startSoterAuthentication')).toMatchObject({
      method: 'startSoterAuthentication',
      target: 'startSoterAuthentication',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.startSoterAuthentication({
      requestAuthModes: ['fingerPrint'],
      challenge: 'challenge',
      authContent: 'auth',
    } as any)).rejects.toMatchObject({
      errMsg: 'my.startSoterAuthentication:fail method not supported',
    })
    expect(startIfaaAuthentication).not.toHaveBeenCalled()
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

  it('maps createBLEConnection/closeBLEConnection to strict-equivalent alipay ble methods', async () => {
    const connectBLEDevice = vi.fn((options: any) => {
      options.success?.({ error: '0', errorMessage: 'connect ok' })
    })
    const disconnectBLEDevice = vi.fn((options: any) => {
      options.success?.({ errorCode: '0', errorMessage: 'disconnect ok' })
    })
    const api = createWeapi({
      adapter: {
        connectBLEDevice,
        disconnectBLEDevice,
      },
      platform: 'alipay',
    }) as Record<string, any>

    for (const methodName of ['createBLEConnection', 'closeBLEConnection'] as const) {
      const expectedTarget = methodName === 'createBLEConnection' ? 'connectBLEDevice' : 'disconnectBLEDevice'
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: expectedTarget,
        supportLevel: 'mapped',
        supported: true,
        semanticAligned: true,
      })
    }

    await expect(api.createBLEConnection({
      deviceId: 'dev-1',
      timeout: 1000,
    })).resolves.toMatchObject({
      error: '0',
      errorMessage: 'connect ok',
      errCode: 0,
      errMsg: 'connect ok',
    })
    await expect(api.closeBLEConnection({
      deviceId: 'dev-1',
    })).resolves.toMatchObject({
      errorCode: '0',
      errorMessage: 'disconnect ok',
      errCode: 0,
      errMsg: 'disconnect ok',
    })

    expect(connectBLEDevice).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: 'dev-1',
      timeout: 1000,
    }))
    expect(disconnectBLEDevice).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: 'dev-1',
    }))
  })

  it('treats createBLEConnection/closeBLEConnection as unsupported for alipay when mapped target is missing', async () => {
    const api = createWeapi({
      adapter: {},
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('createBLEConnection')).toMatchObject({
      method: 'createBLEConnection',
      target: 'connectBLEDevice',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('closeBLEConnection')).toMatchObject({
      method: 'closeBLEConnection',
      target: 'disconnectBLEDevice',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createBLEConnection({
      deviceId: 'dev-1',
    })).rejects.toMatchObject({
      errMsg: 'my.createBLEConnection:fail method not supported',
    })
    await expect(api.closeBLEConnection({
      deviceId: 'dev-1',
    })).rejects.toMatchObject({
      errMsg: 'my.closeBLEConnection:fail method not supported',
    })
  })

  it('treats createBLEConnection/closeBLEConnection as unsupported for douyin without strict-equivalent api', async () => {
    const connectBLEDevice = vi.fn()
    const disconnectBLEDevice = vi.fn()
    const api = createWeapi({
      adapter: {
        connectBLEDevice,
        disconnectBLEDevice,
      },
      platform: 'tt',
    }) as Record<string, any>

    for (const methodName of ['createBLEConnection', 'closeBLEConnection'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({
        deviceId: 'dev-1',
      })).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }
    expect(connectBLEDevice).not.toHaveBeenCalled()
    expect(disconnectBLEDevice).not.toHaveBeenCalled()
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
}
