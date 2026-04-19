import type {
  InstallWebRuntimeGlobalsOptions,
  WeappInjectRequestGlobalsTarget,
  WeappInjectWebRuntimeGlobalsTarget,
} from '@wevu/web-apis'
import type {
  RequestGlobalsFetchInit,
  RequestGlobalsMiniProgramOptions,
} from '@wevu/web-apis/fetch'
import {
  installRequestGlobals,
  installWebRuntimeGlobals,
  RequestPolyfill,
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
}
expectType<WeappInjectWebRuntimeGlobalsTarget[] | undefined>(options.targets)
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

expectError<WeappInjectWebRuntimeGlobalsTarget>('URL')
expectError<InstallWebRuntimeGlobalsOptions>({
  targets: ['URL'],
})
