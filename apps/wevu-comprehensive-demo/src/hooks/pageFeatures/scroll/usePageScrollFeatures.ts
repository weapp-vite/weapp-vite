import type { Ref } from 'wevu'
import { onPageScroll, onPullDownRefresh, onReachBottom } from 'wevu'

export interface UsePageScrollFeaturesOptions {
  scrollTop: Ref<number>
  lastScrollAt: Ref<string>
  reachBottomCount: Ref<number>
  pullDownCount: Ref<number>
}

function formatTime() {
  return new Date().toLocaleTimeString()
}

export function usePageScrollFeatures(options: UsePageScrollFeaturesOptions) {
  onPageScroll((event: any) => {
    const top = Number((event && (event.scrollTop ?? 0)) || 0)
    options.scrollTop.value = top
    options.lastScrollAt.value = formatTime()
  })

  onReachBottom(() => {
    options.reachBottomCount.value += 1
  })

  onPullDownRefresh(() => {
    options.pullDownCount.value += 1
    wx.stopPullDownRefresh()
  })
}
