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

interface EventBindingStats {
  view: {
    bindtap: number
    bindColonTap: number
    bothBindtap: number
    bothBindColonTap: number
    bothReverseBindtap: number
    bothReverseBindColonTap: number
  }
  nativeComponent: {
    bindprobe: number
    bindColonProbe: number
    bothBindprobe: number
    bothBindColonProbe: number
    bothReverseBindprobe: number
    bothReverseBindColonProbe: number
  }
  wevuSfcComponent: {
    bindprobe: number
    bindColonProbe: number
    bothBindprobe: number
    bothBindColonProbe: number
    bothReverseBindprobe: number
    bothReverseBindColonProbe: number
  }
}

type ProbeComponentType = 'nativeComponent' | 'wevuSfcComponent'
type ProbeBindingMode = 'bind' | 'bindColon' | 'both' | 'bothReverse'
type NamedEventNameType = 'hyphen' | 'underscore'
type NamedProbeBindingMode = 'bind' | 'bindColon' | 'both'

interface NamedEventBindingCounters {
  bind: number
  bindColon: number
  bothBind: number
  bothBindColon: number
}

interface NamedEventBindingStats {
  hyphen: Record<ProbeComponentType, NamedEventBindingCounters>
  underscore: Record<ProbeComponentType, NamedEventBindingCounters>
}

interface ProbeEmitterComponent {
  emitProbe?: (tag?: string) => void
  emitNamed?: (eventName?: string, tag?: string) => void
}

function createEventBindingStats(): EventBindingStats {
  return {
    view: {
      bindtap: 0,
      bindColonTap: 0,
      bothBindtap: 0,
      bothBindColonTap: 0,
      bothReverseBindtap: 0,
      bothReverseBindColonTap: 0,
    },
    nativeComponent: {
      bindprobe: 0,
      bindColonProbe: 0,
      bothBindprobe: 0,
      bothBindColonProbe: 0,
      bothReverseBindprobe: 0,
      bothReverseBindColonProbe: 0,
    },
    wevuSfcComponent: {
      bindprobe: 0,
      bindColonProbe: 0,
      bothBindprobe: 0,
      bothBindColonProbe: 0,
      bothReverseBindprobe: 0,
      bothReverseBindColonProbe: 0,
    },
  }
}

function createNamedEventBindingCounters(): NamedEventBindingCounters {
  return {
    bind: 0,
    bindColon: 0,
    bothBind: 0,
    bothBindColon: 0,
  }
}

