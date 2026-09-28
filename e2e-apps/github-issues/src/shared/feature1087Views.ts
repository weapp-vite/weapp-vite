import { nextTick, onHide, onReady, onShow, onUnload, shallowRef } from 'wevu'
import { useRoute, useScrollRestoration, useScrollViewRestoration } from 'wevu/router'
import {
  allocateFeature1087Instance,
  feature1087Records,
  getFeature1087Controller,
  navigateFeature1087,
  readFeature1087Probe,
  releaseFeature1087Restore,
  waitFeature1087Restore,
} from './feature1087'

interface ScrollEvent {
  detail: { scrollTop: number, scrollLeft: number }
}

/** 让 WebView、Skyline 和 tab 使用完全相同的业务列表与滚动适配器。 */
export function useFeature1087Views() {
  const controller = getFeature1087Controller()
  const route = useRoute()
  const path = route.fullPath
  const instance = allocateFeature1087Instance()
  const manual = route.query.manual === '1'
  const contentReady = shallowRef(!manual)
  const marker = shallowRef('fresh')
  const primary = useScrollViewRestoration({ controller, id: 'primary', manual })
  const secondary = useScrollViewRestoration({ controller, id: 'secondary', manual })
  let ready = false
  let primaryTop = 0
  let secondaryTop = 0
  let deferred = false
  const record = (phase: string) => {
    feature1087Records.push({ phase, instance, path, ready, contentReady: contentReady.value, primaryTop, secondaryTop })
  }
  const business = useScrollRestoration({
    controller,
    id: 'business',
    manual,
    capture() {
      record('capture')
      return { marker: marker.value, primaryTop, secondaryTop }
    },
    async restore(saved, context) {
      record('restore:start')
      if (deferred) {
        await waitFeature1087Restore()
      }
      if (!context.isActive()) {
        record('restore:stale')
        return
      }
      if (saved) {
        marker.value = saved.marker
      }
      record('restore:applied')
    },
  })
  onReady(() => {
    ready = true
    record('ready')
  })
  onShow(() => record('show'))
  onHide(() => record('hide'))
  onUnload(() => record('unload'))

  function onPrimaryScroll(event: ScrollEvent) {
    primaryTop = event.detail.scrollTop
    primary.onScroll(event)
  }
  function onSecondaryScroll(event: ScrollEvent) {
    secondaryTop = event.detail.scrollTop
    secondary.onScroll(event)
  }
  async function _setPosition(top: number, left: number, otherTop: number) {
    primary.scrollTop.value = top
    primary.scrollLeft.value = left
    secondary.scrollTop.value = otherTop
    marker.value = `saved:${top}:${left}:${otherTop}`
    await nextTick()
  }
  function _deferPosition(top: number, left: number, otherTop: number) {
    void waitFeature1087Restore().then(() => _setPosition(top, left, otherTop))
  }
  async function _loadContent() {
    contentReady.value = true
    await nextTick()
    record('content:loaded')
  }
  async function _restore(containersOnly = false) {
    const containers = [primary.scroll(), secondary.scroll()]
    if (!containersOnly) {
      containers.push(business.scroll())
    }
    return await Promise.all(containers)
  }
  function _beginDeferredRestore() {
    deferred = true
    marker.value = 'waiting'
    void business.scroll().then((applied) => {
      record(applied ? 'scroll:true' : 'scroll:false')
    })
  }
  function _invalidate(action: 'clearPrimary' | 'stopPrimary' | 'stopBusiness' | 'clearBusiness' | 'dispose') {
    if (action === 'clearPrimary') {
      primary.clear()
    }
    else if (action === 'stopPrimary') {
      primary.stop()
    }
    else if (action === 'stopBusiness') {
      business.stop()
    }
    else if (action === 'clearBusiness') {
      business.clear()
    }
    else {
      controller.dispose()
    }
  }
  function _snapshot() {
    return {
      ...readFeature1087Probe(),
      instance,
      path,
      ready,
      contentReady: contentReady.value,
      marker: marker.value,
      observed: { primaryTop, secondaryTop },
    }
  }
  function _measure() {
    return new Promise<unknown[]>((resolve) => {
      const query = wx.createSelectorQuery()
      query.select('#feature1087-primary').scrollOffset()
      query.select('#feature1087-secondary').scrollOffset()
      query.select('#feature1087-content').boundingClientRect()
      query.exec(resolve)
    })
  }
  return {
    contentReady,
    marker,
    primaryTop: primary.scrollTop,
    primaryLeft: primary.scrollLeft,
    secondaryTop: secondary.scrollTop,
    onPrimaryScroll,
    onSecondaryScroll,
    _setPosition,
    _deferPosition,
    _loadContent,
    _restore,
    _beginDeferredRestore,
    _invalidate,
    _snapshot,
    _measure,
    _release: releaseFeature1087Restore,
    _navigate: navigateFeature1087,
  }
}
