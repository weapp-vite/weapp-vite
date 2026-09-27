import type { HeadlessWxBeforePageUnloadEvent, HeadlessWxRouteEvent } from '../host/wx/api'
import type { HeadlessPageInstance } from './pageInstance'
import { createHeadlessUniEventBus } from '../host/wx/eventBus'

interface RouteEventMap {
  beforeAppRoute: HeadlessWxRouteEvent
  beforePageUnload: HeadlessWxBeforePageUnloadEvent
  appRoute: HeadlessWxRouteEvent
  appRouteDone: HeadlessWxRouteEvent
}

interface PageRouteState {
  webviewId: number
  ready: boolean
  event: HeadlessWxRouteEvent
  committed: boolean
}

/** 两种模拟器共用路由身份与监听状态，完成事件由页面就绪和宿主提交驱动。 */
export class HeadlessRouteEvents {
  private readonly bus = createHeadlessUniEventBus()
  private readonly pages = new WeakMap<HeadlessPageInstance, PageRouteState>()
  private nextRouteId = 0
  private nextWebviewId = 0
  private activeEvent: HeadlessWxRouteEvent | undefined

  constructor(
    private readonly requestRender: (callback: () => void) => void,
    private readonly isCurrentPage: (page: HeadlessPageInstance) => boolean,
  ) {}

  on<K extends keyof RouteEventMap>(name: K, listener: (event: RouteEventMap[K]) => void) {
    this.bus.$on(name, listener)
  }

  off<K extends keyof RouteEventMap>(name: K, listener?: (event: RouteEventMap[K]) => void) {
    this.bus.$off(name, listener)
  }

  begin(
    path: string,
    query: Record<string, string>,
    openType: HeadlessWxRouteEvent['openType'],
    renderer: unknown,
    page?: HeadlessPageInstance,
  ): HeadlessWxRouteEvent {
    const previous = page ? this.pages.get(page)! : undefined
    const event: HeadlessWxRouteEvent = {
      path,
      query: { ...query },
      openType: this.nextRouteId === 0 ? 'appLaunch' : openType,
      renderer: previous?.event.renderer ?? (renderer === 'skyline' || renderer === 'xr-frame' ? renderer : 'webview'),
      routeEventId: String(++this.nextRouteId),
      webviewId: previous?.webviewId ?? ++this.nextWebviewId,
      timeStamp: Date.now(),
    }
    this.activeEvent = event
    this.bus.$emit('beforeAppRoute', event)
    return event
  }

  attach(page: HeadlessPageInstance, event: HeadlessWxRouteEvent) {
    const state = this.pages.get(page)
    this.pages.set(page, { webviewId: event.webviewId, ready: state?.ready ?? false, event, committed: false })
  }

  commit(page: HeadlessPageInstance, event: HeadlessWxRouteEvent) {
    const state = this.pages.get(page)
    if (!state || state.event !== event || this.activeEvent !== event || !this.isCurrentPage(page)) {
      return
    }
    state.committed = true
    this.bus.$emit('appRoute', event)
    if (state.ready) {
      this.complete(page, state)
    }
  }

  ready(page: HeadlessPageInstance) {
    const state = this.pages.get(page)
    if (!state) {
      return
    }
    state.ready = true
    if (state.committed) {
      this.complete(page, state)
    }
  }

  private complete(page: HeadlessPageInstance, state: PageRouteState) {
    this.requestRender(() => {
      if (this.pages.get(page) !== state || this.activeEvent !== state.event || !this.isCurrentPage(page)) {
        return
      }
      this.bus.$emit('appRouteDone', state.event)
    })
  }

  beforeUnload(page: HeadlessPageInstance, event?: HeadlessWxRouteEvent) {
    const state = this.pages.get(page)
    if (event && state) {
      this.bus.$emit('beforePageUnload', {
        ...event,
        path: page.route,
        query: { ...page.options },
        renderer: state.event.renderer,
        webviewId: state.webviewId,
        page,
      } satisfies HeadlessWxBeforePageUnloadEvent)
    }
    this.pages.delete(page)
  }

  close() {
    this.activeEvent = undefined
    this.bus.$off()
  }
}
