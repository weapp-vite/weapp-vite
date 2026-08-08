import type { WebTabBarConfig } from '../../shared/tabBar'
import type { ButtonFormConfig } from '../button'
import type { ComponentPublicInstance } from '../component'
import type { NavigationBarMetrics } from '../navigationBar'
import type { WebResourceHintsConfig, WebSeoConfig } from '../seo'
import type { WebViewportConfig } from '../viewport'
import type { WebRouteHistoryState, WebRouteTarget, WebRoutingConfig } from './routeRuntime/history'
import type { AppRuntime, ComponentRawOptions, ComponentRecord, NavigateBackOptions, PageRawOptions, PageRecord, RegisterMeta, RouteOptions } from './routeRuntime/options'
import { slugify } from '../../shared/slugify'
import {
  configureTabBar,
  getTabBarPagePaths,
  syncTabBarRoute,
} from '../appShell/tabBar'
import { setButtonFormConfig } from '../button'
import { defineComponent } from '../component'
import { setRuntimeExecutionMode } from '../execution'
import { ensureNativeComponentsDefined } from '../nativeComponents'
import { ensureNavigationBarDefined, setNavigationBarMetrics } from '../navigationBar'
import { setupRpx } from '../rpx'
import { configureWebSeo, setupWebResourceHints, syncWebDocumentHead } from '../seo'
import { setupWebViewport } from '../viewport'
import { setRuntimeWarningOptions } from '../warning'
import { resolveCurrentPages } from './appState'
import { AppLifecycleRuntime } from './routeRuntime/appLifecycle'
import {
  configureWebRouting,
  getWebHistoryStack,
  readWebRouteTarget,
  syncWebRouting,
} from './routeRuntime/history'
import {
  augmentPageComponentOptions,
  dispatchPageLifetimeToComponents,
} from './routeRuntime/lifecycle'
import {
  normalizeComponentOptions,
  normalizePageOptions,
} from './routeRuntime/options'
import { resolveRouteAction } from './routeRuntime/result'
import { PageStackRuntime } from './routeRuntime/stack'
import { parsePageUrl } from './routeRuntime/url'

const pageRegistry = new Map<string, PageRecord>()
const componentRegistry = new Map<string, ComponentRecord>()
let pageOrder: string[] = []
let pageResizeBridgeBound = false

let pageStack: PageStackRuntime
const appLifecycle = new AppLifecycleRuntime(
  () => pageStack?.entries[pageStack.entries.length - 1],
)
pageStack = new PageStackRuntime(pageRegistry, entry => appLifecycle.ensureLaunched(entry))

function syncCurrentWebDocument() {
  const current = pageStack.entries[pageStack.entries.length - 1]
  syncWebDocumentHead({
    route: current?.id,
    title: current ? pageRegistry.get(current.id)?.navigationBar?.title : undefined,
  })
}

function syncCurrentWebRoute(operation: 'push' | 'replace') {
  syncWebRouting(pageStack.entries, operation)
  syncCurrentWebDocument()
}

function reconcileWebRoute(target: WebRouteTarget | undefined, state: WebRouteHistoryState | undefined) {
  const currentIds = pageStack.entries.map(entry => entry.id)
  const historyStack = getWebHistoryStack(state)
  if (historyStack?.length) {
    const desiredIds = historyStack.map(entry => entry.id)
    const sharedLength = Math.min(desiredIds.length, currentIds.length)
    const samePrefix = desiredIds
      .slice(0, sharedLength)
      .every((id, index) => currentIds[index] === id)
    if (samePrefix && desiredIds.length < currentIds.length) {
      pageStack.back(currentIds.length - desiredIds.length)
    }
    else if (samePrefix && desiredIds.length > currentIds.length) {
      for (const entry of historyStack.slice(currentIds.length)) {
        pageStack.push(entry.id, { ...entry.query })
      }
    }
    else {
      const last = historyStack[historyStack.length - 1]!
      pageStack.relaunch(last.id, { ...last.query })
    }
    syncTabBarRoute(pageStack.entries[pageStack.entries.length - 1]?.id ?? '')
    syncCurrentWebDocument()
    return
  }
  if (target && pageRegistry.has(target.id)) {
    pageStack.relaunch(target.id, { ...target.query })
    syncTabBarRoute(target.id)
    syncCurrentWebDocument()
  }
}

function performSwitchTab(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  const succeeded = pageStack.switchTab(id, query)
  if (succeeded) {
    syncTabBarRoute(id)
    syncCurrentWebRoute('push')
  }
  return resolveRouteAction('switchTab', options, succeeded, 'not a tabBar page')
}

function bindPageResizeBridge() {
  if (pageResizeBridgeBound || typeof window === 'undefined') {
    return
  }
  if (typeof window.addEventListener !== 'function') {
    return
  }
  pageResizeBridgeBound = true
  window.addEventListener('resize', () => {
    const pages = resolveCurrentPages<ComponentPublicInstance>(pageStack.entries)
    const current = pages[pages.length - 1]
    if (!current) {
      return
    }
    dispatchPageLifetimeToComponents(current, 'resize')
  })
}

