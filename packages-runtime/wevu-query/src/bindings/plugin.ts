import type { RuntimeApp, WevuPlugin } from 'wevu'
import type { QueryClient } from '../core/client'
import type { Unsubscribe } from '../core/types'
import { inject } from 'wevu'

/** 查询客户端的 Wevu 注入键。 */
export const QueryClientKey: unique symbol = Symbol('@wevu/query.client')

/** 查询客户端需要的宿主状态订阅接口。 */
export interface QueryHost {
  subscribeOnline: (callback: (online: boolean) => void) => Unsubscribe
  subscribeForeground: (callback: (foreground: boolean) => void) => Unsubscribe
}

/** 查询插件的可选宿主绑定。 */
export interface CreateQueryPluginOptions {
  host?: QueryHost
}

function releasePlugin(cleanups: readonly Unsubscribe[], client: QueryClient) {
  let firstError: unknown
  let hasError = false
  for (const cleanup of cleanups) {
    try {
      cleanup()
    }
    catch (error) {
      if (!hasError) {
        firstError = error
        hasError = true
      }
    }
  }
  try {
    client.dispose()
  }
  catch (error) {
    if (!hasError) {
      firstError = error
      hasError = true
    }
  }
  if (hasError) {
    throw firstError
  }
}

/** 创建为应用提供查询客户端并同步宿主状态的 Wevu 插件。 */
export function createQueryPlugin(
  client: QueryClient,
  options: CreateQueryPluginOptions = {},
): WevuPlugin {
  return {
    install(app: RuntimeApp<any, any, any>) {
      app.provide(QueryClientKey, client)
      const cleanups: Unsubscribe[] = []
      if (options.host) {
        try {
          cleanups.push(options.host.subscribeOnline(online => client.setOnline(online)))
          cleanups.push(options.host.subscribeForeground(foreground => client.setForeground(foreground)))
        }
        catch (error) {
          releasePlugin(cleanups, client)
          throw error
        }
      }
      let released = false
      app.onUnmount(() => {
        if (released) {
          return
        }
        released = true
        releasePlugin(cleanups, client)
      })
    },
  }
}

/** 获取显式传入或当前应用提供的查询客户端。 */
export function useQueryClient(client?: QueryClient): QueryClient {
  if (client) {
    return client
  }
  const injected = inject<QueryClient | undefined>(QueryClientKey, undefined)
  if (!injected) {
    throw new Error('@wevu/query：未找到 QueryClient provider，请安装 createQueryPlugin(client) 或传入显式 client')
  }
  return injected
}
