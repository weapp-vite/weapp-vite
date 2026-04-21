import { onPullDownRefresh, onReachBottom } from 'wevu'

export function usePageFeatureHooks(logs: string[]) {
  onPullDownRefresh(() => {
    logs.push('pull')
  })

  onReachBottom(() => {
    logs.push('bottom')
  })
}
