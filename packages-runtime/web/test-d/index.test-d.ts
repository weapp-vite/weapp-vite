import type {
  AppHideCallback,
  AppHideOptions,
  AppLaunchOptions,
  AppRouteCallback,
  AppRouteEvent,
  AppRouteOpenType,
  AppShowCallback,
  BeforePageUnloadCallback,
  BeforePageUnloadEvent,
} from '@weapp-vite/web'
import type { Plugin } from 'vite'
import {
  defineComponent,
  offAppHide,
  offAppRoute,
  offAppRouteDone,
  offAppShow,
  offBeforeAppRoute,
  offBeforePageUnload,
  onAppHide,
  onAppRoute,
  onAppRouteDone,
  onAppShow,
  onBeforeAppRoute,
  onBeforePageUnload,
} from '@weapp-vite/web'
import { weappWebPlugin } from '@weapp-vite/web/plugin'
import { expectAssignable, expectError, expectType } from 'tsd'

const showCallback: AppShowCallback = (options) => {
  expectType<AppLaunchOptions>(options)
}
const hideCallback: AppHideCallback = (options) => {
  expectType<AppHideOptions>(options)
  expectType<0 | 1 | 2 | 3>(options.reason)
}

expectType<void>(onAppShow(showCallback))
expectType<void>(offAppShow(showCallback))
expectType<void>(offAppShow())
expectType<void>(onAppHide(hideCallback))
expectType<void>(offAppHide(hideCallback))
expectType<void>(offAppHide())
expectError(onAppShow())
expectError(onAppHide())

const routeCallback: AppRouteCallback = (event) => {
  expectType<AppRouteEvent>(event)
  expectType<string>(event.routeEventId)
  expectType<number>(event.webviewId)
  expectType<Record<string, string>>(event.query)
  expectType<AppRouteOpenType>(event.openType)
  expectType<'webview'>(event.renderer)
}
const unloadCallback: BeforePageUnloadCallback = (event) => {
  expectType<BeforePageUnloadEvent>(event)
  expectType<boolean>(event.page.isConnected)
}
expectType<void>(onBeforeAppRoute(routeCallback))
expectType<void>(offBeforeAppRoute(routeCallback))
expectType<void>(offBeforeAppRoute())
expectType<void>(onAppRoute(routeCallback))
expectType<void>(offAppRoute(routeCallback))
expectType<void>(offAppRoute())
expectType<void>(onAppRouteDone(routeCallback))
expectType<void>(offAppRouteDone(routeCallback))
expectType<void>(offAppRouteDone())
expectType<void>(onBeforePageUnload(unloadCallback))
expectType<void>(offBeforePageUnload(unloadCallback))
expectType<void>(offBeforePageUnload())
expectError(onBeforeAppRoute())
expectError(onAppRoute())
expectError(onAppRouteDone())
expectError(onBeforePageUnload())

expectAssignable<CustomElementConstructor>(defineComponent('typed-page', {
  kind: 'page',
  template: () => '',
}))
expectAssignable<CustomElementConstructor>(defineComponent('typed-component', {
  kind: 'component',
  template: () => '',
  component: { options: { styleIsolation: 'isolated', addGlobalClass: true } },
}))
expectError(defineComponent('typed-app', { kind: 'app', template: () => '' }))
expectAssignable<Plugin>(weappWebPlugin())
