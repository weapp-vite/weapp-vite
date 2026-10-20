import type { MiniProgramNetworkDefaults, RequestGlobalsMiniProgramOptions, WebSocketMiniProgramOptions } from '@wevu/web-apis/network-defaults'
import { getMiniProgramNetworkDefaults, setMiniProgramNetworkDefaults } from '@wevu/web-apis/network-defaults'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'

expectAssignable<MiniProgramNetworkDefaults>({ request: { redirect: 'follow', timeout: 3_000 }, socket: { perMessageDeflate: true } })
expectType<MiniProgramNetworkDefaults>(getMiniProgramNetworkDefaults())
expectType<MiniProgramNetworkDefaults>(setMiniProgramNetworkDefaults({ request: { enableHttpDNS: true } }))
expectNotAssignable<RequestGlobalsMiniProgramOptions>({ redirect: 'always' })
expectNotAssignable<WebSocketMiniProgramOptions>({ timeout: 'slow' })

declare const request: RequestGlobalsMiniProgramOptions
declare const socket: WebSocketMiniProgramOptions
expectError(request.url)
expectError(request.enableHttpDNSFallback)
expectError(socket.protocols)
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void wx
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void my
// @ts-expect-error 纯类型入口不得引入宿主或 DOM 全局声明。
void tt
