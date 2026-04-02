import { createTestWeapi } from '../helpers/createTestWeapi'

export function registerWeapiIndexDouyinDocumentAndDeviceCapabilityGuardsTests() {
  it('treats openDocument as unsupported for douyin when adapter method is missing', async () => {
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
    const api = createTestWeapi({
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
}
