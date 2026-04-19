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
import {
  getMiniProgramNetworkDefaults,
  installRequestGlobals,
  installWebRuntimeGlobals,
  RequestPolyfill,
  resetMiniProgramNetworkDefaults,
  setMiniProgramNetworkDefaults,
  TextDecoderPolyfill,
  TextEncoderPolyfill,
  URLPolyfill,
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
expectType<Uint8Array>(new TextEncoderPolyfill().encode('ok'))
expectType<string>(new TextDecoderPolyfill().decode(new Uint8Array([111, 107])))

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