export function initializePageRoutes(
  ids: string[],
  options?: {
    rpx?: { designWidth?: number, varName?: string }
    navigationBar?: NavigationBarMetrics
    form?: ButtonFormConfig
    tabBar?: WebTabBarConfig
    runtime?: {
      executionMode?: 'compat' | 'safe' | 'strict'
      warnings?: {
        level?: 'off' | 'warn' | 'error'
        dedupe?: boolean
      }
      viewport?: WebViewportConfig
      routing?: WebRoutingConfig
      seo?: WebSeoConfig
      resourceHints?: WebResourceHintsConfig
    }
  },
) {
  setRuntimeExecutionMode(options?.runtime?.executionMode)
  setRuntimeWarningOptions(options?.runtime?.warnings)
  setupWebViewport(options?.runtime?.viewport)
  configureWebSeo(options?.runtime?.seo)
  setupWebResourceHints(options?.runtime?.resourceHints)
  configureWebRouting(options?.runtime?.routing, ids, reconcileWebRoute)
  appLifecycle.bindVisibility()
  ensureNativeComponentsDefined()
  pageOrder = Array.from(new Set(ids))
  configureTabBar(options?.tabBar, url => performSwitchTab({ url }))
  pageStack.configureTabPages(getTabBarPagePaths())
  if (!pageOrder.length) {
    return
  }
  bindPageResizeBridge()
  if (options?.rpx) {
    setupRpx(options.rpx)
  }
  if (options?.navigationBar) {
    setNavigationBarMetrics(options.navigationBar)
  }
  if (options?.form) {
    setButtonFormConfig(options.form)
  }
  if (!pageStack.entries.length) {
    const initialTarget = readWebRouteTarget(pageOrder)
    const initialId = initialTarget?.id ?? pageOrder[0]
    const initialQuery = initialTarget?.query ?? {}
    if (pageStack.push(initialId, initialQuery)) {
      syncTabBarRoute(initialId)
      syncCurrentWebRoute('replace')
    }
  }
}

export function registerPage<T extends PageRawOptions | undefined>(options: T, meta: RegisterMeta): T {
  ensureNativeComponentsDefined()
  ensureNavigationBarDefined()
  const tag = slugify(meta.id, 'wv-page')
  const template = meta.template ?? (() => '')
  const normalized = normalizePageOptions(options)
  const existing = pageRegistry.get(meta.id)
  if (existing) {
    existing.hooks = normalized.hooks
    existing.navigationBar = meta.navigationBar
    const component = augmentPageComponentOptions(normalized.component, existing)
    defineComponent(tag, {
      id: meta.id,
      template,
      style: meta.style,
      component,
    })
    return options
  }
  const record: PageRecord = {
    tag,
    hooks: normalized.hooks,
    instances: new Set(),
    navigationBar: meta.navigationBar,
  }
  const component = augmentPageComponentOptions(normalized.component, record)
  defineComponent(tag, {
    id: meta.id,
    template,
    style: meta.style,
    component,
  })
  pageRegistry.set(meta.id, record)
  return options
}

export function getCurrentPageInstance(): ComponentPublicInstance | undefined {
  return pageStack.entries[pageStack.entries.length - 1]?.instance
}

export function registerComponent<T extends ComponentRawOptions | undefined>(options: T, meta: RegisterMeta): T {
  ensureNativeComponentsDefined()
  const tag = slugify(meta.id, 'wv-component')
  const template = meta.template ?? (() => '')
  const component = normalizeComponentOptions(options)
  if (componentRegistry.has(meta.id)) {
    defineComponent(tag, {
      id: meta.id,
      template,
      style: meta.style,
      component,
    })
    return options
  }
  defineComponent(tag, {
    id: meta.id,
    template,
    style: meta.style,
    component,
  })
  componentRegistry.set(meta.id, { tag })
  return options
}

export function registerApp<T extends AppRuntime | undefined>(options: T, _meta?: RegisterMeta): T {
  return appLifecycle.register(options)
}

export function navigateTo(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  const succeeded = pageStack.push(id, query)
  if (succeeded) {
    syncTabBarRoute(id)
    syncCurrentWebRoute('push')
  }
  return resolveRouteAction('navigateTo', options, succeeded)
}

export function redirectTo(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  const succeeded = pageStack.replace(id, query)
  if (succeeded) {
    syncTabBarRoute(id)
    syncCurrentWebRoute('replace')
  }
  return resolveRouteAction('redirectTo', options, succeeded)
}

export function reLaunch(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  const succeeded = pageStack.relaunch(id, query)
  if (succeeded) {
    syncTabBarRoute(id)
    syncCurrentWebRoute('replace')
  }
  return resolveRouteAction('reLaunch', options, succeeded)
}

export function switchTab(options: RouteOptions) {
  return performSwitchTab(options)
}

export function navigateBack(options?: NavigateBackOptions) {
  const succeeded = pageStack.back(options?.delta)
  if (succeeded) {
    syncTabBarRoute(pageStack.entries[pageStack.entries.length - 1]?.id ?? '')
    syncCurrentWebRoute('replace')
  }
  return resolveRouteAction('navigateBack', options, succeeded)
}

export function getCurrentPagesInternal() {
  return resolveCurrentPages<ComponentPublicInstance>(pageStack.entries)
}

export function getAppInstance() {
  return appLifecycle.instance
}

export function getLaunchOptionsSync() {
  return appLifecycle.getLaunchOptions()
}

export function getEnterOptionsSync() {
  return appLifecycle.getEnterOptions()
}
