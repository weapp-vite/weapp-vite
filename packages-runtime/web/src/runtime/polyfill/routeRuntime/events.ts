import type { ComponentPublicInstance } from '../../component'
import type { PageStackEntry } from './options'
import { WEVU_HOST_COMMIT_PROMISE_KEY } from '@weapp-core/constants'

export type AppRouteOpenType = 'appLaunch' | 'navigateTo' | 'redirectTo' | 'navigateBack' | 'switchTab' | 'reLaunch'

export interface AppRouteEvent {
  routeEventId: string
  path: string
  query: Record<string, string>
  openType: AppRouteOpenType
  webviewId: number
  renderer: 'webview'
  page?: ComponentPublicInstance
}

export interface BeforePageUnloadEvent extends AppRouteEvent {
  page: ComponentPublicInstance
}

export type AppRouteCallback = (event: AppRouteEvent) => void
export type BeforePageUnloadCallback = (event: BeforePageUnloadEvent) => void

const beforeCallbacks = new Set<AppRouteCallback>()
const routeCallbacks = new Set<AppRouteCallback>()
const doneCallbacks = new Set<AppRouteCallback>()
const unloadCallbacks = new Set<BeforePageUnloadCallback>()
const webviewIds = new WeakMap<PageStackEntry, number>()
let nextWebviewId = 0
let nextRouteEventId = 0

export function onBeforeAppRoute(callback: AppRouteCallback) {
  beforeCallbacks.add(callback)
}

export function offBeforeAppRoute(callback?: AppRouteCallback) {
  if (callback) {
    beforeCallbacks.delete(callback)
  }
  else {
    beforeCallbacks.clear()
  }
}

export function onAppRoute(callback: AppRouteCallback) {
  routeCallbacks.add(callback)
}

export function offAppRoute(callback?: AppRouteCallback) {
  if (callback) {
    routeCallbacks.delete(callback)
  }
  else {
    routeCallbacks.clear()
  }
}

export function onAppRouteDone(callback: AppRouteCallback) {
  doneCallbacks.add(callback)
}

export function offAppRouteDone(callback?: AppRouteCallback) {
  if (callback) {
    doneCallbacks.delete(callback)
  }
  else {
    doneCallbacks.clear()
  }
}

export function onBeforePageUnload(callback: BeforePageUnloadCallback) {
  unloadCallbacks.add(callback)
}

export function offBeforePageUnload(callback?: BeforePageUnloadCallback) {
  if (callback) {
    unloadCallbacks.delete(callback)
  }
  else {
    unloadCallbacks.clear()
  }
}

function emit<T>(callbacks: Set<(event: T) => void>, event: T) {
  if (!callbacks.size) {
    return
  }
  for (const callback of [...callbacks]) {
    try {
      callback(event)
    }
    catch (error) {
      // eslint-disable-next-line no-console -- 观察者异常仍需可见，但不能中断宿主路由。
      console.error(error)
    }
  }
}

export function getEntryWebviewId(entry: PageStackEntry) {
  let id = webviewIds.get(entry)
  if (id === undefined) {
    id = ++nextWebviewId
    webviewIds.set(entry, id)
  }
  return id
}

export function beginAppRoute(entry: PageStackEntry, openType: AppRouteOpenType): AppRouteEvent {
  const event: AppRouteEvent = {
    routeEventId: `web-route-${++nextRouteEventId}`,
    path: entry.id,
    query: { ...entry.query },
    openType,
    webviewId: getEntryWebviewId(entry),
    renderer: 'webview',
  }
  entry.routeEventId = event.routeEventId
  emit(beforeCallbacks, event)
  return event
}

export function emitBeforePageUnload(entry: PageStackEntry, event: AppRouteEvent) {
  if (entry.instance) {
    emit(unloadCallbacks, {
      ...event,
      path: entry.id,
      query: { ...entry.query },
      webviewId: getEntryWebviewId(entry),
      page: entry.instance,
    })
  }
}

export function cancelEntryRoute(entry: PageStackEntry) {
  entry.routeEventId = undefined
  entry.onRouteMounted = undefined
  entry.onRouteReady = undefined
}

/** 路由成功与页面提交分别由栈操作和真实生命周期确认，不依赖 API Promise 或定时器。 */
export function finishAppRoute(entry: PageStackEntry, event: AppRouteEvent) {
  const isCurrent = () => entry.active && !entry.destroyed && entry.routeEventId === event.routeEventId
  const finishReady = async () => {
    if (!isCurrent() || !entry.instance || !entry.ready) {
      return
    }
    entry.onRouteReady = undefined
    const page = entry.instance as ComponentPublicInstance & {
      [WEVU_HOST_COMMIT_PROMISE_KEY]?: Promise<unknown>
    }
    try {
      // onReady/setData 可在首个 Lit 更新期间再请求提交，必须等到当前提交链稳定。
      let commit: unknown
      do {
        commit = page[WEVU_HOST_COMMIT_PROMISE_KEY]
        await commit
        if (!isCurrent() || entry.instance !== page) {
          return
        }
      } while (page[WEVU_HOST_COMMIT_PROMISE_KEY] !== commit)
      emit(doneCallbacks, { ...event, page })
    }
    catch (error) {
      // eslint-disable-next-line no-console -- 渲染失败必须报告，且不能伪造 done。
      console.error(error)
    }
  }
  const finishMounted = () => {
    if (!isCurrent() || !entry.instance) {
      return
    }
    entry.onRouteMounted = undefined
    emit(routeCallbacks, { ...event, page: entry.instance })
    if (!isCurrent()) {
      return
    }
    entry.onRouteReady = () => {
      void finishReady()
    }
    void finishReady()
  }
  entry.onRouteMounted = finishMounted
  if (entry.instance) {
    finishMounted()
  }
}
