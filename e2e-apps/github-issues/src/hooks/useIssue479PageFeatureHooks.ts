import { onPullDownRefresh, onReachBottom } from 'wevu'

export function useIssue479PageFeatureHooks(logs: string[]) {
  onPullDownRefresh(() => {
    // eslint-disable-next-line no-console
    console.log('[issue-479] onPullDownRefresh')
    logs.push('pull')
    wx.stopPullDownRefresh()
  })

  onReachBottom(() => {
    // eslint-disable-next-line no-console
    console.log('[issue-479] onReachBottom')
    logs.push('bottom')
  })
}
