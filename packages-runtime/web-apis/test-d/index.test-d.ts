import type {
  InstallWebRuntimeGlobalsOptions,
  MiniProgramNetworkDefaults,
  RequestGlobalsMiniProgramOptions,
  WeappInjectRequestGlobalsTarget,
  WeappInjectWebRuntimeGlobalsTarget,
  WebSocketMiniProgramOptions,
} from '@wevu/web-apis'
import type {
  RequestGlobalsFetchInit,
} from '@wevu/web-apis/fetch'
import type { BlobPart, FormDataEntryValue } from '@wevu/web-apis/web'
import {
  BlobPolyfill,
  FilePolyfill,
  FormDataPolyfill,
  getMiniProgramNetworkDefaults,
  HeadersPolyfill,
  installRequestGlobals,
  installWebRuntimeGlobals,
  RequestPolyfill,
  resetMiniProgramNetworkDefaults,
  ResponsePolyfill,
  setMiniProgramNetworkDefaults,
  TextDecoderPolyfill,
  TextEncoderPolyfill,
  URLPolyfill,
  URLSearchParamsPolyfill,
} from '@wevu/web-apis'
import { expectAssignable, expectError, expectType } from 'tsd'

const target: WeappInjectWebRuntimeGlobalsTarget = 'fetch'
expectAssignable<WeappInjectWebRuntimeGlobalsTarget>(target)
expectAssignable<WeappInjectRequestGlobalsTarget>(target)
expectAssignable<WeappInjectWebRuntimeGlobalsTarget>('performance')
expectAssignable<WeappInjectWebRuntimeGlobalsTarget>('crypto')
expectAssignable<WeappInjectWebRuntimeGlobalsTarget>('queueMicrotask')

const options: InstallWebRuntimeGlobalsOptions = {
  targets: ['fetch', 'Request', 'XMLHttpRequest', 'performance', 'crypto'],
  networkDefaults: {
    request: {
      timeout: 3_000,
    },
    socket: {
      timeout: 5_000,
    },
  },
}
expectType<WeappInjectWebRuntimeGlobalsTarget[] | undefined>(options.targets)
expectType<MiniProgramNetworkDefaults | undefined>(options.networkDefaults)
expectType<Record<string, any>>(installWebRuntimeGlobals(options))
expectType<Record<string, any>>(installWebRuntimeGlobals())
expectType<Record<string, any>>(installRequestGlobals(options))
expectType<Record<string, any>>(installRequestGlobals())
expectType<RequestPolyfill>(new RequestPolyfill(new URLPolyfill('https://request-globals.invalid')))
expectType<URLPolyfill | null>(URLPolyfill.parse('/path', 'https://request-globals.invalid'))
expectType<boolean>(URLPolyfill.canParse('/path', 'https://request-globals.invalid'))
expectType<number>(new URLSearchParamsPolyfill('b=2&a=1').size)
expectType<void>(new URLSearchParamsPolyfill('b=2&a=1').sort())
expectType<string[]>(new HeadersPolyfill([['Set-Cookie', 'a=1']]).getSetCookie())
expectType<ResponsePolyfill>(ResponsePolyfill.json({ ok: true }))
expectType<ResponsePolyfill>(ResponsePolyfill.error())
expectType<Uint8Array<ArrayBuffer>>(new TextEncoderPolyfill().encode('ok'))
expectType<string>(new TextDecoderPolyfill().decode(new Uint8Array([111, 107])))
expectAssignable<BlobPart>('ok')
expectAssignable<BlobPart>(new BlobPolyfill(['ok']))
expectType<FilePolyfill>(new FilePolyfill(['ok'], 'ok.txt', {
  lastModified: 123,
  type: 'text/plain',
}))
expectType<string>(new FilePolyfill(['ok'], 'ok.txt').name)
expectType<number>(new FilePolyfill(['ok'], 'ok.txt').lastModified)
expectAssignable<FormDataEntryValue>(new FilePolyfill(['ok'], 'ok.txt'))
expectAssignable<FormDataEntryValue>(new BlobPolyfill(['ok']))
const formDataPolyfill = new FormDataPolyfill()
expectType<void>(formDataPolyfill.append('file', new FilePolyfill(['ok'], 'ok.txt'), 'renamed.txt'))
expectType<void>(formDataPolyfill.set('blob', new BlobPolyfill(['ok']), 'blob.txt'))
expectError(formDataPolyfill.append('text', 'ok', 'text.txt'))

const miniProgramOptions: RequestGlobalsMiniProgramOptions = {
  enableChunked: true,
  enableHttp2: true,
  timeout: 3_000,
}
const socketMiniProgramOptions: WebSocketMiniProgramOptions = {
  forceCellularNetwork: true,
  timeout: 5_000,
}
const networkDefaults: MiniProgramNetworkDefaults = {
  request: miniProgramOptions,
  socket: socketMiniProgramOptions,
}
expectAssignable<RequestGlobalsFetchInit>({
  miniProgram: miniProgramOptions,
  miniprogram: {
    enableCache: true,
    useHighPerformanceMode: true,
  },
})
expectAssignable<RequestInit>({
  miniProgram: miniProgramOptions,
  miniprogram: {
    enableCache: true,
  },
})
expectType<MiniProgramNetworkDefaults>(setMiniProgramNetworkDefaults(networkDefaults))
expectType<MiniProgramNetworkDefaults>(getMiniProgramNetworkDefaults())
expectType<MiniProgramNetworkDefaults>(resetMiniProgramNetworkDefaults())

expectError<WeappInjectWebRuntimeGlobalsTarget>('URL')
expectError<InstallWebRuntimeGlobalsOptions>({
  targets: ['URL'],
})

const bodyRequest = new RequestPolyfill('https://example.test', { method: 'POST', body: 'hello' })
expectType<Promise<Uint8Array<ArrayBuffer>>>(bodyRequest.bytes())
expectType<Promise<ArrayBuffer>>(bodyRequest.arrayBuffer())
expectType<Promise<string>>(bodyRequest.text())
expectType<Promise<any>>(bodyRequest.json())
expectType<Promise<Blob | BlobPolyfill>>(bodyRequest.blob())
expectType<Promise<Uint8Array<ArrayBuffer>>>(new ResponsePolyfill('hello').bytes())
expectType<Promise<Uint8Array<ArrayBuffer>>>(new BlobPolyfill(['hello']).bytes())
expectType<BlobPolyfill>(new BlobPolyfill(['hello']).slice(-2, undefined, 'text/plain'))
expectType<BlobPolyfill>(new FilePolyfill(['hello'], 'hello.txt').slice())
new HeadersPolyfill().forEach((value, key, parent) => {
  expectType<string>(value)
  expectType<string>(key)
  expectType<HeadersPolyfill>(parent)
}, {})
