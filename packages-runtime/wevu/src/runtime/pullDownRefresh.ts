import { wpi } from '@wevu/api'
import { onPullDownRefresh } from './hooks'

export type PullDownRefreshHandler = () => void | Promise<void>

export interface UseAsyncPullDownRefreshOptions {
  onError?: (error: unknown) => void | Promise<void>
  stopPullDownRefresh?: () => unknown | Promise<unknown>
}

/**
 * 注册下拉刷新回调，并在回调结束后自动停止宿主下拉刷新状态。
 */
export function useAsyncPullDownRefresh(
  refresh: PullDownRefreshHandler,
  options: UseAsyncPullDownRefreshOptions = {},
) {
  onPullDownRefresh(async () => {
    try {
      await refresh()
    }
    catch (error) {
      await options.onError?.(error)
    }
    finally {
      const stop = options.stopPullDownRefresh ?? (() => wpi.stopPullDownRefresh())
      await stop()
    }
  })
}
