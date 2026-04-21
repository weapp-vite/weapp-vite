import { onPullDownRefresh, onReachBottom } from 'wevu'

export function usePageFeatureHooks(logs: string[]) {
  onPullDownRefresh(() => {
    logs.push('pull')
    wx.stopPullDownRefresh()
  })

  onReachBottom(() => {
    logs.push('bottom')
  })
}
