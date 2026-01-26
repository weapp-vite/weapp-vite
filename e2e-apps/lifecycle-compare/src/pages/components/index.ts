import { COMPONENT_HOOKS, finalizeLifecycleLogs, PAGE_HOOKS, recordLifecycle } from '../../shared/lifecycle'

const SOURCE = 'page.components'

Page({
  data: {
    __lifecycleLogs: [],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
    __componentLogs: {
      'native': [],
      'wevu-ts': [],
      'wevu-vue': [],
    },
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
      title: 'Lifecycle Components Share',
      path: '/pages/components/index',
    }
  },
  onShareTimeline() {
    recordLifecycle(this, 'onShareTimeline', [], { source: SOURCE })
    return {
      title: 'Lifecycle Components Timeline',
    }
  },
  onAddToFavorites(options) {
    recordLifecycle(this, 'onAddToFavorites', [options], { source: SOURCE })
    return {
      title: 'Lifecycle Components Favorite',
    }
  },
  onSaveExitState() {
    recordLifecycle(this, 'onSaveExitState', [], { source: SOURCE })
    return {
      data: {
        reason: 'components',
      },
    }
  },
  handleComponentLog(event) {
    const detail = event?.detail ?? {}
    const componentKind = detail.componentKind
    const entry = detail.entry
    if (!componentKind || !entry) {
      return
    }
    const current = this.data.__componentLogs ?? {}
    const list = Array.isArray(current[componentKind]) ? current[componentKind] : []
    list.push(entry)
    this.setData({
      __componentLogs: {
        ...current,
        [componentKind]: list,
      },
    })
  },
  finalizeLifecycleLogs() {
    finalizeLifecycleLogs(this, PAGE_HOOKS, { source: SOURCE })
    const nativeComp = this.selectComponent('#nativeComp')
    const wevuTsComp = this.selectComponent('#wevuTsComp')
    const wevuVueComp = this.selectComponent('#wevuVueComp')
    nativeComp?.finalizeLifecycleLogs?.(COMPONENT_HOOKS)
    wevuTsComp?.finalizeLifecycleLogs?.(COMPONENT_HOOKS)
    wevuVueComp?.finalizeLifecycleLogs?.(COMPONENT_HOOKS)
  },
})
