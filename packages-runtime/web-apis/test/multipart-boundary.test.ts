import { describe, expect, it } from 'vitest'
import { RequestPolyfill } from '../src/http'
import { createMultipartBoundary, encodeMultipartFormData } from '../src/multipart'
import { FormDataPolyfill } from '../src/web'

describe('multipart boundary ownership', () => {
  it.each(['a'.repeat(71), 'trailing ', 'invalid@boundary'])('rejects the invalid explicit boundary %j', (boundary) => {
    const form = new FormDataPolyfill()
    form.append('field', 'value')
    const contentType = `multipart/form-data; boundary="${boundary}"`
    expect(() => createMultipartBoundary(contentType)).toThrow('Invalid multipart boundary')
    expect(() => new RequestPolyfill('https://example.test/upload', { method: 'POST', body: form, headers: { 'content-type': contentType } }))
      .toThrow('Invalid multipart boundary')
  })

  it.each(['multipart/form-data', 'multipart/form-data; charset=utf-8', 'application/json; boundary=ignored'])('generates a usable boundary for %s', async (contentType) => {
    const boundary = createMultipartBoundary(contentType)
    const payload = await encodeMultipartFormData(new Map([['field', 'value']]), boundary)
    expect(payload.contentType).toBe(`multipart/form-data; boundary=${boundary}`)
    expect(new TextDecoder().decode(payload.body)).toBe(`--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}--\r\n`)
  })
})
