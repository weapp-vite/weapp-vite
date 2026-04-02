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

  it('queues request/upload/download calls when concurrency exceeds 10 by default', () => {
    const pending: any[] = []
    const request = vi.fn((options: any) => {
      pending.push(options)
    })
    const overflowSuccess = vi.fn()
    const api = createTestWeapi({
      adapter: { request },
      platform: 'wx',
    })

    for (let i = 0; i < 10; i += 1) {
      api.request({ url: `https://example.com/${i}`, success() {} })
    }
    api.request({ url: 'https://example.com/overflow', success: overflowSuccess })
    expect(request).toHaveBeenCalledTimes(10)

    pending[0].success?.({ ok: true })
    expect(request).toHaveBeenCalledTimes(11)
    pending[10].success?.({ ok: 'overflow' })
    expect(overflowSuccess).toHaveBeenCalledWith(expect.objectContaining({
      ok: 'overflow',
    }))
  })

  it('queues connectSocket calls when concurrency exceeds 5 by default', () => {
    const pending: any[] = []
    const connectSocket = vi.fn((options: any) => {
      pending.push(options)
      return {}
    })
    const overflowSuccess = vi.fn()
    const api = createTestWeapi({
      adapter: { connectSocket },
      platform: 'wx',
    })

    for (let i = 0; i < 5; i += 1) {
      api.connectSocket({ url: `wss://example.com/${i}`, success() {} })
    }
    api.connectSocket({ url: 'wss://example.com/overflow', success: overflowSuccess })
    expect(connectSocket).toHaveBeenCalledTimes(5)

    pending[0].success?.({ ok: true })
    expect(connectSocket).toHaveBeenCalledTimes(6)
    pending[5].success?.({ ok: 'overflow' })
    expect(overflowSuccess).toHaveBeenCalledWith(expect.objectContaining({
      ok: 'overflow',
    }))
  })

  it('fails overflow request calls in strict overflow policy mode', () => {
    const pending: any[] = []
    const request = vi.fn((options: any) => {
      pending.push(options)
    })
    const fail = vi.fn()
    const complete = vi.fn()
    const api = createTestWeapi({
      adapter: { request },
      platform: 'wx',
      network: {
        overflowPolicy: 'strict',
      },
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
    expect(request).toHaveBeenCalledTimes(10)
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
