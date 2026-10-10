import { describe, expect, it, vi } from 'vitest'
import { TextDecoderPolyfill } from '../src/textCodec'
import { URLPolyfill, URLSearchParamsPolyfill } from '../src/url'

const cases = [
  ['%', '%'],
  ['%2', '%2'],
  ['%ZZ', '%ZZ'],
  ['%E4%BD%A0%%E5%A5%BD', '你%好'],
  ['%E0%A4%A', '\uFFFD%A'],
  ['%E2%82', '\uFFFD'],
  ['%E2%28%A1', '\uFFFD(\uFFFD'],
  ['%C0%AF', '\uFFFD\uFFFD'],
  ['%80%FF', '\uFFFD\uFFFD'],
  ['%ED%A0%80', '\uFFFD\uFFFD\uFFFD'],
  ['%F4%90%80%80', '\uFFFD\uFFFD\uFFFD\uFFFD'],
  ['%C2%A2', '¢'],
  ['%E4%B8%AD', '中'],
  ['%F0%9F%98%80', '😀'],
  ['%F4%8F%BF%BF', '\uDBFF\uDFFF'],
  ['%EF%BB%BF%', '\uFEFF%'],
  ['中%E2%82€', '中\uFFFD€'],
  ['a+b%2B%2520%', 'a b+%20%'],
] as const

describe('issue #1186 URL query decoding', () => {
  it.each(cases)('decodes keys and values in %s', (input, expected) => {
    const params = new URLSearchParamsPolyfill(`${input}=${input}`)
    expect([...params]).toEqual([[expected, expected]])
    expect(new URLSearchParamsPolyfill(params.toString()).get(expected)).toBe(expected)
  })

  it('keeps malformed queries usable through URL construction, statics and live mutations', () => {
    const href = 'https://example.test/?q=%E4%BD%A0%%E5%A5%BD&q=%E2%82'
    const url = new URLPolyfill(href)
    expect(url.href).toBe(href)
    expect(url.searchParams.getAll('q')).toEqual(['你%好', '\uFFFD'])
    expect(URLPolyfill.canParse(href)).toBe(true)
    expect(URLPolyfill.parse(href)?.searchParams.get('q')).toBe('你%好')
    const params = url.searchParams
    url.search = '?q=%E2%28%A1&q=%2B'
    expect(url.searchParams).toBe(params)
    expect(params.getAll('q')).toEqual(['\uFFFD(\uFFFD', '+'])
    expect(url.search).toBe('?q=%E2%28%A1&q=%2B')
    params.append('q', 'a b')
    expect(url.href).toBe('https://example.test/?q=%EF%BF%BD(%EF%BF%BD&q=%2B&q=a+b')
  })

  it.each([undefined, TextDecoderPolyfill])('works without a native TextDecoder (%s)', (decoder) => {
    vi.stubGlobal('TextDecoder', decoder)
    try {
      expect([...new URLSearchParamsPolyfill('q=%EF%BB%BF%FF&bad=%E2%28%A1')])
        .toEqual([['q', '\uFEFF\uFFFD'], ['bad', '\uFFFD(\uFFFD']])
    }
    finally {
      vi.unstubAllGlobals()
    }
  })
})