function createNamedEventBindingStats(): NamedEventBindingStats {
  return {
    hyphen: {
      nativeComponent: createNamedEventBindingCounters(),
      wevuSfcComponent: createNamedEventBindingCounters(),
    },
    underscore: {
      nativeComponent: createNamedEventBindingCounters(),
      wevuSfcComponent: createNamedEventBindingCounters(),
    },
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
    __eventBindingStats: createEventBindingStats() as EventBindingStats,
    __namedEventBindingStats: createNamedEventBindingStats() as NamedEventBindingStats,
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
    const nativeLogs = nativeComp?.data?.__lifecycleLogs ?? []
    const wevuTsLogs = wevuTsComp?.data?.__lifecycleLogs ?? []
    const wevuVueLogs = wevuVueComp?.data?.__lifecycleLogs ?? []
    const summaries: ComponentSummary = {
      'native': {
        total: nativeLogs.length,
        skipped: nativeLogs.filter(item => item?.skipped).length,
        lastHook: nativeLogs.length ? nativeLogs[nativeLogs.length - 1]?.hook ?? '' : '',
      },
      'wevu-ts': {
        total: wevuTsLogs.length,
        skipped: wevuTsLogs.filter(item => item?.skipped).length,
        lastHook: wevuTsLogs.length ? wevuTsLogs[wevuTsLogs.length - 1]?.hook ?? '' : '',
      },
      'wevu-vue': {
        total: wevuVueLogs.length,
        skipped: wevuVueLogs.filter(item => item?.skipped).length,
        lastHook: wevuVueLogs.length ? wevuVueLogs[wevuVueLogs.length - 1]?.hook ?? '' : '',
      },
    }
    this.setData({
      __componentLogs: {
        'native': nativeLogs,
        'wevu-ts': wevuTsLogs,
        'wevu-vue': wevuVueLogs,
      },
      __componentSummary: summaries,
    })
  },
  resetEventBindingStats() {
    this.setData({
      __eventBindingStats: createEventBindingStats(),
    })
  },
  resetNamedEventBindingStats() {
    this.setData({
      __namedEventBindingStats: createNamedEventBindingStats(),
    })
  },
  getEventBindingStats() {
    return this.data.__eventBindingStats
  },
  getNamedEventBindingStats() {
    return this.data.__namedEventBindingStats
  },
  incrementNamedEventBindingStat(eventNameType: NamedEventNameType, componentType: ProbeComponentType, key: keyof NamedEventBindingCounters) {
    const currentValue = this.data.__namedEventBindingStats?.[eventNameType]?.[componentType]?.[key] ?? 0
    const path = `__namedEventBindingStats.${eventNameType}.${componentType}.${key}`
    this.setData({
      [path]: currentValue + 1,
    })
  },
  onViewBindtap() {
    this.setData({
      '__eventBindingStats.view.bindtap': (this.data.__eventBindingStats?.view?.bindtap ?? 0) + 1,
    })
  },
  onViewBindColonTap() {
    this.setData({
      '__eventBindingStats.view.bindColonTap': (this.data.__eventBindingStats?.view?.bindColonTap ?? 0) + 1,
    })
  },
  onViewBothBindtap() {
    this.setData({
      '__eventBindingStats.view.bothBindtap': (this.data.__eventBindingStats?.view?.bothBindtap ?? 0) + 1,
    })
  },
  onViewBothBindColonTap() {
    this.setData({
      '__eventBindingStats.view.bothBindColonTap': (this.data.__eventBindingStats?.view?.bothBindColonTap ?? 0) + 1,
    })
  },
  onViewBothReverseBindtap() {
    this.setData({
      '__eventBindingStats.view.bothReverseBindtap': (this.data.__eventBindingStats?.view?.bothReverseBindtap ?? 0) + 1,
    })
  },
  onViewBothReverseBindColonTap() {
    this.setData({
      '__eventBindingStats.view.bothReverseBindColonTap': (this.data.__eventBindingStats?.view?.bothReverseBindColonTap ?? 0) + 1,
    })
  },
  onNativeComponentBindprobe() {
    this.setData({
      '__eventBindingStats.nativeComponent.bindprobe': (this.data.__eventBindingStats?.nativeComponent?.bindprobe ?? 0) + 1,
    })
  },
  onNativeComponentBindColonProbe() {
    this.setData({
      '__eventBindingStats.nativeComponent.bindColonProbe': (this.data.__eventBindingStats?.nativeComponent?.bindColonProbe ?? 0) + 1,
    })
  },
  onNativeComponentBothBindprobe() {
    this.setData({
      '__eventBindingStats.nativeComponent.bothBindprobe': (this.data.__eventBindingStats?.nativeComponent?.bothBindprobe ?? 0) + 1,
    })
  },
  onNativeComponentBothBindColonProbe() {
    this.setData({
      '__eventBindingStats.nativeComponent.bothBindColonProbe': (this.data.__eventBindingStats?.nativeComponent?.bothBindColonProbe ?? 0) + 1,
    })
  },
  onNativeComponentBothReverseBindprobe() {
    this.setData({
      '__eventBindingStats.nativeComponent.bothReverseBindprobe': (this.data.__eventBindingStats?.nativeComponent?.bothReverseBindprobe ?? 0) + 1,
    })
  },
  onNativeComponentBothReverseBindColonProbe() {
    this.setData({
      '__eventBindingStats.nativeComponent.bothReverseBindColonProbe': (this.data.__eventBindingStats?.nativeComponent?.bothReverseBindColonProbe ?? 0) + 1,
    })
  },
  onWevuComponentBindprobe() {
    this.setData({
      '__eventBindingStats.wevuSfcComponent.bindprobe': (this.data.__eventBindingStats?.wevuSfcComponent?.bindprobe ?? 0) + 1,
    })
  },
  onWevuComponentBindColonProbe() {
    this.setData({
      '__eventBindingStats.wevuSfcComponent.bindColonProbe': (this.data.__eventBindingStats?.wevuSfcComponent?.bindColonProbe ?? 0) + 1,
    })
  },
  onWevuComponentBothBindprobe() {
    this.setData({
      '__eventBindingStats.wevuSfcComponent.bothBindprobe': (this.data.__eventBindingStats?.wevuSfcComponent?.bothBindprobe ?? 0) + 1,
    })
  },
  onWevuComponentBothBindColonProbe() {
    this.setData({
      '__eventBindingStats.wevuSfcComponent.bothBindColonProbe': (this.data.__eventBindingStats?.wevuSfcComponent?.bothBindColonProbe ?? 0) + 1,
    })
  },
  onWevuComponentBothReverseBindprobe() {
    this.setData({
      '__eventBindingStats.wevuSfcComponent.bothReverseBindprobe': (this.data.__eventBindingStats?.wevuSfcComponent?.bothReverseBindprobe ?? 0) + 1,
    })
  },
  onWevuComponentBothReverseBindColonProbe() {
    this.setData({
      '__eventBindingStats.wevuSfcComponent.bothReverseBindColonProbe': (this.data.__eventBindingStats?.wevuSfcComponent?.bothReverseBindColonProbe ?? 0) + 1,
    })
  },
  onNativeHyphenBind() {
    this.incrementNamedEventBindingStat('hyphen', 'nativeComponent', 'bind')
  },
  onNativeHyphenBindColon() {
    this.incrementNamedEventBindingStat('hyphen', 'nativeComponent', 'bindColon')
  },
  onNativeHyphenBothBind() {
    this.incrementNamedEventBindingStat('hyphen', 'nativeComponent', 'bothBind')
  },
  onNativeHyphenBothBindColon() {
    this.incrementNamedEventBindingStat('hyphen', 'nativeComponent', 'bothBindColon')
  },
  onNativeUnderscoreBind() {
    this.incrementNamedEventBindingStat('underscore', 'nativeComponent', 'bind')
  },
  onNativeUnderscoreBindColon() {
    this.incrementNamedEventBindingStat('underscore', 'nativeComponent', 'bindColon')
  },
  onNativeUnderscoreBothBind() {
    this.incrementNamedEventBindingStat('underscore', 'nativeComponent', 'bothBind')
  },
  onNativeUnderscoreBothBindColon() {
    this.incrementNamedEventBindingStat('underscore', 'nativeComponent', 'bothBindColon')
  },
  onWevuHyphenBind() {
    this.incrementNamedEventBindingStat('hyphen', 'wevuSfcComponent', 'bind')
  },
  onWevuHyphenBindColon() {
    this.incrementNamedEventBindingStat('hyphen', 'wevuSfcComponent', 'bindColon')
  },
  onWevuHyphenBothBind() {
    this.incrementNamedEventBindingStat('hyphen', 'wevuSfcComponent', 'bothBind')
  },
  onWevuHyphenBothBindColon() {
    this.incrementNamedEventBindingStat('hyphen', 'wevuSfcComponent', 'bothBindColon')
  },
  onWevuUnderscoreBind() {
    this.incrementNamedEventBindingStat('underscore', 'wevuSfcComponent', 'bind')
  },
  onWevuUnderscoreBindColon() {
    this.incrementNamedEventBindingStat('underscore', 'wevuSfcComponent', 'bindColon')
  },
  onWevuUnderscoreBothBind() {
    this.incrementNamedEventBindingStat('underscore', 'wevuSfcComponent', 'bothBind')
  },
  onWevuUnderscoreBothBindColon() {
    this.incrementNamedEventBindingStat('underscore', 'wevuSfcComponent', 'bothBindColon')
  },
  triggerComponentProbe(componentType: ProbeComponentType, bindingMode: ProbeBindingMode) {
    const selectors: Record<ProbeComponentType, Record<ProbeBindingMode, string>> = {
      nativeComponent: {
        bind: '#eventNativeBind',
        bindColon: '#eventNativeBindColon',
        both: '#eventNativeBoth',
        bothReverse: '#eventNativeBothReverse',
      },
      wevuSfcComponent: {
        bind: '#eventWevuBind',
        bindColon: '#eventWevuBindColon',
        both: '#eventWevuBoth',
        bothReverse: '#eventWevuBothReverse',
      },
    }
    const selector = selectors[componentType]?.[bindingMode]
    if (!selector) {
      return false
    }
    const component = this.selectComponent(selector) as ProbeEmitterComponent | null
    component?.emitProbe?.(`${componentType}:${bindingMode}`)
    return true
  },
  triggerNamedComponentProbe(componentType: ProbeComponentType, eventNameType: NamedEventNameType, bindingMode: NamedProbeBindingMode) {
    const eventNames: Record<NamedEventNameType, string> = {
      hyphen: 'probe-hyphen',
      underscore: 'probe_under',
    }
    const selectors: Record<NamedEventNameType, Record<ProbeComponentType, Record<NamedProbeBindingMode, string>>> = {
      hyphen: {
        nativeComponent: {
          bind: '#eventNativeHyphenBind',
          bindColon: '#eventNativeHyphenBindColon',
          both: '#eventNativeHyphenBoth',
        },
        wevuSfcComponent: {
          bind: '#eventWevuHyphenBind',
          bindColon: '#eventWevuHyphenBindColon',
          both: '#eventWevuHyphenBoth',
        },
      },
      underscore: {
        nativeComponent: {
          bind: '#eventNativeUnderscoreBind',
          bindColon: '#eventNativeUnderscoreBindColon',
          both: '#eventNativeUnderscoreBoth',
        },
        wevuSfcComponent: {
          bind: '#eventWevuUnderscoreBind',
          bindColon: '#eventWevuUnderscoreBindColon',
          both: '#eventWevuUnderscoreBoth',
        },
      },
    }
    const selector = selectors[eventNameType]?.[componentType]?.[bindingMode]
    if (!selector) {
      return false
    }
    const eventName = eventNames[eventNameType]
    const component = this.selectComponent(selector) as ProbeEmitterComponent | null
    component?.emitNamed?.(eventName, `${componentType}:${eventNameType}:${bindingMode}`)
    return true
  },
})
