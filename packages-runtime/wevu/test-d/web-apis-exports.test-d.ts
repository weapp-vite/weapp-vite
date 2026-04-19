import type {
  InstallWebRuntimeGlobalsOptions,
  MiniProgramNetworkDefaults,
  HeadersPolyfill as RootHeadersPolyfill,
} from 'wevu'
import { expectType } from 'tsd'
import {
  installWebRuntimeGlobals,
  setMiniProgramNetworkDefaults,
} from 'wevu'
import {
  HeadersPolyfill as FetchHeadersPolyfill,
  installWebRuntimeGlobals as installFetchWebRuntimeGlobals,
  setMiniProgramNetworkDefaults as setFetchMiniProgramNetworkDefaults,
} from 'wevu/fetch'

const installOptions: InstallWebRuntimeGlobalsOptions = {
  targets: ['fetch', 'XMLHttpRequest', 'WebSocket'],
  networkDefaults: {
    request: {
      enableHttp2: true,
      timeout: 3_000,
    },
    socket: {
      timeout: 5_000,
    },
  },
}

expectType<void>(installWebRuntimeGlobals(installOptions))
expectType<void>(installFetchWebRuntimeGlobals(installOptions))
expectType<MiniProgramNetworkDefaults>(setMiniProgramNetworkDefaults({
  request: {
    timeout: 1_000,
  },
}))
expectType<MiniProgramNetworkDefaults>(setFetchMiniProgramNetworkDefaults({
  socket: {
    timeout: 2_000,
  },
}))
expectType<typeof RootHeadersPolyfill>(FetchHeadersPolyfill)
