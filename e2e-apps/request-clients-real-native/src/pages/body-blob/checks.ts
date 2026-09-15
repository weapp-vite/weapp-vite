import { BlobPolyfill, HeadersPolyfill, RequestPolyfill, ResponsePolyfill, fetch as runtimeFetch } from '@wevu/web-apis'

export const contractIds = ['response-consume', 'concurrent-read', 'clone', 'null-body', 'empty-body', 'request-read', 'blob-size', 'blob-snapshot', 'blob-slice', 'blob-mime', 'headers-callback', 'fetch-consume'] as const

interface BinaryReader {
  bytes: () => Promise<Uint8Array>
}

function check(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}

async function rejectsTypeError(action: () => unknown) {
  try {
    await action()
  }
  catch (error) {
    check(error instanceof TypeError, `Expected TypeError, got ${String(error)}`)
    return
  }
  throw new Error('Expected TypeError, operation succeeded')
}

export async function runBodyBlobContracts(baseUrl: string) {
  const cases: Record<typeof contractIds[number], () => Promise<void>> = {
    'response-consume': async function () {
      const response = new ResponsePolyfill('hello')
      check(await response.text() === 'hello', 'initial text')
      await rejectsTypeError(() => response.text())
      await rejectsTypeError(() => response.clone())
    },
    'concurrent-read': async function () {
      const response = new ResponsePolyfill('hello')
      const first = response.text()
      await rejectsTypeError(() => response.arrayBuffer())
      check(await first === 'hello', 'first reader')
    },
    async clone() {
      const response = new ResponsePolyfill('hello')
      const clone = response.clone()
      check(!response.bodyUsed && !clone.bodyUsed, 'clone consumed body')
      check(await response.text() === await clone.text(), 'clone content')
    },
    'null-body': async function () {
      const response = new ResponsePolyfill(null)
      check(await response.text() === '', 'null text')
      check(!response.bodyUsed && await response.text() === '', 'null consumed')
    },
    'empty-body': async function () {
      const response = new ResponsePolyfill('')
      await response.text()
      check(response.bodyUsed, 'empty body not consumed')
      await rejectsTypeError(() => response.text())
    },
    'request-read': async function () {
      const request = new RequestPolyfill('https://example.test', { method: 'POST', body: 'hello' })
      const bytes = await (request as unknown as BinaryReader).bytes()
      check(bytes.length === 5 && bytes[0] === 104, 'request bytes')
      await rejectsTypeError(() => request.text())
    },
    'blob-size': async function () {
      const blob = new BlobPolyfill(['中文🙂', new Uint8Array([65])])
      check(blob.size === 11 && (await blob.arrayBuffer()).byteLength === 11, 'UTF-8 size')
    },
    'blob-snapshot': async function () {
      const input = new Uint8Array([65])
      const blob = new BlobPolyfill([input])
      input[0] = 66
      check(await blob.text() === 'A', 'mutable blob input')
    },
    'blob-slice': async function () {
      const blob = new BlobPolyfill(['abcd']) as unknown as { slice: (start: number, end?: number) => BlobPolyfill }
      check(await blob.slice(-2).text() === 'cd', 'negative slice')
      check(await blob.slice(3, 1).text() === '', 'empty slice')
    },
    'blob-mime': async function () {
      const blob = await new ResponsePolyfill('hello', { headers: { 'content-type': 'text/plain' } }).blob()
      check(blob.type === 'text/plain', 'response MIME')
    },
    'headers-callback': async function () {
      const headers = new HeadersPolyfill({ 'x-test': 'yes' })
      const context = { matched: false }
      const visit = headers.forEach as (callback: (this: typeof context, value: string, key: string, parent: HeadersPolyfill) => void, thisArg: typeof context) => void
      visit.call(headers, function (value, key, parent) {
        check(this === context && parent === headers, 'callback context')
        context.matched = value === 'yes' && key === 'x-test'
      }, context)
      check(context.matched, 'callback value')
    },
    'fetch-consume': async function () {
      const request = new RequestPolyfill(`${baseUrl}/fetch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client: 'fetch' }) })
      const response = await runtimeFetch(request)
      check(request.bodyUsed, 'fetch did not consume request')
      const clone = response.clone()
      const payload = await response.json()
      check(payload.transport === 'fetch' && payload.method === 'POST', 'network response')
      check((await clone.blob()).type.includes('application/json'), 'network MIME')
      await rejectsTypeError(() => response.text())
      await rejectsTypeError(() => runtimeFetch(request))
    },
  }
  const results: Array<{ id: string, status: string, error: string }> = []
  for (const id of contractIds) {
    try {
      await cases[id]()
      results.push({ id, status: 'passed', error: '' })
    }
    catch (error) {
      results.push({ id, status: 'failed', error: error instanceof Error ? error.message : String(error) })
    }
  }
  return results
}
