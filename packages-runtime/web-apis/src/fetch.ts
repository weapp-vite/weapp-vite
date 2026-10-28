import type { RequestGlobalsFetchInit, RequestGlobalsFetchInput } from './fetch/meta'
import { resolveRequestMeta } from './fetch/meta'
import { sendFetchRequest } from './fetch/transport'

export type { RequestGlobalsFetchInit } from './fetch/meta'
export type { RequestGlobalsMiniProgramOptions } from './networkDefaults'

/** 使用小程序请求传输提供 Fetch 接口，流式能力由宿主真实响应元数据决定。 */
export function fetch(input: RequestGlobalsFetchInput, init?: RequestGlobalsFetchInit): Promise<Response> {
  return resolveRequestMeta(input, init).then(sendFetchRequest)
}
