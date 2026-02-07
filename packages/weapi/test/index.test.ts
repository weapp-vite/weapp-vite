import {
  generateApiSupportCoverageReport,
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

  it('normalizes platform alias for createWeapi', () => {
    const api = createWeapi({
      adapter: {},
      platform: 'douyin',
    })
    expect(api.platform).toBe('tt')
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
    expect(report.totalApis).toBe(WEAPI_METHOD_SUPPORT_MATRIX.length)
    expect(report.fullyAlignedApis).toBe(WEAPI_METHOD_SUPPORT_MATRIX.length)
    expect(report.fullyAlignedCoverage).toBe('100.00%')
    expect(report.platforms).toEqual([
      {
        platform: '微信小程序',
        alias: 'wx',
        supportedApis: WEAPI_METHOD_SUPPORT_MATRIX.length,
        totalApis: WEAPI_METHOD_SUPPORT_MATRIX.length,
        coverage: '100.00%',
      },
      {
        platform: '支付宝小程序',
        alias: 'my',
        supportedApis: WEAPI_METHOD_SUPPORT_MATRIX.length,
        totalApis: WEAPI_METHOD_SUPPORT_MATRIX.length,
        coverage: '100.00%',
      },
      {
        platform: '抖音小程序',
        alias: 'tt',
        supportedApis: WEAPI_METHOD_SUPPORT_MATRIX.length,
        totalApis: WEAPI_METHOD_SUPPORT_MATRIX.length,
        coverage: '100.00%',
      },
    ])
  })

  it('keeps support matrix data in sync with mappings', () => {
    const { missingDocs, missingMappings, missingDouyinMappings, extraDouyinMappings } = validateSupportMatrixConsistency()
    expect(missingDocs).toEqual([])
    expect(missingMappings).toEqual([])
    expect(missingDouyinMappings).toEqual([])
    expect(extraDouyinMappings).toEqual([])
    expect(WEAPI_PLATFORM_SUPPORT_MATRIX.map(item => item.platform)).toEqual([
      '微信小程序',
      '支付宝小程序',
      '抖音小程序',
      '其他平台（swan/jd/xhs 等）',
    ])
    expect(WEAPI_METHOD_SUPPORT_MATRIX.map(item => item.method)).toEqual([
      'showToast',
      'showLoading',
      'showActionSheet',
      'showModal',
      'chooseImage',
      'saveFile',
      'setClipboardData',
      'getClipboardData',
    ])
  })
})
