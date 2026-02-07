import {
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

  it('keeps support matrix data in sync with mappings', () => {
    const { missingDocs, missingMappings } = validateSupportMatrixConsistency()
    expect(missingDocs).toEqual([])
    expect(missingMappings).toEqual([])
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
