import type { WeapiMiniProgramRequestMethod } from '@wevu/api'
import type { RequestGlobalsMiniProgramOptions } from '@wevu/web-apis'

export type HeaderPair = readonly [string, string]
export type HeaderMap = Record<string, string>

export interface HeaderLike {
  forEach: (callback: (value: string, key: string) => void) => void
}

export interface WevuFetchInit {
  method?: string
  headers?: unknown
  body?: unknown
  signal?: AbortSignal | null
  miniProgram?: RequestGlobalsMiniProgramOptions
  miniprogram?: RequestGlobalsMiniProgramOptions
  [key: string]: unknown
}

export interface RequestLikeInput {
  url: string
  method?: string
  headers?: unknown
  signal?: AbortSignal | null
  bodyUsed?: boolean
  clone?: () => {
    arrayBuffer?: () => Promise<ArrayBuffer>
    text?: () => Promise<string>
  }
}

export type WevuFetchInput = string | URL | RequestLikeInput
export type MiniProgramRequestMethod = WeapiMiniProgramRequestMethod
export type WxRequestMethod = MiniProgramRequestMethod

export const REQUEST_METHODS: ReadonlyArray<MiniProgramRequestMethod> = [
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
  'DELETE',
  'TRACE',
  'CONNECT',
]
