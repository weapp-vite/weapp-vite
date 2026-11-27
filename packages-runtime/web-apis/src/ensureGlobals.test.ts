import { describe, expect, it } from 'vitest'
import {
  ensureWebRuntimeBlob,
  ensureWebRuntimeHeaders,
  ensureWebRuntimeResponse,
  ensureWebRuntimeTextDecoderStream,
  ensureWebRuntimeURL,
  ensureWebRuntimeURLSearchParams,
} from './ensureGlobals'
import { ensureWebRuntimeCrypto, ensureWebRuntimeGlobal, ensureWebRuntimePerformance } from './ensureLightweight'
import { markWebRuntimeGlobalInstalled } from './globalValue'
import { ResponsePolyfill } from './http'

describe('native Web Runtime ensure helpers', () => {
  it('uses the shared ownership predicate for generic targets', () => {
    const fallback = () => {}
    const host = () => {}

    expect(ensureWebRuntimeGlobal(undefined, fallback)).toBe(fallback)
    expect(ensureWebRuntimeGlobal(host, fallback)).toBe(host)
    expect(ensureWebRuntimeGlobal(markWebRuntimeGlobalInstalled(host), fallback)).toBe(fallback)
  })

  it('repairs incomplete performance and crypto hosts without replacing usable ones', () => {
    const fallback = {}
    const performance = { now: () => 1 }
    const crypto = { getRandomValues: () => new Uint8Array(1) }

    expect(ensureWebRuntimePerformance({}, fallback)).toBe(fallback)
    expect(ensureWebRuntimePerformance(performance, fallback)).toBe(performance)
    expect(ensureWebRuntimePerformance(markWebRuntimeGlobalInstalled(performance), fallback)).toBe(fallback)
    expect(ensureWebRuntimeCrypto({}, fallback)).toBe(fallback)
    expect(ensureWebRuntimeCrypto(crypto, fallback)).toBe(crypto)
    expect(ensureWebRuntimeCrypto(markWebRuntimeGlobalInstalled(crypto), fallback)).toBe(fallback)
  })

  it('patches incomplete host Headers and preserves its identity', () => {
    class HostHeaders {
      append() {}

      delete() {}

      entries() {
        return [][Symbol.iterator]()
      }

      forEach() {}

      get() {
        return null
      }

      has() {
        return false
      }

      keys() {
        return [][Symbol.iterator]()
      }

      set() {}

      values() {
        return [][Symbol.iterator]()
      }
    }
    const fallback = class FallbackHeaders {}

    expect(ensureWebRuntimeHeaders(HostHeaders, fallback)).toBe(HostHeaders)
    expect(typeof (HostHeaders.prototype as unknown as Record<string, unknown>).getSetCookie).toBe('function')
    expect(new HostHeaders()).toBeInstanceOf(HostHeaders)
  })

  it('falls back when host Headers lacks core methods', () => {
    class IncompleteHeaders {
      get() {
        return null
      }
    }
    const fallback = class FallbackHeaders {}

    expect(ensureWebRuntimeHeaders(IncompleteHeaders, fallback)).toBe(fallback)
    expect(ensureWebRuntimeHeaders({ prototype: {} }, fallback)).toBe(fallback)
  })

  it('adds missing static Response helpers to a usable host constructor', () => {
    class HostResponse {
      readonly headers = new Headers({ 'content-type': 'text/plain;charset=UTF-8' })

      readonly ok = true

      readonly status = 200

      arrayBuffer() {
        return Promise.resolve(new ArrayBuffer(0))
      }

      json() {
        return Promise.resolve({})
      }

      text() {
        return Promise.resolve('')
      }
    }
    const fallback = class FallbackResponse {}

    expect(ensureWebRuntimeResponse(HostResponse, fallback, ResponsePolyfill)).toBe(HostResponse)
    expect((HostResponse as unknown as Record<string, unknown>).json).toBe(ResponsePolyfill.json)
    expect((HostResponse as unknown as Record<string, unknown>).error).toBe(ResponsePolyfill.error)
  })

  it('falls back when host Response lacks core instance methods', () => {
    class IncompleteResponse {
      constructor(_input: string) {}

      json() {
        return Promise.resolve({})
      }

      static json() {}
    }
    const fallback = class FallbackResponse {}

    expect(ensureWebRuntimeResponse(IncompleteResponse, fallback, ResponsePolyfill)).toBe(fallback)
    expect(ensureWebRuntimeResponse(class EmptyResponse {}, fallback, ResponsePolyfill)).toBe(fallback)
  })

  it('preserves usable stream constructors and rejects incomplete fallback paths', () => {
    class HostTextDecoderStream {
      getReader() {
        return {}
      }
    }
    const fallback = class FallbackTextDecoderStream {}

    expect(ensureWebRuntimeTextDecoderStream(HostTextDecoderStream, fallback, false)).toBe(HostTextDecoderStream)
    expect(ensureWebRuntimeTextDecoderStream(HostTextDecoderStream, fallback, true)).toBe(fallback)
    expect(ensureWebRuntimeTextDecoderStream(class IncompleteStream {}, fallback, false)).toBe(fallback)
  })

  it('patches URL parsing helpers on a compatible host constructor', () => {
    class HostURL {
      constructor(input: string, base?: string) {
        this.href = new URL(input, base).href
      }

      href: string
    }

    expect(ensureWebRuntimeURL(HostURL, class FallbackURL {})).toBe(HostURL)
    expect(typeof (HostURL as unknown as Record<string, unknown>).parse).toBe('function')
    expect(typeof (HostURL as unknown as Record<string, unknown>).canParse).toBe('function')
  })

  it('repairs URLSearchParams sorting on the host prototype', () => {
    class HostURLSearchParams extends URLSearchParams {}
    HostURLSearchParams.prototype.sort = undefined as never

    expect(ensureWebRuntimeURLSearchParams(HostURLSearchParams, URLSearchParams)).toBe(HostURLSearchParams)
    const params = new HostURLSearchParams('b=2&a=1&a=0')
    params.sort()
    expect(params.toString()).toBe('a=1&a=0&b=2')
  })

  it('falls back for incomplete binary constructors and replaces native-owned values', () => {
    class IncompleteBlob {}
    const fallback = class FallbackBlob {}

    expect(ensureWebRuntimeBlob(IncompleteBlob, fallback)).toBe(fallback)
    const owned = markWebRuntimeGlobalInstalled(class OwnedBlob {})
    expect(ensureWebRuntimeBlob(owned, fallback)).toBe(fallback)
  })
})
