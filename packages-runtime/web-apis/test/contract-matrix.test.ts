import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AbortControllerPolyfill,
  AbortSignalPolyfill,
} from '../src/abort'
import { atobPolyfill, btoaPolyfill } from '../src/base64'
import {
  isUrlInstance,
  isUrlSearchParamsInstance,
  resolveTextDecoderConstructor,
  resolveTextEncoderConstructor,
  resolveUrlConstructor,
  resolveUrlSearchParamsConstructor,
} from '../src/constructors'
import { cryptoPolyfill } from '../src/crypto'
import { CustomEventPolyfill, EventPolyfill } from '../src/events'
import { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from '../src/http'
import { encodeMultipartFormData } from '../src/multipart'
import { normalizeRequestMiniProgramOptions } from '../src/networkDefaults'
import { performancePolyfill } from '../src/performance'
import {
  cloneArrayBuffer,
  decodeText,
  decodeTextFallback,
  encodeText,
  encodeTextFallback,
  installRequestGlobalBinding,
  isArrayBufferLike,
  isBlobLike,
  normalizeHeaderName,
  RequestGlobalsEventTarget,
  resolveRequestGlobalsHosts,
} from '../src/shared'
import { queueMicrotaskPolyfill } from '../src/task'
import { TextDecoderPolyfill, TextEncoderPolyfill } from '../src/textCodec'
import { URLPolyfill, URLSearchParamsPolyfill } from '../src/url'
import { BlobPolyfill, FilePolyfill, FormDataPolyfill } from '../src/web'

const originalGlobals = new Map<string, unknown>()

function setGlobal(name: string, value: unknown) {
  if (!originalGlobals.has(name)) {
    originalGlobals.set(name, (globalThis as Record<string, unknown>)[name])
  }
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

afterEach(() => {
  for (const [name, value] of originalGlobals) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  originalGlobals.clear()
})

describe('web API contract matrix', () => {
  it('covers abort signal listeners, handler, reason and idempotence', () => {
    const controller = new AbortControllerPolyfill()
    const events: string[] = []
    const listener = (event: { type: string }) => events.push(event.type)
    controller.signal.addEventListener('abort', listener)
    controller.signal.onabort = listener
    expect(controller.signal.aborted).toBe(false)
    expect(() => controller.signal.throwIfAborted()).not.toThrow()
    controller.abort(new Error('cancelled'))
    controller.abort(new Error('ignored'))
    expect(controller.signal.aborted).toBe(true)
    expect(controller.signal.reason).toEqual(new Error('cancelled'))
    expect(events).toEqual(['abort', 'abort'])
    expect(() => controller.signal.throwIfAborted()).toThrow('cancelled')
    controller.signal.removeEventListener('abort', listener)

    const signal = new AbortSignalPolyfill()
    signal.aborted = true
    expect(() => signal.throwIfAborted()).toThrow(expect.objectContaining({ name: 'AbortError' }))
    setGlobal('DOMException', undefined)
    expect(() => signal.throwIfAborted()).toThrow('The operation was aborted.')
  })

  it('covers event defaults, cancellation and custom details', () => {
    const event = new EventPolyfill('submit')
    expect(event.bubbles).toBe(false)
    event.preventDefault()
    expect(event.defaultPrevented).toBe(false)
    const cancelable = new EventPolyfill('submit', { bubbles: true, cancelable: true, composed: true })
    cancelable.preventDefault()
    cancelable.stopImmediatePropagation()
    cancelable.stopPropagation()
    expect(cancelable.defaultPrevented).toBe(true)
    expect(cancelable.cancelBubble).toBe(true)
    cancelable.target = { id: 'form' }
    expect(cancelable.composedPath()).toEqual([{ id: 'form' }])
    expect(new EventPolyfill('empty').composedPath()).toEqual([])
    expect(new CustomEventPolyfill('result', { detail: { ok: true } }).detail).toEqual({ ok: true })
    expect(new CustomEventPolyfill('empty').detail).toBe(null)
  })

  it('covers event target listener removal, explicit targets and handler dispatch', () => {
    const target = new RequestGlobalsEventTarget() as RequestGlobalsEventTarget & {
      onchange?: (event: { currentTarget?: unknown, target?: unknown, type: string }) => void
    }
    const listener = vi.fn()
    const removed = vi.fn()
    target.addEventListener('change', listener)
    target.addEventListener('change', removed)
    target.removeEventListener('change', removed)
    target.onchange = vi.fn()
    const explicitTarget = { id: 'explicit' }

    expect(target.dispatchEvent({
      currentTarget: explicitTarget,
      target: explicitTarget,
      type: 'change',
    })).toBe(true)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      currentTarget: explicitTarget,
      target: explicitTarget,
    }))
    expect(removed).not.toHaveBeenCalled()
    expect(target.onchange).toHaveBeenCalledOnce()
    expect(target.dispatchEvent({ type: 'missing' })).toBe(true)
  })

  it('covers URL parsing, relative resolution and mutable search params', () => {
    const params = new URLSearchParamsPolyfill({ tag: ['a', 'b'], empty: '' })
    params.append('q', 'hello world')
    params.set('tag', 'c')
    params.sort()
    expect(params.getAll('tag')).toEqual(['c'])
    expect(params.toString()).toContain('q=hello+world')
    expect(params.has('empty')).toBe(true)
    params.delete('empty')
    expect(params.has('empty')).toBe(false)
    expect(params.get('missing')).toBe(null)
    expect([...params.keys()]).toEqual(['q', 'tag'])

    const url = new URLPolyfill('/next?x=1#top', 'https://example.test/base/page')
    expect(url.origin).toBe('https://example.test')
    expect(url.pathname).toBe('/next')
    url.searchParams.append('name', 'A B')
    url.hash = 'bottom'
    expect(url.href).toBe('https://example.test/next?x=1&name=A+B#bottom')
    url.search = '?only=1'
    expect(url.searchParams.get('only')).toBe('1')
    expect(URLPolyfill.canParse('https://example.test')).toBe(true)
    expect(URLPolyfill.parse('relative')).toBe(null)
    expect(() => new URLPolyfill('relative')).toThrow(TypeError)
  })

  it('covers URL constructor inputs, relative paths, iterators and empty mutations', () => {
    const changed = vi.fn()
    const params = new URLSearchParamsPolyfill([
      ['b', '2'],
      ['a', '1'],
      ['a', '3'],
    ], changed)
    params.delete('missing')
    params.sort()
    expect(params.size).toBe(3)
    expect([...params.entries()]).toEqual([['a', '1'], ['a', '3'], ['b', '2']])
    expect([...params.values()]).toEqual(['1', '3', '2'])
    expect([...params]).toEqual([...params.entries()])
    const visited: string[] = []
    params.forEach((value, key) => visited.push(`${key}:${value}`))
    expect(visited).toEqual(['a:1', 'a:3', 'b:2'])
    expect(changed).toHaveBeenCalledTimes(4)

    expect(new URLSearchParamsPolyfill('?flag&name=A+B').get('flag')).toBe('')
    expect(new URLSearchParamsPolyfill('').toString()).toBe('')
    expect(new URLSearchParamsPolyfill({ tags: ['x', 'y'] }).getAll('tags')).toEqual(['x', 'y'])
    expect(new URLSearchParamsPolyfill(new URLSearchParamsPolyfill('x=1')).toString()).toBe('x=1')

    const base = new URLPolyfill('https://example.test/a/b/page?old=1#old')
    expect(new URLPolyfill('//cdn.test/file', base).href).toBe('https://cdn.test/file')
    expect(new URLPolyfill('/root', base).href).toBe('https://example.test/root')
    expect(new URLPolyfill('?next=1', base).href).toBe('https://example.test/a/b/page?next=1')
    expect(new URLPolyfill('#next', base).href).toBe('https://example.test/a/b/page#next')
    expect(new URLPolyfill('../asset', base).href).toBe('https://example.test/a/asset')
    expect(new URLPolyfill('./asset', base).href).toBe('https://example.test/a/b/asset')
    expect(() => new URLPolyfill('/child', 'invalid-base')).toThrow('base')

    base.hash = ''
    base.search = ''
    expect(base.hash).toBe('')
    expect(base.search).toBe('')
    expect(base.toJSON()).toBe('https://example.test/a/b/page')
    expect(URLPolyfill.parse(base)).toEqual(expect.objectContaining({ href: base.href }))
    base.hash = '#ready'
    base.search = 'ready=1'
    expect(base.href).toContain('?ready=1#ready')
    const protocolRelative = new URLPolyfill('//cdn.test/path')
    expect(protocolRelative.origin).toBe('')
    expect(protocolRelative.pathname).toBe('/path')
    expect(new URLPolyfill('https://example.test').pathname).toBe('/')
    const mutable = new URLPolyfill('https://example.test/?only=1')
    mutable.searchParams.delete('only')
    expect(mutable.search).toBe('')
  })

  it('detects native and polyfilled URL and text constructors', () => {
    expect(resolveUrlConstructor()).toBe(globalThis.URL)
    expect(resolveUrlSearchParamsConstructor()).toBe(globalThis.URLSearchParams)
    expect(resolveTextEncoderConstructor()).toBe(globalThis.TextEncoder)
    expect(resolveTextDecoderConstructor()).toBe(globalThis.TextDecoder)
    expect(isUrlInstance(new globalThis.URL('https://example.test'))).toBe(true)
    expect(isUrlInstance(new URLPolyfill('https://example.test'))).toBe(true)
    expect(isUrlInstance({})).toBe(false)
    expect(isUrlSearchParamsInstance(new globalThis.URLSearchParams('x=1'))).toBe(true)
    expect(isUrlSearchParamsInstance(new URLSearchParamsPolyfill('x=1'))).toBe(true)
    expect(isUrlSearchParamsInstance({})).toBe(false)

    setGlobal('URL', undefined)
    setGlobal('URLSearchParams', undefined)
    setGlobal('TextEncoder', undefined)
    setGlobal('TextDecoder', undefined)
    expect(resolveUrlConstructor()).toBeUndefined()
    expect(resolveUrlSearchParamsConstructor()).toBeUndefined()
    expect(resolveTextEncoderConstructor()).toBeUndefined()
    expect(resolveTextDecoderConstructor()).toBeUndefined()
  })

  it('covers encoding helpers and malformed inputs', () => {
    expect(btoaPolyfill('Hello')).toBe('SGVsbG8=')
    expect(atobPolyfill('SGVsbG8=')).toBe('Hello')
    expect(atobPolyfill(' SGVs\nbG8= ')).toBe('Hello')
    expect(() => btoaPolyfill('你好')).toThrow('Latin1')
    expect(() => atobPolyfill('%%%')).toThrow('correctly encoded')
    const encoded = new TextEncoderPolyfill().encode('中文')
    expect(new TextDecoderPolyfill().decode(encoded)).toBe('中文')
    expect(new TextDecoderPolyfill().decode(new Uint8Array([0xFF]))).toBe('ÿ')
    expect(btoaPolyfill('A')).toBe('QQ==')
    expect(btoaPolyfill('AB')).toBe('QUI=')
    expect(atobPolyfill('QQ==')).toBe('A')
    expect(atobPolyfill('QUI=')).toBe('AB')
    expect(atobPolyfill('QQ')).toBe('A')
    expect(atobPolyfill('QUI')).toBe('AB')
    expect(() => atobPolyfill('A')).toThrow('correctly encoded')
    expect(() => atobPolyfill('====')).toThrow('correctly encoded')
  })

  it('covers shared binary helpers and native/fallback text codecs', () => {
    const source = Uint8Array.from([65, 66, 67]).buffer
    expect(isArrayBufferLike(source)).toBe(true)
    expect(isArrayBufferLike(new Uint8Array(source))).toBe(false)
    expect([...new Uint8Array(cloneArrayBuffer(source))]).toEqual([65, 66, 67])
    const noSliceBuffer = Object.create(null) as ArrayBuffer
    Object.defineProperties(noSliceBuffer, {
      byteLength: { value: 3 },
      [Symbol.toStringTag]: { value: 'ArrayBuffer' },
    })
    expect([...new Uint8Array(cloneArrayBuffer(noSliceBuffer))]).toEqual([0, 0, 0])
    expect(normalizeHeaderName(' X-Test ')).toBe('x-test')
    expect(isBlobLike({ arrayBuffer: async () => source, size: 3 })).toBe(true)
    expect(isBlobLike({ arrayBuffer: async () => source, type: 'text/plain' })).toBe(true)
    expect(isBlobLike({ arrayBuffer: async () => source })).toBe(false)

    expect(new TextDecoderPolyfill().decode()).toBe('')
    expect(new TextDecoderPolyfill().decode(null)).toBe('')
    expect(new TextDecoderPolyfill().decode({} as never)).toBe('')
    expect(new TextEncoderPolyfill().encode()).toEqual(new Uint8Array())
    expect(decodeTextFallback(encodeTextFallback('中文'))).toBe('中文')
    expect(decodeTextFallback(Uint8Array.from([0xFF]).buffer)).toBe('ÿ')
    expect(new Uint8Array(encodeText('ok'))).toEqual(Uint8Array.from([111, 107]))
    expect(decodeText(Uint8Array.from([111, 107]).buffer)).toBe('ok')

    setGlobal('TextEncoder', undefined)
    setGlobal('TextDecoder', undefined)
    expect(new Uint8Array(encodeText('fallback'))).toEqual(new TextEncoderPolyfill().encode('fallback'))
    expect(decodeText(encodeTextFallback('fallback'))).toBe('fallback')

    setGlobal('global', globalThis)
    setGlobal('self', globalThis)
    setGlobal('window', null)
    setGlobal('wx', () => undefined)
    expect(resolveRequestGlobalsHosts()).toEqual([globalThis, (globalThis as any).wx])
    expect(() => installRequestGlobalBinding('', 'ignored')).not.toThrow()
  })

  it('covers headers and request body contracts', async () => {
    const fromRecord = new HeadersPolyfill({ Accept: 'text/plain', empty: ['a', 'b'] })
    const fromIterable = new HeadersPolyfill([['Set-Cookie', 'a=1'], ['Set-Cookie', 'b=2']])
    const fromForEach = new HeadersPolyfill(fromRecord)
    const fromHeadersLike = new HeadersPolyfill({
      forEach(callback: (value: string, key: string) => void) {
        callback('headers-like', 'X-Source')
      },
    })
    const fromPrimitive = new HeadersPolyfill(42)
    const empty = new HeadersPolyfill()
    empty.append(' ', 'ignored')
    empty.set(' ', 'ignored')
    fromRecord.append('Accept', 'application/json')
    fromRecord.set('X-Test', 'yes')
    expect(fromRecord.get('accept')).toBe('text/plain, application/json')
    expect(fromRecord.has('x-test')).toBe(true)
    expect(fromIterable.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect([...fromForEach]).toEqual([['Accept', 'text/plain'], ['empty', 'a, b']])
    expect(fromHeadersLike.get('x-source')).toBe('headers-like')
    expect([...fromPrimitive]).toEqual([])
    expect(fromRecord.getSetCookie()).toEqual([])
    expect([...fromRecord.keys()]).toEqual(['Accept', 'empty', 'X-Test'])
    expect([...fromRecord.values()]).toEqual(['text/plain, application/json', 'a, b', 'yes'])
    fromRecord.delete('x-test')
    expect(fromRecord.has('x-test')).toBe(false)
    expect(empty.get('missing')).toBe(null)

    const stringRequest = new RequestPolyfill('https://example.test', { body: 'hello', method: 'post', headers: fromRecord })
    expect(stringRequest.method).toBe('POST')
    expect(stringRequest.body).toBe(null)
    expect(stringRequest.bodyUsed).toBe(false)
    expect(await stringRequest.text()).toBe('hello')
    expect(stringRequest.bodyUsed).toBe(true)
    const clonedRequest = stringRequest.clone()
    expect(clonedRequest.bodyUsed).toBe(false)
    expect(await clonedRequest.arrayBuffer()).toEqual(encodeTextFallback('hello'))

    const view = new Uint8Array([1, 2, 3])
    expect([...new Uint8Array(await new RequestPolyfill('view', { body: view }).arrayBuffer())]).toEqual([1, 2, 3])
    expect([...new Uint8Array(await new RequestPolyfill('buffer', { body: view.buffer }).arrayBuffer())]).toEqual([1, 2, 3])
    const blobLike = { arrayBuffer: async () => Uint8Array.from([4]).buffer, size: 1, type: 'x/test' }
    expect([...new Uint8Array(await new RequestPolyfill('blob', { body: blobLike }).arrayBuffer())]).toEqual([4])
    expect(await new RequestPolyfill('object', { body: { ok: true } }).text()).toBe('[object Object]')
    expect(await new RequestPolyfill('form', { body: new FormDataPolyfill() }).text()).toBe('[object FormData]')
    expect(await new RequestPolyfill('empty').text()).toBe('')

    const copied = new RequestPolyfill(stringRequest, { signal: null })
    expect(copied.url).toBe('https://example.test')
    expect(await copied.text()).toBe('hello')
    expect(new RequestPolyfill(new URLPolyfill('https://example.test/url')).url).toBe('https://example.test/url')
    expect(new RequestPolyfill({} as never).url).toBe('')
  })

  it('covers response, blob, file and form data contracts', async () => {
    const response = new ResponsePolyfill('hello', { status: 201, statusText: 'Created', url: '/created' })
    expect(response.ok).toBe(true)
    expect(response.body).toBe(null)
    expect(response.bodyUsed).toBe(false)
    expect(await response.text()).toBe('hello')
    expect(response.bodyUsed).toBe(true)
    expect(await response.clone().text()).toBe('hello')
    expect(ResponsePolyfill.error()).toEqual(expect.objectContaining({ ok: false, status: 0, type: 'error' }))
    expect(await ResponsePolyfill.json({ ok: true }).json()).toEqual({ ok: true })
    expect(ResponsePolyfill.json({}, { headers: { 'content-type': 'x/custom' } }).headers.get('content-type')).toBe('x/custom')
    expect(() => ResponsePolyfill.json(undefined)).toThrow('not JSON serializable')
    await expect(response.formData()).rejects.toThrow('not supported')
    expect(await new ResponsePolyfill(Uint8Array.from([65])).blob()).toBeInstanceOf(Blob)
    setGlobal('Blob', undefined)
    await expect(new ResponsePolyfill('x').blob()).rejects.toThrow('Blob is unavailable')

    const buffer = Uint8Array.from([66]).buffer
    const blobLike = { arrayBuffer: async () => Uint8Array.from([67]).buffer, size: 1, type: 'x/test' }
    const blob = new BlobPolyfill(['A', buffer, new Uint8Array([68]), blobLike, 5 as never], { type: 'mixed/test' })
    expect(blob.size).toBe(4)
    expect(blob.type).toBe('mixed/test')
    expect(await blob.text()).toBe('ABDC5')
    const file = new FilePolyfill(['file'], 'demo.txt', { type: 'text/plain' })
    expect(file.name).toBe('demo.txt')
    expect(file.lastModified).toBeTypeOf('number')
    expect(file[Symbol.toStringTag]).toBe('File')

    const form = new FormDataPolyfill()
    form.append('value', 'first')
    form.append('value', 'second')
    form.append('blob', blobLike, 'blob.bin')
    const namedWithoutModified = { ...blobLike, name: 'host-name.bin' }
    form.append('host-blob', namedWithoutModified)
    const hostFile = { ...blobLike, lastModified: 123, name: 'host-file.bin' }
    form.append('host-file', hostFile)
    expect(form.getAll('value')).toEqual(['first', 'second'])
    expect(form.has('blob')).toBe(true)
    expect((form.get('blob') as FilePolyfill).name).toBe('blob.bin')
    expect((form.get('host-blob') as FilePolyfill).name).toBe('blob')
    expect((form.get('host-file') as FilePolyfill).name).toBe('host-file.bin')
    expect((form.get('host-file') as FilePolyfill).lastModified).toBe(123)
    expect([...form.keys()]).toEqual(['value', 'value', 'blob', 'host-blob', 'host-file'])
    expect([...form.values()]).toHaveLength(5)
    expect([...form.entries()]).toEqual([...form])
    const visited: string[] = []
    form.forEach((_value, key, parent) => {
      expect(parent).toBe(form)
      visited.push(key)
    })
    expect(visited).toEqual(['value', 'value', 'blob', 'host-blob', 'host-file'])
    form.set('value', 'only')
    form.set('blob', blobLike)
    expect(form.getAll('value')).toEqual(['only'])
    expect((form.get('blob') as FilePolyfill).name).toBe('blob')
    form.delete('value')
    expect(form.get('value')).toBe(null)
    expect(form[Symbol.toStringTag]).toBe('FormData')
  })

  it('covers multipart fallback metadata and ignored network defaults', async () => {
    const binary = {
      arrayBuffer: async () => Uint8Array.from([1]).buffer,
      name: '',
      size: 1,
      type: '',
    }
    const payload = await encodeMultipartFormData(new Map<string, any>([
      ['quoted"name', 'value'],
      ['binary', binary],
    ]))
    const body = new TextDecoder().decode(payload.body)
    expect(body).toContain('name="quoted\\"name"')
    expect(body).toContain('filename="blob"')
    expect(body).toContain('Content-Type: application/octet-stream')
    expect(normalizeRequestMiniProgramOptions(null, 42, {
      timeout: undefined,
      enableHttp2: true,
    })).toEqual({ enableHttp2: true })
  })

  it('uses host crypto, native crypto and math fallback with validation', () => {
    const hostRandom = vi.fn((target: Uint8Array) => target.fill(7))
    setGlobal('crypto', undefined)
    setGlobal('wx', { getRandomValues: hostRandom })
    expect([...cryptoPolyfill.getRandomValues(new Uint8Array(3))]).toEqual([7, 7, 7])
    expect(hostRandom).toHaveBeenCalled()

    const nativeRandom = vi.fn((target: Uint8Array) => target.fill(8))
    setGlobal('crypto', { getRandomValues: nativeRandom })
    expect([...cryptoPolyfill.getRandomValues(new Uint8Array(2))]).toEqual([8, 8])
    expect(nativeRandom).toHaveBeenCalled()

    setGlobal('crypto', undefined)
    setGlobal('wx', undefined)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect([...cryptoPolyfill.getRandomValues(new Uint8Array(2))]).toEqual([128, 128])
    vi.restoreAllMocks()
    expect(() => cryptoPolyfill.getRandomValues(new Float32Array(1) as never)).toThrow('integer TypedArray')
    expect(() => cryptoPolyfill.getRandomValues(new Uint8Array(65537))).toThrow('65536')
  })

  it('uses native performance, host performance and monotonic fallback', () => {
    setGlobal('performance', { now: () => 12.5 })
    expect(performancePolyfill.now()).toBe(12.5)
    setGlobal('performance', { __weappVitePerformancePolyfill: true, now: () => 1 })
    setGlobal('my', { getPerformance: () => ({ now: () => 22 }) })
    expect(performancePolyfill.now()).toBe(22)
    setGlobal('my', {
      getPerformance: () => {
        throw new Error('unsupported')
      },
    })
    expect(performancePolyfill.now()).toBeGreaterThanOrEqual(0)
  })

  it('delegates queueMicrotask to native implementation and validates callbacks', async () => {
    const native = vi.fn((callback: () => void) => callback())
    setGlobal('queueMicrotask', native)
    const callback = vi.fn()
    queueMicrotaskPolyfill(callback)
    expect(native).toHaveBeenCalledWith(callback)
    expect(callback).toHaveBeenCalled()
    setGlobal('queueMicrotask', undefined)
    const promiseCallback = vi.fn()
    queueMicrotaskPolyfill(promiseCallback)
    await Promise.resolve()
    expect(promiseCallback).toHaveBeenCalled()
    expect(() => queueMicrotaskPolyfill(null as never)).toThrow('callback must be a function')
  })

  it('ignores request-global placeholders and falls back to a promise microtask', async () => {
    const placeholder = vi.fn(() => {
      throw new Error('placeholder must not run')
    }) as any
    placeholder[REQUEST_GLOBAL_PLACEHOLDER_KEY] = true
    setGlobal('queueMicrotask', placeholder)

    const order = ['sync']
    queueMicrotaskPolyfill(() => order.push('microtask'))
    expect(order).toEqual(['sync'])
    await Promise.resolve()
    expect(order).toEqual(['sync', 'microtask'])
    expect(placeholder).not.toHaveBeenCalled()
  })

  it('rethrows rejected microtask callbacks on a timer', async () => {
    setGlobal('queueMicrotask', undefined)
    const scheduled: Array<() => void> = []
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
      scheduled.push(callback)
      return 1 as never
    }) as unknown as typeof setTimeout)
    queueMicrotaskPolyfill(() => {
      throw new Error('microtask failed')
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(timeoutSpy).toHaveBeenCalledOnce()
    expect(scheduled).toHaveLength(1)
    expect(() => scheduled[0]?.()).toThrow('microtask failed')
    timeoutSpy.mockRestore()
  })
})
