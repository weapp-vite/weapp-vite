import type { LifecycleEntry } from '../../shared/lifecycle'
import { finalizeLifecycleLogs, PAGE_HOOKS, recordLifecycle } from '../../shared/lifecycle'

const SOURCE = 'page.native'

const items = Array.from({ length: 120 }, (_, index) => ({
  id: index,
  text: `Native item ${index + 1}`,
}))

Page({
  data: {
    items,
    __lifecycleLogs: [] as LifecycleEntry[],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
    __lifecycleExpected: PAGE_HOOKS,
    __lifecycleSummary: {
      total: PAGE_HOOKS.length,
      seen: 0,
      skipped: PAGE_HOOKS.length,
      entries: 0,
      lastHook: '',
    },
    __lifecyclePreview: [] as LifecycleEntry[],
  },
  onLoad(query) {
    recordLifecycle(this, 'onLoad', [query], { source: SOURCE })
  },
  onShow() {
    recordLifecycle(this, 'onShow', [], { source: SOURCE })
  },
  onReady() {
    recordLifecycle(this, 'onReady', [], { source: SOURCE })
  },
  onHide() {
    recordLifecycle(this, 'onHide', [], { source: SOURCE })
  },
  onUnload() {
    recordLifecycle(this, 'onUnload', [], { source: SOURCE })
  },
  onRouteDone() {
    recordLifecycle(this, 'onRouteDone', [], { source: SOURCE })
  },
  onPullDownRefresh() {
    recordLifecycle(this, 'onPullDownRefresh', [], { source: SOURCE })
    wx.stopPullDownRefresh()
  },
  onReachBottom() {
    recordLifecycle(this, 'onReachBottom', [], { source: SOURCE })
  },
  onPageScroll(options) {
    recordLifecycle(this, 'onPageScroll', [options], { source: SOURCE })
  },
  onResize(options) {
    recordLifecycle(this, 'onResize', [options], { source: SOURCE })
  },
  onTabItemTap(options) {
    recordLifecycle(this, 'onTabItemTap', [options], { source: SOURCE })
  },
  onShareAppMessage(options) {
    recordLifecycle(this, 'onShareAppMessage', [options], { source: SOURCE })
    return {
      title: 'Lifecycle Native Share',
      path: '/pages/native/index',
    }
  },
  onShareTimeline() {
    recordLifecycle(this, 'onShareTimeline', [], { source: SOURCE })
    return {
      title: 'Lifecycle Native Timeline',
    }
  },
  onAddToFavorites(options) {
    recordLifecycle(this, 'onAddToFavorites', [options], { source: SOURCE })
    return {
      title: 'Lifecycle Native Favorite',
    }
  },
  onSaveExitState() {
    recordLifecycle(this, 'onSaveExitState', [], { source: SOURCE })
    return {
      data: {
        reason: 'native',
      },
    }
  },
  finalizeLifecycleLogs() {
    return finalizeLifecycleLogs(this, PAGE_HOOKS, { source: SOURCE })
  },
})
