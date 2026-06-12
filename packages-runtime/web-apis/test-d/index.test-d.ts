import type {
  BlobPart,
  FormDataEntryValue,
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
import { expectError, expectType } from 'tsd'

const target: WeappInjectWebRuntimeGlobalsTarget = 'fetch'
expectType<WeappInjectWebRuntimeGlobalsTarget>(target)
expectType<WeappInjectRequestGlobalsTarget>(target)
expectType<WeappInjectWebRuntimeGlobalsTarget>('performance')
expectType<WeappInjectWebRuntimeGlobalsTarget>('crypto')
expectType<WeappInjectWebRuntimeGlobalsTarget>('queueMicrotask')

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
expectType<void>(installWebRuntimeGlobals(options))
expectType<void>(installWebRuntimeGlobals())
expectType<void>(installRequestGlobals(options))
expectType<void>(installRequestGlobals())
expectType<RequestPolyfill>(new RequestPolyfill(new URLPolyfill('https://request-globals.invalid')))
expectType<URLPolyfill | null>(URLPolyfill.parse('/path', 'https://request-globals.invalid'))
expectType<boolean>(URLPolyfill.canParse('/path', 'https://request-globals.invalid'))
expectType<number>(new URLSearchParamsPolyfill('b=2&a=1').size)
expectType<void>(new URLSearchParamsPolyfill('b=2&a=1').sort())
expectType<string[]>(new HeadersPolyfill([['Set-Cookie', 'a=1']]).getSetCookie())
expectType<ResponsePolyfill>(ResponsePolyfill.json({ ok: true }))
expectType<ResponsePolyfill>(ResponsePolyfill.error())
expectType<Uint8Array>(new TextEncoderPolyfill().encode('ok'))
expectType<string>(new TextDecoderPolyfill().decode(new Uint8Array([111, 107])))
expectType<BlobPart>('ok')
expectType<BlobPart>(new BlobPolyfill(['ok']))
expectType<FilePolyfill>(new FilePolyfill(['ok'], 'ok.txt', {
  lastModified: 123,
  type: 'text/plain',
}))
expectType<string>(new FilePolyfill(['ok'], 'ok.txt').name)
expectType<number>(new FilePolyfill(['ok'], 'ok.txt').lastModified)
expectType<FormDataEntryValue>(new FilePolyfill(['ok'], 'ok.txt'))
expectType<FormDataEntryValue>(new BlobPolyfill(['ok']))
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
expectType<RequestGlobalsFetchInit>({
  miniProgram: miniProgramOptions,
  miniprogram: {
    enableCache: true,
    useHighPerformanceMode: true,
  },
})
expectType<RequestInit>({
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
