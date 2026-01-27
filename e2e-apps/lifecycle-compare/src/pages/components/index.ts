import type { LifecycleEntry } from '../../shared/lifecycle'
import { COMPONENT_HOOKS, finalizeLifecycleLogs, PAGE_HOOKS, recordLifecycle } from '../../shared/lifecycle'

const SOURCE = 'page.components'

type ComponentKind = 'native' | 'wevu-ts' | 'wevu-vue'

type ComponentSummary = Record<ComponentKind, { total: number, skipped: number, lastHook: string }>
interface ComponentLogEvent {
  detail?: {
    componentKind?: ComponentKind
    entry?: LifecycleEntry
  }
}

Page({
  data: {
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
    __componentLogs: {
      'native': [] as LifecycleEntry[],
      'wevu-ts': [] as LifecycleEntry[],
      'wevu-vue': [] as LifecycleEntry[],
    },
    __componentSummary: {
      'native': { total: 0, skipped: 0, lastHook: '' },
      'wevu-ts': { total: 0, skipped: 0, lastHook: '' },
      'wevu-vue': { total: 0, skipped: 0, lastHook: '' },
    } as ComponentSummary,
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
  handleComponentLog(event: ComponentLogEvent) {
    const detail = event.detail ?? {}
    const componentKind = detail.componentKind
    const entry = detail.entry
    if (!componentKind || !entry) {
      return
    }
    const current = this.data.__componentLogs ?? {}
    const list = Array.isArray(current[componentKind]) ? current[componentKind] : []
    list.push(entry)
    const total = list.length
    const skipped = list.filter(item => item?.skipped).length
    const lastHook = total ? list[total - 1]?.hook ?? '' : ''
    const summary = this.data.__componentSummary ?? {}
    this.setData({
      __componentLogs: {
        ...current,
        [componentKind]: list,
      },
      __componentSummary: {
        ...summary,
        [componentKind]: { total, skipped, lastHook },
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
