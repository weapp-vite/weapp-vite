import { REQUEST_GLOBAL_ACTUALS_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const NativeURL = globalThis.URL
const NativeURLSearchParams = globalThis.URLSearchParams
const keys = ['URL', 'URLSearchParams', 'Blob', 'File', 'FormData', 'TextDecoder', 'TextEncoder', 'fetch', 'global', 'self', 'window', REQUEST_GLOBAL_ACTUALS_KEY]
let descriptors: Map<string, PropertyDescriptor | undefined>

beforeEach(() => {
  vi.resetModules()
  descriptors = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  Reflect.deleteProperty(globalThis, REQUEST_GLOBAL_ACTUALS_KEY)
})

afterEach(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
    }
    else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('host URL compatibility', () => {
  it('replaces a complete host search-params constructor when its prototype cannot receive the size helper', async () => {
    class NonExtensibleSearchParams {
      private readonly data: URLSearchParams

      constructor(source = '') {
        this.data = new NativeURLSearchParams(source)
      }

      append(name: string, value: string) { this.data.append(name, value) }
      delete(name: string) { this.data.delete(name) }
      entries() { return this.data.entries() }
      forEach(callback: (value: string, key: string) => void) { this.data.forEach(callback) }
    }
    Object.preventExtensions(NonExtensibleSearchParams.prototype)
    vi.stubGlobal('URLSearchParams', NonExtensibleSearchParams)
    const { installWebRuntimeGlobals, URLSearchParamsPolyfill } = await import('../src')
    installWebRuntimeGlobals({ targets: ['fetch'] })
    expect(globalThis.URLSearchParams).toBe(URLSearchParamsPolyfill)
    const params = new globalThis.URLSearchParams('a=1&a=2')
    expect(params.size).toBe(2)
    expect(params.getAll('a')).toEqual(['1', '2'])
  })

  it('replaces an absolute-only URL constructor when custom-protocol resolution throws', async () => {
    class AbsoluteOnlyURL extends NativeURL {
      constructor(input: string, base?: string) {
        if (base !== undefined) {
          throw new TypeError('relative URLs are unsupported')
        }
        super(input)
      }
    }
    vi.stubGlobal('URL', AbsoluteOnlyURL)
    const { installWebRuntimeGlobals, URLPolyfill } = await import('../src')
    installWebRuntimeGlobals({ targets: ['fetch'] })
    expect(globalThis.URL).toBe(URLPolyfill)
    expect(new globalThis.URL('123', 'fake://abc').href).toBe('fake://abc/123')
  })
})
