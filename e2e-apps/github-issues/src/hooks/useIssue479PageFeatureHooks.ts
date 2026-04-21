import { onPullDownRefresh, onReachBottom } from 'wevu'

export function useIssue479PageFeatureHooks(logs: string[]) {
  onPullDownRefresh(() => {
    logs.push('pull')
    wx.stopPullDownRefresh()
  })

  onReachBottom(() => {
    logs.push('bottom')
  })
}
