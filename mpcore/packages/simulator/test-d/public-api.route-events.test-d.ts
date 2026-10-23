import type {
  BrowserHeadlessSession,
  HeadlessPageInstance,
  HeadlessSession,
  HeadlessWx,
  HeadlessWxBeforePageUnloadEvent,
  HeadlessWxDriver,
  HeadlessWxRouteDoneEvent,
  HeadlessWxRouteEvent,
} from '..'
import { WEVU_PAGE_SCROLL_EVENT_CONTRACT_KEY, WEVU_ROUTE_EVENT_CONTRACT_KEY } from '@weapp-core/constants'
import { expectError, expectType } from 'tsd'

declare const wx: HeadlessWx
declare const driver: HeadlessWxDriver
declare const nodeSession: HeadlessSession
declare const browserSession: BrowserHeadlessSession

function routeListener(event: HeadlessWxRouteEvent) {
  expectType<string>(event.path)
  expectType<Record<string, string>>(event.query)
  expectType<string>(event.routeEventId)
  expectType<number>(event.webviewId)
  expectType<number>(event.timeStamp)
  expectType<'webview' | 'skyline' | 'xr-frame'>(event.renderer)
  expectType<'appLaunch' | 'navigateTo' | 'redirectTo' | 'navigateBack' | 'switchTab' | 'reLaunch'>(event.openType)
}
function unloadListener(event: HeadlessWxBeforePageUnloadEvent) {
  expectType<HeadlessPageInstance>(event.page)
  expectType<string>(event.routeEventId)
}

function doneListener(event: HeadlessWxRouteDoneEvent) {
  expectType<string>(event.path)
  expectType<Record<string, string>>(event.query)
  expectType<string>(event.routeEventId)
  expectType<number>(event.webviewId)
  expectType<number>(event.timeStamp)
  expectType<HeadlessWxRouteEvent['openType']>(event.openType)
  expectError(event.renderer)
}

expectType<1>(wx[WEVU_ROUTE_EVENT_CONTRACT_KEY])
expectType<1>(wx[WEVU_PAGE_SCROLL_EVENT_CONTRACT_KEY])
expectType<void>(wx.onBeforeAppRoute(routeListener))
expectType<void>(wx.offBeforeAppRoute(routeListener))
expectType<void>(wx.offBeforeAppRoute())
expectType<void>(wx.onBeforePageUnload(unloadListener))
expectType<void>(wx.offBeforePageUnload(unloadListener))
expectType<void>(wx.offBeforePageUnload())
expectType<void>(wx.onAppRoute(routeListener))
expectType<void>(wx.offAppRoute(routeListener))
expectType<void>(wx.offAppRoute())
expectType<void>(wx.onAppRouteDone(doneListener))
expectType<void>(wx.offAppRouteDone(doneListener))
expectType<void>(wx.offAppRouteDone())
expectType<void>(driver.onBeforeAppRoute(routeListener))
expectType<void>(driver.onBeforePageUnload(unloadListener))
expectType<void>(driver.onAppRoute(routeListener))
expectType<void>(driver.onAppRouteDone(doneListener))
expectType<void>(nodeSession.getWx().onAppRouteDone(doneListener))
expectError(wx.onAppRouteDone(routeListener))
expectError(wx.offAppRouteDone(routeListener))
expectType<boolean>(nodeSession.dispatchNativeNodeEvent({ name: 'scroll-view', attribs: { id: 'primary' } }, 'scroll', { detail: { scrollTop: 20 } }))
expectType<boolean>(browserSession.dispatchNativeNodeEvent({ name: 'navigator', attribs: { url: '/pages/detail/index' } }, 'tap', {}, (result) => {
  expectType<unknown>(result)
}))
expectError(wx.onAppRouteDone((event: { routeEventId: number }) => event.routeEventId))
expectError(wx.onBeforePageUnload((event: { page: string }) => event.page))
expectError(wx.offBeforeAppRoute('listener'))
expectError(wx.onAppRoute())
