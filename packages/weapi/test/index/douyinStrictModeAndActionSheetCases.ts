import { createWeapi } from '@/index'

export function registerWeapiIndexDouyinStrictModeAndActionSheetCasesTests() {
  it.each([
    'checkIsSoterEnrolledInDevice',
    'checkIsSupportSoterAuthentication',
  ])('keeps %s unsupported for douyin in strict mode', async (methodName) => {
    const api = createWeapi({
      adapter: {},
      platform: 'tt',
    }) as Record<string, any>
    expect(api.resolveTarget(methodName)).toMatchObject({
      method: methodName,
      target: methodName,
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api[methodName]({})).rejects.toMatchObject({
      errMsg: `tt.${methodName}:fail method not supported`,
    })
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats on/offBLEPeripheralConnectionStateChanged as unsupported for $platform without aliasing ble connection change events', async ({ platform, normalizedPlatform }) => {
    const onBLEConnectionStateChanged = vi.fn()
    const offBLEConnectionStateChanged = vi.fn()
    const api = createWeapi({
      adapter: {
        onBLEConnectionStateChanged,
        offBLEConnectionStateChanged,
      },
      platform,
    }) as Record<string, any>

    for (const methodName of ['onBLEPeripheralConnectionStateChanged', 'offBLEPeripheralConnectionStateChanged'] as const) {
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

    expect(onBLEConnectionStateChanged).not.toHaveBeenCalled()
    expect(offBLEConnectionStateChanged).not.toHaveBeenCalled()
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
    const onMemoryWarning = vi.fn()
    const api = createWeapi({
      adapter: {
        onMemoryWarning,
      },
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
    expect(onMemoryWarning).not.toHaveBeenCalled()
  })

  it.each([
    'onAppRoute',
    'onAppRouteDone',
    'offAppRoute',
    'offAppRouteDone',
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
}
