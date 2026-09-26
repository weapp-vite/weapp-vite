import type { WEVU_READY_CALLED_KEY } from '@weapp-core/constants'
import type { MiniProgramPageLike } from '../../routerInternal/types'
import type { InternalRuntimeState } from '../../runtime/types'
import type { LocationQueryRaw } from '../types'
import { WEVU_HOOKS_KEY, WEVU_NATIVE_INSTANCE_KEY, WEVU_ROUTE_EVENT_CONTRACT_KEY } from '@weapp-core/constants'
import { pushHook } from '../../runtime/hooks/base'
import { getCurrentMiniProgramGlobalObject, getCurrentMiniProgramPages } from '../../runtime/platform'

type ScrollHook = (...args: unknown[]) => void

export interface ScrollPage extends MiniProgramPageLike {
  __wxWebviewId__?: number | string
  [WEVU_NATIVE_INSTANCE_KEY]?: ScrollPage
  [WEVU_READY_CALLED_KEY]?: boolean
  [WEVU_HOOKS_KEY]?: Record<string, ScrollHook | ScrollHook[]>
  $?: ScrollPage
  selectOwnerComponent?: () => ScrollPage | undefined
  onPageScroll?: (event: { scrollTop: number }) => unknown
}

export interface ScrollRouteEvent {
  routeEventId: string
  path: string
  query?: LocationQueryRaw
  openType?: string
  webviewId?: number
  renderer?: string
  page?: ScrollPage
}

const routeEvents = ['BeforeAppRoute', 'BeforePageUnload', 'AppRoute', 'AppRouteDone'] as const
export type ScrollRouteEventName = typeof routeEvents[number]

export function supportsScrollRouteEvents(host = getCurrentMiniProgramGlobalObject()): boolean {
  if (!host || !routeEvents.every(name => typeof host[`on${name}`] === 'function' && typeof host[`off${name}`] === 'function')) {
    return false
  }
  if (host[WEVU_ROUTE_EVENT_CONTRACT_KEY] === 1) {
    return true
  }
  const version = host.getAppBaseInfo?.().SDKVersion ?? host.getSystemInfoSync?.().SDKVersion
  if (typeof version !== 'string') {
    return false
  }
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\D|$)/.exec(version)
  if (!match) {
    return false
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  return major > 3 || (major === 3 && (minor > 5 || (minor === 5 && patch >= 5)))
}

export function subscribeScrollRouteEvents(handlers: Record<ScrollRouteEventName, (event: ScrollRouteEvent) => void>): () => void {
  const host = getCurrentMiniProgramGlobalObject()!
  const cleanups: Array<() => void> = []
  try {
    for (const name of routeEvents) {
      const listener = (event: ScrollRouteEvent) => {
        if (typeof event?.routeEventId === 'string' && typeof event.path === 'string') {
          handlers[name](event)
        }
      }
      host[`on${name}`](listener)
      cleanups.push(() => host[`off${name}`](listener))
    }
  }
  catch (error) {
    for (const cleanup of cleanups) {
      cleanup()
    }
    throw error
  }
  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

export function currentScrollPage(): ScrollPage | undefined {
  const pages = getCurrentMiniProgramPages()
  return pages[pages.length - 1]
}

/** 按实例或宿主页面 id 查找归属，不用路径猜测同路由的多个页面。 */
export function resolveScrollPage(instance: ScrollPage): ScrollPage | undefined {
  const pages = getCurrentMiniProgramPages()
  const visited = new Set<object>()
  let owner: ScrollPage | undefined = instance
  while (owner && !visited.has(owner)) {
    visited.add(owner)
    if (pages.includes(owner)) {
      return owner
    }
    const pageId = owner.__wxWebviewId__
    if (pageId !== undefined) {
      const page = pages.find(candidate => candidate.__wxWebviewId__ === pageId)
      if (page) {
        return page
      }
    }
    const native: ScrollPage | undefined = owner[WEVU_NATIVE_INSTANCE_KEY] ?? owner.$
    owner = native && native !== owner
      ? native
      : owner.selectOwnerComponent?.()
  }
  return undefined
}

export function addScrollHook(instance: ScrollPage, name: string, handler: ScrollHook): () => void {
  pushHook(instance as InternalRuntimeState, name, handler)
  return () => {
    const bucket = instance[WEVU_HOOKS_KEY]
    const hooks = bucket?.[name]
    if (bucket && Array.isArray(hooks)) {
      // 不原地修改正在被生命周期分发器遍历的数组，避免跳过后续用户 hook。
      bucket[name] = hooks.filter(hook => hook !== handler)
    }
  }
}
