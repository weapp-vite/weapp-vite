import { onPullDownRefresh } from 'wevu'
import { wpi } from 'wevu/api'

export function usePullDownRefresh(refresh: () => void | Promise<void>) {
  onPullDownRefresh(async () => {
    try {
      await refresh()
    }
    catch {}
    await wpi.stopPullDownRefresh()
  })
}
