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
})
