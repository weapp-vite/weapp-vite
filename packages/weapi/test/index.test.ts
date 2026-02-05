import { createWeapi } from '@/index'

describe('weapi', () => {
  it('promisifies when no callbacks provided', async () => {
    const adapter = {
      request(options: { success?: (res: any) => void }) {
        options.success?.({ ok: true })
      },
    }
    const api = createWeapi({ adapter, platform: 'wx' })
    const res = await api.request({ url: 'https://example.com' })
    expect(res).toEqual({ ok: true })
  })

  it('keeps callback style when callbacks provided', () => {
    const adapter = {
      request(options: { success?: (res: any) => void }) {
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
    const api = createWeapi({ adapter: {}, platform: 'wx' })
    await expect(api.unknown({})).rejects.toMatchObject({
      errMsg: 'wx.unknown:fail method not supported',
    })
  })
})
