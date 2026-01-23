import { onPullDownRefresh } from 'wevu'

export function usePullDownRefresh(refresh: () => void | Promise<void>) {
  onPullDownRefresh(() => {
    const result = refresh()
    if (result && typeof (result as Promise<void>).catch === 'function') {
      ;(result as Promise<void>).catch(() => {})
    }
    wx.stopPullDownRefresh()
  })
}
