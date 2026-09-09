import type { QueryAbortController, QueryClientOptions } from './core/types'
import { AbortControllerPolyfill } from '@wevu/web-apis'
import { QueryClient } from './core/client'

/** 创建独立的查询客户端，显式复用小程序取消兼容层，不安装宿主全局。 */
export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    ...options,
    createAbortController: options.createAbortController ?? (() => {
      // 兼容层实现查询和请求桥需要的 AbortSignal 实例契约。
      return new AbortControllerPolyfill() as unknown as QueryAbortController
    }),
  })
}
