import { describe, expect, it } from 'vitest'
import { AbortControllerPolyfill } from '../src/abort'
import { URLPolyfill, URLSearchParamsPolyfill } from '../src/url'
import { FormDataPolyfill } from '../src/web'

describe('issue #1338 Web API compatibility', () => {
  it('resolves URL paths and parses credentials, IPv6 hosts and default ports', () => {
    expect(new URLPolyfill('../api', 'https://example.com/page')).toMatchObject({
      hostname: 'example.com',
      pathname: '/api',
      href: 'https://example.com/api',
    })

    expect(new URLPolyfill('https://user:pass@example.com:8080/path')).toMatchObject({
      username: 'user',
      password: 'pass',
      hostname: 'example.com',
      host: 'example.com:8080',
      port: '8080',
      origin: 'https://example.com:8080',
      href: 'https://user:pass@example.com:8080/path',
    })

    expect(new URLPolyfill('http://[::1]:8080/api')).toMatchObject({
      hostname: '[::1]',
      host: '[::1]:8080',
      port: '8080',
    })
    expect(new URLPolyfill('http://[::1]/api')).toMatchObject({
      hostname: '[::1]',
      host: '[::1]',
      port: '',
    })

    expect(new URLPolyfill('https://example.com:443/a/b/../c/./d')).toMatchObject({
      port: '',
      pathname: '/a/c/d',
      href: 'https://example.com/a/c/d',
    })
  })

  it('supports value-aware URLSearchParams.delete and preserves URLSearchParams.set order', () => {
    const params = new URLSearchParamsPolyfill('a=1&a=2&b=3')
    params.delete('a', '2')
    expect(params.toString()).toBe('a=1&b=3')

    params.set('new', 'value')
    expect(params.get('new')).toBe('value')

    const updated = new URLSearchParamsPolyfill('a=1&b=2&a=3')
    updated.set('a', 'x')
    expect(updated.toString()).toBe('a=x&b=2')
  })

  it('rejects malformed bracketed authorities', () => {
    expect(URLPolyfill.parse('https://[::1')).toBe(null)
    expect(() => new URLPolyfill('https://[::1')).toThrow(TypeError)
  })

  it('resolves query paths while preserving base URL credentials', () => {
    expect(new URLPolyfill('next?key=value', 'https://user:pass@example.com/base/page').href)
      .toBe('https://user:pass@example.com/base/next?key=value')
    expect(new URLPolyfill('next', 'https://user@example.com/base/page').href)
      .toBe('https://user@example.com/base/next')
  })

  it('updates the first FormData entry in place', () => {
    const form = new FormDataPolyfill()
    form.append('key', 'uploads/a.txt')
    form.append('file', 'payload')
    form.set('key', 'uploads/b.txt')
    form.set('new', 'value')
    expect([...form]).toEqual([
      ['key', 'uploads/b.txt'],
      ['file', 'payload'],
      ['new', 'value'],
    ])
  })

  it('uses AbortError by default and throws explicit abort reasons unchanged', () => {
    const defaultController = new AbortControllerPolyfill()
    defaultController.abort()
    expect(defaultController.signal.reason).toMatchObject({ name: 'AbortError' })
    expect(() => defaultController.signal.throwIfAborted()).toThrow(defaultController.signal.reason)

    const reason = 'timeout'
    const explicitController = new AbortControllerPolyfill()
    explicitController.abort(reason)
    expect(explicitController.signal.reason).toBe(reason)
    expect(() => explicitController.signal.throwIfAborted()).toThrow(reason)

    const nullReason = {}
    const nullController = new AbortControllerPolyfill()
    nullController.abort(nullReason)
    try {
      nullController.signal.throwIfAborted()
      throw new Error('Expected the explicit object reason to be thrown')
    }
    catch (caught) {
      expect(caught).toBe(nullReason)
    }
  })
})
