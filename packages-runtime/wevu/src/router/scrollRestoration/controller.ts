import type { RouteLocationNormalizedLoaded, RouterNavigation } from '../types'
import type { ScrollPage, ScrollRouteEvent } from './host'
import type { ScrollRestorationController, ScrollRestorationOptions } from './types'
import { resolvePageRoute } from '../../routerInternal/shared'
import { getCurrentMiniProgramPages } from '../../runtime/platform'
import { getActiveRouter } from '../instance'
import { currentScrollPage, subscribeScrollRouteEvents, supportsScrollRouteEvents } from './host'

export interface ScrollRegistration {
  key: string
  id: string
  capture: () => void
  invalidate: () => void
  restoreAutomatic: () => void
  stop: () => void
}

interface ScrollTransition {
  event: ScrollRouteEvent
  page?: ScrollPage
  fresh: boolean
  done: boolean
}

export interface ScrollControllerState {
  readonly controller: ScrollRestorationController
  readonly disposed: boolean
  readonly transition: ScrollTransition | undefined
  readonly generation: number
  resolveRoute: (page: ScrollPage) => RouteLocationNormalizedLoaded
  register: (page: ScrollPage, registration: ScrollRegistration) => () => void
  read: (key: string, id: string) => object | undefined
  save: (key: string, id: string, value: object | null) => void
  clear: (key: string, id: string) => void
  report: (error: unknown) => void
}

const controllers = new WeakMap<ScrollRestorationController, ScrollControllerState>()
const routerControllers = new WeakMap<object, ScrollRestorationController>()

/** 创建显式启用的路由会话；不会安装全局默认滚动行为。 */
export function createScrollRestoration<TRouteMap extends object>(options: ScrollRestorationOptions<TRouteMap>): ScrollRestorationController {
  if (routerControllers.has(options.router)) {
    throw new Error('该 router 已创建 scroll restoration 会话，请复用或先 dispose()。')
  }
  // 泛型仅约束公开路由名，内部处理来自原生页面的标准化路径。
  const router = options.router as unknown as RouterNavigation
  const snapshots = new Map<string, Map<string, object>>()
  const registrations = new Map<ScrollPage, Set<ScrollRegistration>>()
  const seenPages = new WeakSet<object>(getCurrentMiniProgramPages())
  // eslint-disable-next-line no-console -- 自动恢复没有调用方 Promise；默认处理必须报告错误。
  const report = options.onError ?? ((error: unknown) => console.error('[wevu/router] scroll restoration:', error))
  let disposed = false
  let generation = 0
  let transition: ScrollTransition | undefined
  let unsubscribe: (() => void) | undefined

  const controller: ScrollRestorationController = {
    automatic: supportsScrollRouteEvents(),
    clear(key) {
      if (key === undefined) {
        snapshots.clear()
      }
      else {
        snapshots.delete(key)
      }
      for (const records of registrations.values()) {
        for (const record of records) {
          if (key === undefined || record.key === key) {
            record.invalidate()
          }
        }
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      generation++
      unsubscribe?.()
      for (const records of registrations.values()) {
        for (const record of records) {
          record.stop()
        }
      }
      registrations.clear()
      snapshots.clear()
      transition = undefined
      routerControllers.delete(options.router)
      controllers.delete(controller)
    },
  }

  const state: ScrollControllerState = {
    controller,
    get disposed() {
      return disposed
    },
    get transition() {
      return transition
    },
    get generation() {
      return generation
    },
    resolveRoute: page => router.resolve(resolvePageRoute(page)),
    register(page, registration) {
      if (disposed) {
        throw new Error('scroll restoration 会话已 dispose()。')
      }
      let records = registrations.get(page)
      if (!records) {
        records = new Set()
        registrations.set(page, records)
      }
      for (const record of records) {
        if (record.key === registration.key && record.id === registration.id) {
          throw new Error(`同一页面重复注册 scroll restoration key/id: ${registration.key} / ${registration.id}`)
        }
      }
      records.add(registration)
      return () => {
        records.delete(registration)
        if (records.size === 0) {
          registrations.delete(page)
        }
      }
    },
    read: (key, id) => snapshots.get(key)?.get(id),
    save(key, id, value) {
      if (disposed) {
        return
      }
      if (value === null) {
        state.clear(key, id)
        return
      }
      let entries = snapshots.get(key)
      if (!entries) {
        entries = new Map()
        snapshots.set(key, entries)
      }
      entries.set(id, value)
    },
    clear(key, id) {
      const entries = snapshots.get(key)
      entries?.delete(id)
      if (entries?.size === 0) {
        snapshots.delete(key)
      }
      for (const records of registrations.values()) {
        for (const record of records) {
          if (record.key === key && record.id === id) {
            record.invalidate()
          }
        }
      }
    },
    report,
  }

  if (controller.automatic) {
    unsubscribe = subscribeScrollRouteEvents({
      BeforeAppRoute(event) {
        if (disposed || transition?.event.routeEventId === event.routeEventId) {
          return
        }
        const page = currentScrollPage()
        if (page) {
          seenPages.add(page)
          for (const record of registrations.get(page) ?? []) {
            record.capture()
          }
        }
        generation++
        for (const records of registrations.values()) {
          for (const record of records) {
            record.invalidate()
          }
        }
        transition = { event, fresh: false, done: false }
      },
      BeforePageUnload(event) {
        const page = event.page
        if (!page) {
          return
        }
        // 低层卸载可能没有前置路由通知；仍在当前页时最后同步读取内存缓存。
        if (transition?.event.routeEventId !== event.routeEventId && page === currentScrollPage()) {
          for (const record of registrations.get(page) ?? []) {
            record.capture()
          }
        }
        for (const record of registrations.get(page) ?? []) {
          record.stop()
        }
      },
      AppRoute(event) {
        if (disposed || (transition && transition.event.routeEventId !== event.routeEventId)) {
          return
        }
        const page = currentScrollPage()
        if (!page || resolvePageRoute(page).path !== event.path.replace(/^\/+/, '')) {
          return
        }
        transition ??= { event, fresh: false, done: false }
        if (transition.page) {
          return
        }
        transition.page = page
        transition.fresh = !seenPages.has(page)
        seenPages.add(page)
      },
      AppRouteDone(event) {
        if (disposed || !transition) {
          return
        }
        // 原生同路径 reLaunch 可能返回空 id；只接受已确认的新页面对应的宿主 webview，
        // 不把旧页面、保留页面或仅路径相同的完成事件认作当前导航。
        const completesFreshPage = event.routeEventId === ''
          && transition.fresh
          && Number.isInteger(transition.event.webviewId)
          && event.webviewId === transition.event.webviewId
          && event.path === transition.event.path
          && typeof event.openType === 'string'
          && event.openType === transition.event.openType
        if (transition.event.routeEventId !== event.routeEventId && !completesFreshPage) {
          return
        }
        if (!transition.page || transition.page !== currentScrollPage() || transition.done) {
          return
        }
        transition.done = true
        for (const record of registrations.get(transition.page) ?? []) {
          record.restoreAutomatic()
        }
      },
    })
  }
  controllers.set(controller, state)
  routerControllers.set(options.router, controller)
  return controller
}

export function resolveScrollController(controller?: ScrollRestorationController): ScrollControllerState {
  const router = getActiveRouter()
  const resolved = controller ?? (router && routerControllers.get(router))
  const state = resolved && controllers.get(resolved)
  if (!state || state.disposed) {
    throw new Error('请先在应用启动时调用 createScrollRestoration({ router })，或传入有效的 controller。')
  }
  return state
}
