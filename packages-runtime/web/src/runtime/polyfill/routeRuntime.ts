import type { ButtonFormConfig } from '../button'
import type { ComponentPublicInstance } from '../component'
import type { NavigationBarMetrics } from '../navigationBar'
import type { WebViewportConfig } from '../viewport'
import type { AppLaunchOptions, AppRuntime, ComponentRawOptions, ComponentRecord, NavigateBackOptions, PageRawOptions, PageRecord, PageStackEntry, RegisterMeta, RouteOptions } from './routeRuntime/options'
import { slugify } from '../../shared/slugify'
import { setButtonFormConfig } from '../button'
import { defineComponent } from '../component'
import { setRuntimeExecutionMode } from '../execution'
import { ensureNativeComponentsDefined } from '../nativeComponents'
import { ensureNavigationBarDefined, setNavigationBarMetrics } from '../navigationBar'
import { setupRpx } from '../rpx'
import { setupWebViewport } from '../viewport'
import { setRuntimeWarningOptions } from '../warning'
import {
  cloneLaunchOptions,
  resolveCurrentPages,
  resolveFallbackLaunchOptions,
} from './appState'
import {
  augmentPageComponentOptions,
  dispatchPageLifetimeToComponents,
} from './routeRuntime/lifecycle'
import {
  isRecord,
  normalizeComponentOptions,
  normalizePageOptions,
} from './routeRuntime/options'
import { resolveRouteAction } from './routeRuntime/result'
import { PageStackRuntime } from './routeRuntime/stack'
import { parsePageUrl } from './routeRuntime/url'

const pageRegistry = new Map<string, PageRecord>()
const componentRegistry = new Map<string, ComponentRecord>()
let pageOrder: string[] = []
let appInstance: AppRuntime | undefined
let appLaunched = false
let lastLaunchOptions: AppLaunchOptions | undefined
let pageResizeBridgeBound = false

function ensureAppLaunched(entry: PageStackEntry) {
  if (!appInstance || appLaunched) {
    return
  }
  const launchOptions: AppLaunchOptions = {
    path: entry.id,
    scene: 0,
    query: entry.query,
    referrerInfo: {},
  }
  lastLaunchOptions = {
    path: launchOptions.path,
    scene: launchOptions.scene,
    query: { ...launchOptions.query },
    referrerInfo: { ...launchOptions.referrerInfo },
  }
  if (typeof appInstance.onLaunch === 'function') {
    appInstance.onLaunch(launchOptions)
  }
  if (typeof appInstance.onShow === 'function') {
    appInstance.onShow(launchOptions)
  }
  appLaunched = true
}

const pageStack = new PageStackRuntime(pageRegistry, ensureAppLaunched)

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
    runtime?: {
      executionMode?: 'compat' | 'safe' | 'strict'
      warnings?: {
        level?: 'off' | 'warn' | 'error'
        dedupe?: boolean
      }
      viewport?: WebViewportConfig
    }
  },
) {
  setRuntimeExecutionMode(options?.runtime?.executionMode)
  setRuntimeWarningOptions(options?.runtime?.warnings)
  setupWebViewport(options?.runtime?.viewport)
  ensureNativeComponentsDefined()
  pageOrder = Array.from(new Set(ids))
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
    pageStack.push(pageOrder[0], {})
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
    const component = augmentPageComponentOptions(normalized.component, existing)
    defineComponent(tag, {
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
  }
  const component = augmentPageComponentOptions(normalized.component, record)
  defineComponent(tag, {
    template,
    style: meta.style,
    component,
  })
  pageRegistry.set(meta.id, record)
  return options
}

export function registerComponent<T extends ComponentRawOptions | undefined>(options: T, meta: RegisterMeta): T {
  ensureNativeComponentsDefined()
  const tag = slugify(meta.id, 'wv-component')
  const template = meta.template ?? (() => '')
  const component = normalizeComponentOptions(options)
  if (componentRegistry.has(meta.id)) {
    defineComponent(tag, {
      template,
      style: meta.style,
      component,
    })
    return options
  }
  defineComponent(tag, {
    template,
    style: meta.style,
    component,
  })
  componentRegistry.set(meta.id, { tag })
  return options
}

export function registerApp<T extends AppRuntime | undefined>(options: T, _meta?: RegisterMeta): T {
  const resolved = (options ?? {}) as AppRuntime
  if (appInstance) {
    const currentGlobal = appInstance.globalData
    Object.assign(appInstance, resolved)
    if (isRecord(currentGlobal)) {
      appInstance.globalData = currentGlobal
    }
    else if (!isRecord(appInstance.globalData)) {
      appInstance.globalData = {}
    }
    return options
  }
  appInstance = resolved
  appLaunched = false
  lastLaunchOptions = undefined
  if (!isRecord(appInstance.globalData)) {
    appInstance.globalData = {}
  }
  return options
}

export function navigateTo(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  return resolveRouteAction('navigateTo', options, pageStack.push(id, query))
}

export function redirectTo(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  return resolveRouteAction('redirectTo', options, pageStack.replace(id, query))
}

export function reLaunch(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  return resolveRouteAction('reLaunch', options, pageStack.relaunch(id, query))
}

export function switchTab(options: RouteOptions) {
  const { id, query } = parsePageUrl(options?.url ?? '')
  return resolveRouteAction('switchTab', options, pageStack.replace(id, query))
}

export function navigateBack(options?: NavigateBackOptions) {
  return resolveRouteAction('navigateBack', options, pageStack.back(options?.delta))
}

export function getCurrentPagesInternal() {
  return resolveCurrentPages<ComponentPublicInstance>(pageStack.entries)
}

export function getAppInstance() {
  return appInstance
}

export function getLaunchOptionsSync(): AppLaunchOptions {
  if (lastLaunchOptions) {
    return cloneLaunchOptions(lastLaunchOptions)
  }
  return resolveFallbackLaunchOptions(pageStack.entries)
}

export function getEnterOptionsSync(): AppLaunchOptions {
  return getLaunchOptionsSync()
}
