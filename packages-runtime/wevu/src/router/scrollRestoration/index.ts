import type { ScrollRegistration } from './controller'
import type { ScrollPage } from './host'
import type { ScrollRestorationContext, ScrollRestorationHandle, UseScrollRestorationOptions } from './types'
import { WEVU_READY_CALLED_KEY } from '@weapp-core/constants'
import { onScopeDispose } from '../../reactivity'
import { assertInSetup, getCurrentSetupContext } from '../../runtime/hooks/base'
import { getInitialNavigationPromise } from '../initialNavigation'
import { resolveScrollController } from './controller'
import { addScrollHook, currentScrollPage, resolveScrollPage } from './host'

export { createScrollRestoration } from './controller'
export type * from './types'

export function getScrollSetupScope() {
  const instance: ScrollPage = assertInSetup('useScrollRestoration')
  const proxy = getCurrentSetupContext<{ proxy: { $nextTick: () => Promise<void> } }>()?.proxy
  if (typeof proxy?.$nextTick !== 'function') {
    throw new TypeError('scroll restoration 需要具有宿主提交屏障的 wevu setup 实例。')
  }
  return { instance, commit: () => proxy.$nextTick() }
}

export function registerScrollRestoration<T extends object>(
  options: UseScrollRestorationOptions<T>,
  lifecycle?: { onBindPage?: (page: ScrollPage) => void, onStop?: () => void },
): ScrollRestorationHandle {
  const { instance, commit } = getScrollSetupScope()
  const state = resolveScrollController(options.controller)
  const cleanups: Array<() => void> = []
  let page: ScrollPage | undefined
  let route: ScrollRestorationContext['route'] | undefined
  let stopped = false
  let visible = true
  let captured = false
  let attempted = false
  let request = 0
  let instanceReady = Boolean(instance[WEVU_READY_CALLED_KEY])
  let pageReady = false
  let readyPromise: Promise<void> | undefined
  let resolveReady: (() => void) | undefined
  let registration: ScrollRegistration

  function releaseReady() {
    if (stopped || (instanceReady && pageReady)) {
      resolveReady?.()
    }
  }

  function bindPage() {
    if (page || stopped) {
      return
    }
    const owner = resolveScrollPage(instance)
    if (!owner) {
      return
    }
    const nextRoute = state.resolveRoute(owner)
    registration.key = typeof options.key === 'function' ? options.key(nextRoute) : options.key ?? nextRoute.fullPath
    const unregister = state.register(owner, registration)
    page = owner
    route = nextRoute
    cleanups.push(unregister)
    pageReady = Boolean(owner[WEVU_READY_CALLED_KEY])
    cleanups.push(addScrollHook(owner, 'onReady', () => {
      pageReady = true
      releaseReady()
      registration.restoreAutomatic()
    }))
    lifecycle?.onBindPage?.(owner)
  }

  async function scroll(): Promise<boolean> {
    if (stopped || state.disposed) {
      return false
    }
    bindPage()
    if (!page || !route) {
      throw new Error('无法确定 scroll restoration 的原生归属页面，请在页面 attached 后恢复。')
    }
    if (!visible || currentScrollPage() !== page) {
      return false
    }
    const ticket = ++request
    const generation = state.generation
    const context: ScrollRestorationContext = {
      route,
      routeEventId: state.transition?.page === page ? state.transition.event.routeEventId : undefined,
      isActive: () => !stopped && !state.disposed && visible && ticket === request
        && generation === state.generation && currentScrollPage() === page,
    }
    if (!instanceReady || !pageReady) {
      readyPromise ??= new Promise<void>((resolve) => {
        resolveReady = resolve
      })
      await readyPromise
    }
    if (!context.isActive()) {
      return false
    }
    const shouldMount = await getInitialNavigationPromise(page)
    if (shouldMount === false || !context.isActive()) {
      return false
    }
    await commit()
    if (!context.isActive()) {
      return false
    }
    // 同一个 key/id 的注册共享快照格式；格式由使用者的 T 契约约束。
    const snapshot = state.read(registration.key, registration.id) as T | undefined
    await options.restore(snapshot, context)
    return context.isActive()
  }

  registration = {
    key: '',
    id: options.id ?? 'default',
    capture() {
      if (stopped || state.disposed || !page || !visible || captured) {
        return
      }
      captured = true
      try {
        const snapshot = options.capture()
        if (snapshot !== null && 'then' in snapshot && typeof snapshot.then === 'function') {
          throw new TypeError('scroll restoration capture 必须同步返回快照，不能返回 Promise。')
        }
        state.save(registration.key, registration.id, snapshot)
      }
      catch (error) {
        state.clear(registration.key, registration.id)
        state.report(error)
      }
    },
    invalidate() {
      request++
      resolveReady?.()
      readyPromise = undefined
      resolveReady = undefined
    },
    restoreAutomatic() {
      const transition = state.transition
      if (stopped || options.manual || attempted || !instanceReady || !pageReady
        || !transition?.fresh || !transition.done || transition.page !== page) {
        return
      }
      attempted = true
      void scroll().catch(state.report)
    },
    stop() {
      if (stopped) {
        return
      }
      stopped = true
      request++
      releaseReady()
      for (const cleanup of cleanups) {
        cleanup()
      }
      cleanups.length = 0
      lifecycle?.onStop?.()
    },
  }

  function captureBeforeStop() {
    // 生命周期销毁保留最后快照；显式 stop 只注销，不能撤销先前的 clear。
    registration.capture()
    registration.stop()
  }

  cleanups.push(
    addScrollHook(instance, 'onAttached', bindPage),
    addScrollHook(instance, 'onReady', () => {
      bindPage()
      instanceReady = true
      releaseReady()
      registration.restoreAutomatic()
    }),
    addScrollHook(instance, 'onShow', () => {
      bindPage()
      visible = true
      captured = false
    }),
    addScrollHook(instance, 'onHide', () => {
      registration.capture()
      visible = false
      registration.invalidate()
    }),
    addScrollHook(instance, 'onDetached', captureBeforeStop),
    addScrollHook(instance, 'onUnload', captureBeforeStop),
  )
  onScopeDispose(captureBeforeStop)
  bindPage()
  registration.restoreAutomatic()
  return {
    automatic: state.controller.automatic && !options.manual,
    scroll,
    clear: () => {
      bindPage()
      if (page) {
        state.clear(registration.key, registration.id)
      }
    },
    stop: registration.stop,
  }
}

/** 在同步 setup 中注册快照；只恢复新实例，不覆盖原生保留页的位置。 */
export function useScrollRestoration<T extends object>(options: UseScrollRestorationOptions<T>): ScrollRestorationHandle {
  return registerScrollRestoration(options)
}
