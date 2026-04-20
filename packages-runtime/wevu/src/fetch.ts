import type { WeapiMiniProgramRequestMethod } from '@wevu/api'

export { fetch } from '@wevu/web-apis/fetch'
export type { RequestGlobalsFetchInit as WevuFetchInit } from '@wevu/web-apis/fetch'

export type WevuFetchInput = Parameters<typeof import('@wevu/web-apis/fetch').fetch>[0]
export type MiniProgramRequestMethod = WeapiMiniProgramRequestMethod
export type WxRequestMethod = MiniProgramRequestMethod
