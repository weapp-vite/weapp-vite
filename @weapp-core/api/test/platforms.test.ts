import {
  api,
  createApi,
  createWeapi,
  MINI_PROGRAM_API_PLATFORM_DESCRIPTORS,
  wpi,
} from '../src'

describe('framework-agnostic mini-program platforms', () => {
  const runtimeRoot = globalThis as Record<string, unknown>

  afterEach(() => {
    for (const descriptor of MINI_PROGRAM_API_PLATFORM_DESCRIPTORS) {
      delete runtimeRoot[descriptor.globalObjectKey]
    }
  })

  it('provides neutral public names and compatibility aliases', () => {
    expect(api).toBe(wpi)
    expect(createApi).toBe(createWeapi)
  })

  it.each(MINI_PROGRAM_API_PLATFORM_DESCRIPTORS)(
    'automatically detects $displayName through $globalObjectKey',
    (descriptor) => {
      const getSystemInfoSync = vi.fn(() => ({ platform: descriptor.id }))
      runtimeRoot[descriptor.globalObjectKey] = {
        getSystemInfoSync,
      }

      const instance = createApi() as Record<string, any>

      expect(instance.platform).toBe(descriptor.globalObjectKey)
      expect(instance.getSystemInfoSync()).toEqual({ platform: descriptor.id })
      expect(getSystemInfoSync).toHaveBeenCalledOnce()
    },
  )

  it('supports unknown mini-program hosts through an explicit adapter', async () => {
    const request = vi.fn((options: any) => {
      options.success?.({ data: 'ok' })
    })
    const instance = createApi({
      adapter: { request },
      platform: 'community-mini-program',
    }) as Record<string, any>

    await expect(instance.request({ url: '/api' })).resolves.toEqual({ data: 'ok' })
    expect(instance.platform).toBe('community-mini-program')
  })
})
