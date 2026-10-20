import type { WeapiMiniProgramRequestDefaults, WeapiMiniProgramSocketDefaults } from '@weapp-core/api/network-options'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'

expectAssignable<WeapiMiniProgramRequestDefaults>({
  enableCache: true,
  enableChunked: false,
  enableHttp2: true,
  enableHttpDNS: true,
  enableProfile: false,
  enableQuic: false,
  forceCellularNetwork: false,
  httpDNSServiceId: 'dns-service',
  httpDNSTimeout: 2_000,
  redirect: 'manual',
  timeout: 3_000,
  useHighPerformanceMode: true,
})
expectAssignable<WeapiMiniProgramSocketDefaults>({
  forceCellularNetwork: false,
  header: { Authorization: 'token' },
  perMessageDeflate: true,
  timeout: 5_000,
})
expectNotAssignable<WeapiMiniProgramRequestDefaults>({ timeout: 'slow' })
expectNotAssignable<WeapiMiniProgramRequestDefaults>({ redirect: 'invalid' })
expectNotAssignable<WeapiMiniProgramSocketDefaults>({ perMessageDeflate: 'yes' })
expectNotAssignable<WeapiMiniProgramSocketDefaults>({ timeout: false })

declare const request: WeapiMiniProgramRequestDefaults
declare const socket: WeapiMiniProgramSocketDefaults
expectType<boolean | undefined>(request.enableHttpDNS)
expectType<Record<string, any> | undefined>(socket.header)
expectError(request.url)
expectError(request.success)
expectError(request.enableHttpDNSFallback)
expectError(socket.url)
expectError(socket.protocols)
expectError(socket.success)
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void wx
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void my
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void tt
