import { createWeapi } from '@/index'

export function registerWeapiIndexPart1Tests() {
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
}
