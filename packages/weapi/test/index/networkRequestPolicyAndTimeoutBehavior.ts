import { createTestWeapi } from '../helpers/createTestWeapi'

function setHostNetworkTimeout(timeout?: Partial<Record<'request' | 'uploadFile' | 'downloadFile' | 'connectSocket', number>>) {
  const hostGlobal = globalThis as any
  if (!timeout) {
    delete hostGlobal.__wxConfig
    return
  }
  hostGlobal.__wxConfig = {
    networkTimeout: timeout,
  }
}

export function registerWeapiIndexNetworkRequestPolicyAndTimeoutBehaviorTests() {
  afterEach(() => {
    setHostNetworkTimeout(undefined)
    vi.useRealTimers()
  })

  it('applies default request timeout 60s', async () => {
    const request = vi.fn((options: any) => {
      options.success?.({ ok: true })
    })
    const api = createTestWeapi({
      adapter: { request },
      platform: 'wx',
    })

    await api.request({ url: 'https://example.com' })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 60_000,
    }))
  })

  it('reads network timeout from __wxConfig.networkTimeout', async () => {
    setHostNetworkTimeout({
      downloadFile: 15_000,
    })
    const downloadFile = vi.fn((options: any) => {
      options.success?.({ tempFilePath: '/tmp/demo.png' })
    })
    const api = createTestWeapi({
      adapter: { downloadFile },
      platform: 'wx',
    })

    await api.downloadFile({ url: 'https://example.com/demo.png' })

    expect(downloadFile).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 15_000,
    }))
  })

  it('keeps per-call timeout priority over host config', async () => {
    setHostNetworkTimeout({
      request: 20_000,
    })
    const request = vi.fn((options: any) => {
      options.success?.({ ok: true })
    })
    const api = createTestWeapi({
      adapter: { request },
      platform: 'wx',
    })

    await api.request({
      url: 'https://example.com',
      timeout: 5_000,
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 5_000,
    }))
  })

  it('strips referer header in request options', async () => {
    const request = vi.fn((options: any) => {
      options.success?.({ ok: true })
    })
    const api = createTestWeapi({
      adapter: { request },
      platform: 'wx',
    })

    await api.request({
      url: 'https://example.com',
      header: {
        Referer: 'https://malicious.example.com',
        referer: 'https://malicious2.example.com',
        Authorization: 'Bearer demo',
      },
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      header: {
        Authorization: 'Bearer demo',
      },
    }))
  })

  it('limits request/upload/download total concurrency to 10', () => {
    const pending: any[] = []
    const request = vi.fn((options: any) => {
      pending.push(options)
    })
    const fail = vi.fn()
    const complete = vi.fn()
    const api = createTestWeapi({
      adapter: { request },
      platform: 'wx',
    })

    for (let i = 0; i < 10; i += 1) {
      api.request({ url: `https://example.com/${i}`, success() {} })
    }
    api.request({ url: 'https://example.com/overflow', fail, complete })

    expect(fail).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: 'wx.request:fail exceed max concurrency limit 10',
    }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: 'wx.request:fail exceed max concurrency limit 10',
    }))

    for (const options of pending) {
      options.success?.({ ok: true })
    }
  })

  it('limits connectSocket concurrency to 5', () => {
    const pending: any[] = []
    const connectSocket = vi.fn((options: any) => {
      pending.push(options)
      return {}
    })
    const fail = vi.fn()
    const complete = vi.fn()
    const api = createTestWeapi({
      adapter: { connectSocket },
      platform: 'wx',
    })

    for (let i = 0; i < 5; i += 1) {
      api.connectSocket({ url: `wss://example.com/${i}`, success() {} })
    }
    api.connectSocket({ url: 'wss://example.com/overflow', fail, complete })

    expect(fail).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: 'wx.connectSocket:fail exceed max concurrency limit 5',
    }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: 'wx.connectSocket:fail exceed max concurrency limit 5',
    }))

    for (const options of pending) {
      options.success?.({ ok: true })
    }
  })

  it('fails running request with interrupted after app goes background for 5s', async () => {
    vi.useFakeTimers()
    let onAppHide: (() => void) | undefined
    let onAppShow: (() => void) | undefined
    const abort = vi.fn()
    const request = vi.fn((_options: any) => ({ abort }))
    const api = createTestWeapi({
      adapter: {
        request,
        onAppHide(handler: () => void) {
          onAppHide = handler
        },
        onAppShow(handler: () => void) {
          onAppShow = handler
        },
      },
      platform: 'wx',
    })

    const promise = api.request({ url: 'https://example.com/pending' })
    const rejected = expect(promise).rejects.toMatchObject({
      errMsg: 'wx.request:fail interrupted',
    })
    onAppHide?.()
    await vi.advanceTimersByTimeAsync(5_000)

    await rejected
    expect(abort).toHaveBeenCalledTimes(1)
    expect(onAppShow).toBeTypeOf('function')
  })

  it('blocks new request calls while app is in background', async () => {
    vi.useFakeTimers()
    let onAppHide: (() => void) | undefined
    let onAppShow: (() => void) | undefined
    const request = vi.fn((options: any) => {
      options.success?.({ ok: true })
    })
    const api = createTestWeapi({
      adapter: {
        request,
        onAppHide(handler: () => void) {
          onAppHide = handler
        },
        onAppShow(handler: () => void) {
          onAppShow = handler
        },
      },
      platform: 'wx',
    })

    await api.request({ url: 'https://example.com/bind-listeners-first' })
    onAppHide?.()
    await expect(api.request({ url: 'https://example.com/blocked' })).rejects.toMatchObject({
      errMsg: 'wx.request:fail interrupted',
    })

    onAppShow?.()
    await expect(api.request({ url: 'https://example.com/allowed' })).resolves.toMatchObject({
      ok: true,
    })
  })
}
