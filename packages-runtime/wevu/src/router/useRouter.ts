import type { WevuNamedRouteMap } from '../router'
import type { RouterNavigation } from './types'
import { getActiveRouter } from './instance'

/**
 * @description 获取当前已创建的路由实例。
 */
export function useRouter<TRouteMap extends object = WevuNamedRouteMap>(): RouterNavigation<TRouteMap> {
  const router = getActiveRouter()
  if (router) {
    return router as unknown as RouterNavigation<TRouteMap>
  }

  throw new Error('useRouter() 未找到已创建的 router 实例。请先在 setup() 中调用 createRouter()。')
}
