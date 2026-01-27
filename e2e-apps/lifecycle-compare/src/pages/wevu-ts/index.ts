import type { LifecycleData, LifecycleEntry, LifecycleInstance } from '../../shared/lifecycle'
import {
  defineComponent,
  onAddToFavorites,
  onHide,
  onLoad,
  onPageScroll,
  onPullDownRefresh,
  onReachBottom,
  onReady,
  onResize,
  onRouteDone,
  onSaveExitState,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onUnload,
} from 'wevu'
import { finalizeLifecycleLogs, PAGE_HOOKS, recordLifecycle } from '../../shared/lifecycle'

const SOURCE = 'page.wevu.ts'

type LifecyclePageData = LifecycleData & { items: { id: number, text: string }[] }

type LifecyclePageInstance = LifecycleInstance<LifecyclePageData> & { data: LifecyclePageData }

const items = Array.from({ length: 120 }, (_, index) => ({
  id: index,
  text: `WeVu TS item ${index + 1}`,
}))

export default defineComponent({
  data: () => ({
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
  }),
  features: {
    enableOnRouteDone: true,
    enableOnPullDownRefresh: true,
    enableOnReachBottom: true,
    enableOnPageScroll: true,
    enableOnResize: true,
    enableOnTabItemTap: true,
    enableOnShareAppMessage: true,
    enableOnShareTimeline: true,
    enableOnAddToFavorites: true,
    enableOnSaveExitState: true,
  },
  methods: {
    finalizeLifecycleLogs(this: LifecyclePageInstance) {
      return finalizeLifecycleLogs(this, PAGE_HOOKS, { source: SOURCE })
    },
  },
  setup(_, ctx) {
    const instance = ctx.instance as unknown as LifecyclePageInstance
    onLoad((query) => {
      recordLifecycle(instance, 'onLoad', [query], { source: SOURCE })
    })
    onShow(() => {
      recordLifecycle(instance, 'onShow', [], { source: SOURCE })
    })
    onReady(() => {
      recordLifecycle(instance, 'onReady', [], { source: SOURCE })
    })
    onHide(() => {
      recordLifecycle(instance, 'onHide', [], { source: SOURCE })
    })
    onUnload(() => {
      recordLifecycle(instance, 'onUnload', [], { source: SOURCE })
    })
    onRouteDone(() => {
      recordLifecycle(instance, 'onRouteDone', [], { source: SOURCE })
    })
    onPullDownRefresh(() => {
      recordLifecycle(instance, 'onPullDownRefresh', [], { source: SOURCE })
      wx.stopPullDownRefresh()
    })
    onReachBottom(() => {
      recordLifecycle(instance, 'onReachBottom', [], { source: SOURCE })
    })
    onPageScroll((options) => {
      recordLifecycle(instance, 'onPageScroll', [options], { source: SOURCE })
    })
    onResize((options) => {
      recordLifecycle(instance, 'onResize', [options], { source: SOURCE })
    })
    onTabItemTap((options) => {
      recordLifecycle(instance, 'onTabItemTap', [options], { source: SOURCE })
    })
    onShareAppMessage((options) => {
      recordLifecycle(instance, 'onShareAppMessage', [options], { source: SOURCE })
      return {
        title: 'Lifecycle WeVu TS Share',
        path: '/pages/wevu-ts/index',
      }
    })
    onShareTimeline(() => {
      recordLifecycle(instance, 'onShareTimeline', [], { source: SOURCE })
      return {
        title: 'Lifecycle WeVu TS Timeline',
      }
    })
    onAddToFavorites((options) => {
      recordLifecycle(instance, 'onAddToFavorites', [options], { source: SOURCE })
      return {
        title: 'Lifecycle WeVu TS Favorite',
      }
    })
    onSaveExitState(() => {
      recordLifecycle(instance, 'onSaveExitState', [], { source: SOURCE })
      return {
        data: {
          reason: 'wevu-ts',
        },
      }
    })
    return {}
  },
})
