import type { InstallWebRuntimeGlobalsOptions as LegacyInstallWebRuntimeGlobalsOptions, MiniProgramNetworkDefaults } from '@wevu/web-apis'
import type {
  InstallWebRuntimeGlobalsOptions,
  WebRuntimeGlobalsHost,
  WebRuntimeInstallContext,
} from '@wevu/web-apis/installers'
import { installWebRuntimeGlobals } from '@wevu/web-apis'
import {
  createWebRuntimeInstallContext,
  installWebRuntimeAtob,
  installWebRuntimeFetch,
  installWebRuntimeUrlGlobals,
  setMiniProgramNetworkDefaults,
} from '@wevu/web-apis/installers'
import { expectAssignable, expectType } from 'tsd'

const options: InstallWebRuntimeGlobalsOptions = {
  targets: ['fetch', 'atob'],
  networkDefaults: { request: { timeout: 3_000 } },
}
const context = createWebRuntimeInstallContext()
const host: WebRuntimeGlobalsHost = context.primaryHost

expectType<WebRuntimeInstallContext>(context)
expectAssignable<WebRuntimeGlobalsHost>(host)
expectType<void>(installWebRuntimeFetch(context))
expectType<void>(installWebRuntimeAtob(context))
expectType<void>(installWebRuntimeUrlGlobals(context))
expectType<WebRuntimeGlobalsHost>(installWebRuntimeGlobals({
  targets: [...options.targets ?? []],
  networkDefaults: options.networkDefaults,
} satisfies LegacyInstallWebRuntimeGlobalsOptions))
expectType<MiniProgramNetworkDefaults>(setMiniProgramNetworkDefaults(options.networkDefaults))
