import type { InternalRuntimeState } from '../../runtime/types'
import type { ScrollPage } from './host'
import type { ScrollRestorationHandle, ScrollRestorationRegistrationOptions, ScrollViewRestorationHandle } from './types'
import { WEVU_PAGE_SCROLL_OBSERVERS_KEY, WEVU_PAGE_SCROLL_RESTORATION_OWNER_KEY } from '@weapp-core/constants'
import { ref } from '../../reactivity'
import { ensurePageHookOnInstance } from '../../runtime/hooks/pageScroll'
import { getCurrentMiniProgramGlobalObject } from '../../runtime/platform'
import { resolveScrollController } from './controller'
import { addScrollHook } from './host'
import { getScrollSetupScope, registerScrollRestoration } from './index'

/** WebView 页面适配器；Skyline 没有隐式页面滚动容器。 */
export function usePageScrollRestoration(options: ScrollRestorationRegistrationOptions = {}): ScrollRestorationHandle {
  const state = resolveScrollController(options.controller)
  const host = getCurrentMiniProgramGlobalObject()
  if (typeof host?.pageScrollTo !== 'function') {
    throw new TypeError('当前宿主不支持 pageScrollTo，请使用显式 scroll-view 适配器。')
  }
  let top = 0
  let page: ScrollPage | undefined
  const cleanups: Array<() => void> = []

  return registerScrollRestoration({
    ...options,
    capture: () => ({ top }),
    async restore(snapshot, context) {
      const transition = state.transition
      if (transition && transition.page === page && transition.event.renderer === 'skyline') {
        throw new Error('Skyline 不支持页面级滚动，请使用 useScrollViewRestoration()。')
      }
      if (!context.isActive()) {
        return
      }
      await new Promise<void>((resolve, reject) => {
        host.pageScrollTo({ scrollTop: snapshot?.top ?? 0, duration: 0, success: () => resolve(), fail: reject })
      })
    },
  }, {
    onBindPage(owner) {
      page = owner
      const releaseOwner = host[WEVU_PAGE_SCROLL_RESTORATION_OWNER_KEY]?.(page)
      if (typeof releaseOwner === 'function') {
        cleanups.push(releaseOwner)
      }
      cleanups.push(addScrollHook(page, WEVU_PAGE_SCROLL_OBSERVERS_KEY, (event) => {
        if (event && typeof event === 'object' && 'scrollTop' in event && typeof event.scrollTop === 'number') {
          top = event.scrollTop
        }
      }))
      ensurePageHookOnInstance(page as InternalRuntimeState, 'onPageScroll')
    },
    onStop() {
      for (const cleanup of cleanups) {
        cleanup()
      }
      cleanups.length = 0
    },
  })
}

/** 用属性控制 WebView/Skyline scroll-view，scroll 事件不产生 setData。 */
export function useScrollViewRestoration(options: ScrollRestorationRegistrationOptions = {}): ScrollViewRestorationHandle {
  const { commit } = getScrollSetupScope()
  const scrollTop = ref(0)
  const scrollLeft = ref(0)
  let top = 0
  let left = 0
  const handle = registerScrollRestoration({
    ...options,
    capture: () => ({ top, left }),
    async restore(snapshot, context) {
      if (!context.isActive()) {
        return
      }
      // 先同步实际位置，确保重复恢复相同目标也会产生有效的属性变化。
      // 内容和目标滚动位置分次提交，避免原生 scroll-view 使用更新前的尺寸。
      scrollTop.value = top
      scrollLeft.value = left
      await commit()
      if (!context.isActive()) {
        return
      }
      scrollTop.value = snapshot?.top ?? 0
      scrollLeft.value = snapshot?.left ?? 0
      await commit()
    },
  })
  return {
    ...handle,
    scrollTop,
    scrollLeft,
    onScroll(event) {
      top = event.detail.scrollTop
      left = event.detail.scrollLeft
    },
  }
}
