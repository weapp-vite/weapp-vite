import type { WeapiMiniProgramConnectSocketOption, WeapiMiniProgramRequestOption } from '@weapp-core/api'
import type { WeapiMiniProgramRequestDefaults, WeapiMiniProgramSocketDefaults } from '@weapp-core/api/network-options'
import { expectType } from 'tsd'

type RequestKeys = 'enableCache' | 'enableChunked' | 'enableHttp2' | 'enableHttpDNS' | 'enableProfile' | 'enableQuic' | 'forceCellularNetwork' | 'httpDNSServiceId' | 'httpDNSTimeout' | 'redirect' | 'timeout' | 'useHighPerformanceMode'
type SocketKeys = 'forceCellularNetwork' | 'header' | 'perMessageDeflate' | 'timeout'

declare const request: WeapiMiniProgramRequestDefaults
declare const socket: WeapiMiniProgramSocketDefaults

declare const originalRequest: Pick<Partial<WeapiMiniProgramRequestOption>, RequestKeys>
declare const originalSocket: Pick<Partial<WeapiMiniProgramConnectSocketOption>, SocketKeys>

expectType<Pick<Partial<WeapiMiniProgramRequestOption>, RequestKeys>>(request)
expectType<WeapiMiniProgramRequestDefaults>(originalRequest)
expectType<Pick<Partial<WeapiMiniProgramConnectSocketOption>, SocketKeys>>(socket)
expectType<WeapiMiniProgramSocketDefaults>(originalSocket)
expectType<WechatMiniprogram.RequestOption>({} as WeapiMiniProgramRequestOption)
expectType<WechatMiniprogram.ConnectSocketOption>({} as WeapiMiniProgramConnectSocketOption)
expectType<RequestKeys>({} as keyof WeapiMiniProgramRequestDefaults)
expectType<SocketKeys>({} as keyof WeapiMiniProgramSocketDefaults)
