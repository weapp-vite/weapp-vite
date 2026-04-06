import { wpi } from '@wevu/api'
import { onPullDownRefresh } from 'wevu'

export function usePullDownRefresh(refresh: () => void | Promise<void>) {
  onPullDownRefresh(async () => {
    try {
      await refresh()
    }
    catch {}
    await wpi.stopPullDownRefresh()
  })
}
