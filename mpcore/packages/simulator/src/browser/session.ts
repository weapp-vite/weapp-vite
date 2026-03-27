import type { HeadlessAppDefinition, HeadlessHostRegistries } from '../host'
import type { HeadlessProjectDescriptor } from '../project/createProjectDescriptor'
import type { HeadlessRouteRecord } from '../project/resolveRoutes'
import type { HeadlessAppInstance } from '../runtime/appInstance'
import type { HeadlessPageInstance } from '../runtime/pageInstance'
import type { HeadlessWxRequestMockDefinition } from '../runtime/wxState'
import type { BrowserVirtualFiles } from './virtualFiles'
import { join, posix } from 'pathe'
import { createHostRegistries } from '../host'
import { createAppInstance } from '../runtime/appInstance'
import { runComponentPageLifetime } from '../runtime/componentInstance'
import { createPageInstance } from '../runtime/pageInstance'
import {
  applyResizeToSystemInfo,
  createDefaultSystemInfo,
  deriveAppBaseInfo,
  deriveMenuButtonBoundingClientRect,
  deriveWindowInfo,
} from '../runtime/systemInfo'
import { createHeadlessWxState } from '../runtime/wxState'
import { createBrowserModuleLoader } from './moduleLoader'
import { createBrowserProject } from './project'
import { renderBrowserPageTree } from './render'

export interface BrowserHeadlessSessionOptions {
  files: BrowserVirtualFiles
  project?: HeadlessProjectDescriptor
}

interface ResolvedNavigationTarget {
  normalizedRoute: string
  query: Record<string, string>
  routeRecord: HeadlessRouteRecord
}

interface HeadlessAppLaunchOptions {
  path: string
  query: Record<string, string>
  referrerInfo: {
    appId: string
    extraData: Record<string, never>
  }
  scene: number
}

interface HeadlessTabBarItem {
  index: number
  pagePath: string
  text?: string
}

const LEADING_SLASH_RE = /^\/+/
const PAGE_STACK_LIMIT = 10
const DATA_ATTR_SELECTOR_RE = /^\[data-([^=\]]+)="([^"]*)"\]$/
const DATASET_KEY_RE = /-([a-z])/g

function stripLeadingSlash(route: string) {
  return route.replace(LEADING_SLASH_RE, '')
}

function normalizeQuery(queryString: string) {
  const query = new URLSearchParams(queryString)
  const result: Record<string, string> = {}
  for (const [key, value] of query.entries()) {
    result[key] = value
  }
  return result
}

function parseNavigationUrl(url: string) {
  const trimmedUrl = url.trim()
  if (!trimmedUrl) {
    throw new Error('Navigation url must be a non-empty string in browser simulator runtime.')
  }

  const [pathWithHash, queryString = ''] = trimmedUrl.split('?')
  const [pathname] = pathWithHash.split('#')
  return {
    pathname: pathname || '',
    query: normalizeQuery(queryString),
  }
}

function createAppLaunchOptions(pathname: string, query: Record<string, string>): HeadlessAppLaunchOptions {
  return {
    path: stripLeadingSlash(pathname),
    query: { ...query },
    referrerInfo: {
      appId: '',
      extraData: {},
    },
    scene: 1001,
  }
}

function resolveNavigationPath(targetPath: string, baseRoute?: string) {
  if (!targetPath) {
    throw new Error('Navigation url must include a pathname in browser simulator runtime.')
  }

  if (targetPath.startsWith('/')) {
    return posix.normalize(targetPath).replace(LEADING_SLASH_RE, '')
  }

  if (!baseRoute) {
    throw new Error(`Cannot resolve relative navigation url "${targetPath}" without an active page.`)
  }

  const resolved = posix.resolve(`/${posix.dirname(baseRoute)}`, targetPath)
  return resolved.replace(LEADING_SLASH_RE, '')
}

export class BrowserHeadlessSession {
  readonly files: BrowserVirtualFiles
  readonly project: HeadlessProjectDescriptor

  private appDefinition: HeadlessAppDefinition | null = null
  private appInstance: HeadlessAppInstance | null = null
  private readonly moduleLoader
  private readonly registries: HeadlessHostRegistries
  private currentPageInstance: HeadlessPageInstance | null = null
  private readonly pages: HeadlessPageInstance[] = []
  private readonly componentCache = new Map<string, any>()
  private readonly componentScopes = new Map<string, any>()
  private readonly tabBarRoutes: Set<string>
  private readonly tabPages = new Map<string, HeadlessPageInstance>()
  private readonly tabBarItems = new Map<string, HeadlessTabBarItem>()
  private readonly systemInfo = createDefaultSystemInfo()
  private readonly wxState = createHeadlessWxState()

  constructor(options: BrowserHeadlessSessionOptions) {
    this.files = options.files
    this.project = options.project ?? createBrowserProject(options.files)
    this.registries = createHostRegistries()
    const rawTabBarList = Array.isArray(this.project.appConfig.tabBar?.list)
      ? this.project.appConfig.tabBar.list
      : []
    this.tabBarRoutes = new Set()
    rawTabBarList.forEach((item: any, index: number) => {
      if (typeof item?.pagePath !== 'string') {
        return
      }
      const pagePath = stripLeadingSlash(item.pagePath)
      if (!pagePath) {
        return
      }
      this.tabBarRoutes.add(pagePath)
      this.tabBarItems.set(pagePath, {
        index,
        pagePath,
        text: typeof item.text === 'string' ? item.text : undefined,
      })
    })
    this.moduleLoader = createBrowserModuleLoader(
      this.files,
      this.registries,
      () => this.pages.slice(),
      () => this.getApp(),
      {
        getAppBaseInfoSync: () => deriveAppBaseInfo(this.systemInfo),
        getMenuButtonBoundingClientRect: () => deriveMenuButtonBoundingClientRect(this.systemInfo),
        navigateBack: option => this.navigateBack(option?.delta),
        navigateTo: option => this.navigateTo(option.url),
        pageScrollTo: option => this.pageScrollTo(option),
        clearStorageSync: () => this.wxState.clearStorageSync(),
        getStorageInfoSync: () => this.wxState.getStorageInfoSync(),
        getStorageSync: key => this.wxState.getStorageSync(key),
        getSystemInfoSync: () => ({ ...this.systemInfo }),
        getWindowInfoSync: () => deriveWindowInfo(this.systemInfo),
        hideLoading: () => this.wxState.hideLoading(),
        hideToast: () => this.wxState.hideToast(),
        reLaunch: option => this.reLaunch(option.url),
        redirectTo: option => this.redirectTo(option.url),
        nextTick: callback => queueMicrotask(() => callback?.()),
        removeStorageSync: key => this.wxState.removeStorageSync(key),
        request: option => this.wxState.request(option),
        setStorageSync: (key, value) => this.wxState.setStorageSync(key, value),
        showLoading: option => this.wxState.showLoading(option),
        showToast: option => this.wxState.showToast(option),
        stopPullDownRefresh: () => this.stopPullDownRefresh(),
        switchTab: option => this.switchTab(option.url),
      },
    )
  }

  getApp() {
    return this.appInstance
  }

  getCurrentPages() {
    return this.pages.slice()
  }

  getRequestLogs() {
    return this.wxState.getRequestLogs()
  }

  getStorageSnapshot() {
    return this.wxState.getStorageSnapshot()
  }

  getStorageInfo() {
    return this.wxState.getStorageInfoSync()
  }

  getSystemInfo() {
    return { ...this.systemInfo }
  }

  getWindowInfo() {
    return deriveWindowInfo(this.systemInfo)
  }

  getAppBaseInfo() {
    return deriveAppBaseInfo(this.systemInfo)
  }

  getMenuButtonBoundingClientRect() {
    return deriveMenuButtonBoundingClientRect(this.systemInfo)
  }

  getLoading() {
    return this.wxState.getLoading()
  }

  getToast() {
    return this.wxState.getToast()
  }

  mockRequest(definition: HeadlessWxRequestMockDefinition) {
    this.wxState.mockRequest(definition)
  }

  getScopeSnapshot(scopeId: string) {
    const scope = this.componentScopes.get(scopeId)
    if (!scope) {
      return null
    }
    const instance = this.componentCache.get(scopeId)
    if (instance) {
      return {
        data: instance.data ?? {},
        methods: Object.keys(instance)
          .filter(key => typeof instance[key] === 'function')
          .sort((a, b) => a.localeCompare(b)),
        properties: instance.properties ?? {},
        scopeId,
        type: 'component' as const,
      }
    }

    const currentPage = this.currentPageInstance
    if (currentPage && scopeId === `page:${currentPage.route}`) {
      return {
        data: currentPage.data ?? {},
        methods: Object.keys(currentPage)
          .filter(key => typeof currentPage[key] === 'function')
          .sort((a, b) => a.localeCompare(b)),
        properties: currentPage.options ?? {},
        scopeId,
        type: 'page' as const,
      }
    }

    return {
      data: scope.data ?? {},
      methods: [] as string[],
      properties: {},
      scopeId,
      type: 'scope' as const,
    }
  }

  selectComponent(selector: string) {
    return this.selectComponentsWithin(null, selector)[0] ?? null
  }

  selectAllComponents(selector: string) {
    return this.selectComponentsWithin(null, selector)
  }

  selectComponentWithin(scopeId: string, selector: string) {
    return this.selectComponentsWithin(scopeId, selector)[0] ?? null
  }

  selectAllComponentsWithin(scopeId: string, selector: string) {
    return this.selectComponentsWithin(scopeId, selector)
  }

  selectOwnerComponent(scopeId: string) {
    const scope = this.componentScopes.get(scopeId)
    if (!scope?.ownerScopeId) {
      return null
    }
    return this.componentCache.get(scope.ownerScopeId) ?? null
  }

  private selectComponentsWithin(rootScopeId: string | null, selector: string) {
    const normalizedSelector = selector.trim()
    if (!normalizedSelector) {
      return []
    }

    return [...this.componentScopes.entries()]
      .filter(([candidateScopeId, scope]) => {
        if (!candidateScopeId.includes('/')) {
          return false
        }
        if (rootScopeId && candidateScopeId === rootScopeId) {
          return false
        }
        if (rootScopeId && !candidateScopeId.startsWith(`${rootScopeId}/`)) {
          return false
        }
        if (normalizedSelector.startsWith('#')) {
          return scope.id === normalizedSelector.slice(1)
        }
        if (normalizedSelector.startsWith('.')) {
          return scope.classList?.includes(normalizedSelector.slice(1)) ?? false
        }
        const dataAttrMatch = normalizedSelector.match(DATA_ATTR_SELECTOR_RE)
        if (dataAttrMatch) {
          const [, key, value] = dataAttrMatch
          const datasetKey = key.replace(DATASET_KEY_RE, (_match, char: string) => char.toUpperCase())
          return scope.dataset?.[datasetKey] === value
        }
        return scope.alias === normalizedSelector
      })
      .map(([candidateScopeId]) => this.componentCache.get(candidateScopeId))
      .filter(Boolean)
  }

  renderCurrentPage() {
    const current = this.requireCurrentPage('renderCurrentPage()')
    const rendered = renderBrowserPageTree({
      changedPageKeys: current.__lastChangedKeys__ ?? [],
      componentCache: this.componentCache,
      componentScopes: this.componentScopes,
      files: this.files,
      moduleLoader: this.moduleLoader,
      project: this.project,
      session: {
        selectAllComponentsWithin: (scopeId: string, selector: string) => this.selectAllComponentsWithin(scopeId, selector),
        selectComponentWithin: (scopeId: string, selector: string) => this.selectComponentWithin(scopeId, selector),
        selectOwnerComponent: (scopeId: string) => this.selectOwnerComponent(scopeId),
      },
    }, current)
    current.__lastChangedKeys__ = []
    return rendered
  }

  callTapBinding(scopeId: string, methodName: string) {
    const scope = this.componentScopes.get(scopeId)
    if (!scope) {
      throw new Error(`Unknown scope "${scopeId}" in browser simulator runtime.`)
    }
    const method = scope.getMethod(methodName)
    if (typeof method !== 'function') {
      throw new TypeError(`Method "${methodName}" does not exist on scope "${scopeId}" in browser simulator runtime.`)
    }
    return method()
  }

  callTapBindingWithEvent(
    scopeId: string,
    methodName: string,
    event: {
      currentTarget?: {
        dataset?: Record<string, string>
        id?: string
      }
      dataset?: Record<string, string>
      id?: string
      target?: {
        dataset?: Record<string, string>
        id?: string
      }
    } = {},
  ) {
    const scope = this.componentScopes.get(scopeId)
    if (!scope) {
      throw new Error(`Unknown scope "${scopeId}" in browser simulator runtime.`)
    }
    const method = scope.getMethod(methodName)
    if (typeof method !== 'function') {
      throw new TypeError(`Method "${methodName}" does not exist on scope "${scopeId}" in browser simulator runtime.`)
    }
    const instance = this.componentCache.get(scopeId)
    if (instance) {
      instance.__lastInteractionEvent__ = {
        currentTarget: {
          dataset: event.currentTarget?.dataset ?? event.dataset ?? {},
          id: event.currentTarget?.id ?? event.id ?? '',
        },
        target: {
          dataset: event.target?.dataset ?? event.dataset ?? {},
          id: event.target?.id ?? event.id ?? '',
        },
      }
    }
    return method({
      bubbles: false,
      capturePhase: false,
      composed: false,
      currentTarget: {
        dataset: event.currentTarget?.dataset ?? event.dataset ?? {},
        id: event.currentTarget?.id ?? event.id ?? '',
      },
      detail: undefined,
      mark: undefined,
      target: {
        dataset: event.target?.dataset ?? event.dataset ?? {},
        id: event.target?.id ?? event.id ?? '',
      },
      type: 'tap',
    })
  }

  bootstrap(launchOptions = createAppLaunchOptions('', {})) {
    if (this.appInstance) {
      return this.appInstance
    }

    const appModulePath = join(this.project.miniprogramRootPath, 'app.js')
    this.appDefinition = this.moduleLoader.executeAppModule(appModulePath)
    this.appInstance = createAppInstance(this.appDefinition)
    this.appInstance.onLaunch?.(launchOptions)
    this.appInstance.onShow?.(launchOptions)
    return this.appInstance
  }

  reLaunch(url: string) {
    const target = this.resolveNavigationTarget(url)
    this.bootstrap(createAppLaunchOptions(target.normalizedRoute, target.query))
    this.unloadAllPages()
    const pageInstance = this.createFreshPage(target)
    this.pages.push(pageInstance)
    this.currentPageInstance = pageInstance
    return pageInstance
  }

  navigateTo(url: string) {
    const target = this.resolveNavigationTarget(url)
    this.bootstrap(createAppLaunchOptions(target.normalizedRoute, target.query))
    if (this.pages.length >= PAGE_STACK_LIMIT) {
      throw new Error(`Cannot navigateTo() beyond a ${PAGE_STACK_LIMIT}-page stack in browser simulator runtime.`)
    }

    if (this.isTabBarRoute(target.routeRecord.route)) {
      throw new Error(`wx.navigateTo() cannot open a tabBar page in browser simulator runtime: ${url}`)
    }

    this.currentPageInstance?.onHide?.()
    if (this.currentPageInstance) {
      this.runPageComponentLifetime(this.currentPageInstance.route, 'hide')
    }
    const pageInstance = this.createFreshPage(target)
    this.pages.push(pageInstance)
    this.currentPageInstance = pageInstance
    return pageInstance
  }

  redirectTo(url: string) {
    const target = this.resolveNavigationTarget(url)
    this.bootstrap(createAppLaunchOptions(target.normalizedRoute, target.query))
    if (this.isTabBarRoute(target.routeRecord.route)) {
      throw new Error(`wx.redirectTo() cannot open a tabBar page in browser simulator runtime: ${url}`)
    }

    const current = this.currentPageInstance
    if (current) {
      this.pages.pop()
      this.unloadPage(current)
    }

    const pageInstance = this.createFreshPage(target)
    this.pages.push(pageInstance)
    this.currentPageInstance = pageInstance
    return pageInstance
  }

  navigateBack(delta = 1) {
    this.bootstrap()
    if (this.pages.length <= 1) {
      return this.currentPageInstance
    }

    const normalizedDelta = Number.isFinite(delta) ? Math.max(1, Math.trunc(delta)) : 1
    const removableCount = Math.min(normalizedDelta, this.pages.length - 1)
    const removedPages = this.pages.splice(this.pages.length - removableCount, removableCount)
    for (const page of removedPages.reverse()) {
      this.unloadPage(page)
    }

    const nextPage = this.pages.at(-1) ?? null
    this.currentPageInstance = nextPage
    nextPage?.onShow?.()
    if (nextPage) {
      this.runPageComponentLifetime(nextPage.route, 'show')
    }
    return nextPage
  }

  switchTab(url: string) {
    const target = this.resolveNavigationTarget(url)
    this.bootstrap(createAppLaunchOptions(target.normalizedRoute, target.query))
    if (Object.keys(target.query).length > 0) {
      throw new Error(`wx.switchTab() url cannot contain query in browser simulator runtime: ${url}`)
    }
    if (!this.isTabBarRoute(target.routeRecord.route)) {
      throw new Error(`wx.switchTab() can only open a tabBar page in browser simulator runtime: ${url}`)
    }

    const current = this.currentPageInstance
    const cachedTarget = this.tabPages.get(target.routeRecord.route) ?? null
    const tabItem = this.resolveTabBarItem(target.routeRecord.route)

    if (current === cachedTarget && current) {
      current.onTabItemTap?.(tabItem)
      return current
    }

    if (current && current !== cachedTarget) {
      current.onHide?.()
      this.runPageComponentLifetime(current.route, 'hide')
    }

    for (const page of [...this.pages].reverse()) {
      if (this.isTabBarRoute(stripLeadingSlash(page.route))) {
        continue
      }
      this.removePageInstance(page)
      this.unloadPage(page)
    }

    let nextPage = cachedTarget
    if (!nextPage) {
      nextPage = this.createFreshPage(target)
      this.tabPages.set(target.routeRecord.route, nextPage)
    }
    else if (current !== nextPage) {
      nextPage.onShow?.()
      this.runPageComponentLifetime(nextPage.route, 'show')
    }

    nextPage.onTabItemTap?.(tabItem)

    this.pages.length = 0
    this.pages.push(nextPage)
    this.currentPageInstance = nextPage
    return nextPage
  }

  pageScrollTo(option: {
    scrollTop?: number
  }) {
    const current = this.requireCurrentPage('wx.pageScrollTo()')
    current.onPageScroll?.({
      scrollTop: Number(option.scrollTop ?? 0),
    })
  }

  triggerPullDownRefresh() {
    const current = this.requireCurrentPage('triggerPullDownRefresh()')
    current.onPullDownRefresh?.()
    return current
  }

  triggerReachBottom() {
    const current = this.requireCurrentPage('triggerReachBottom()')
    current.onReachBottom?.()
    return current
  }

  triggerResize(options: Record<string, any>) {
    const current = this.requireCurrentPage('triggerResize()')
    applyResizeToSystemInfo(this.systemInfo, options)
    current.onResize?.(options)
    this.runPageComponentLifetime(current.route, 'resize', options)
    return current
  }

  triggerRouteDone(options: Record<string, any> = {}) {
    const current = this.requireCurrentPage('triggerRouteDone()')
    current.onRouteDone?.(options)
    return current
  }

  stopPullDownRefresh() {

  }

  private createFreshPage(target: ResolvedNavigationTarget) {
    const pageModulePath = join(this.project.miniprogramRootPath, `${target.routeRecord.route}.js`)
    const pageDefinition = this.moduleLoader.executePageModule(pageModulePath, target.routeRecord.route)
    const pageInstance = createPageInstance(target.routeRecord.route, pageDefinition, target.query)
    pageInstance.selectComponent = (selector: string) => this.selectComponent(selector)
    pageInstance.selectAllComponents = (selector: string) => this.selectAllComponents(selector)
    pageInstance.onLoad?.(target.query)
    pageInstance.onShow?.()
    pageInstance.onReady?.()
    if (this.isTabBarRoute(target.routeRecord.route)) {
      this.tabPages.set(target.routeRecord.route, pageInstance)
    }
    return pageInstance
  }

  private isTabBarRoute(route: string) {
    return this.tabBarRoutes.has(stripLeadingSlash(route))
  }

  private removePageInstance(page: HeadlessPageInstance) {
    const index = this.pages.indexOf(page)
    if (index >= 0) {
      this.pages.splice(index, 1)
    }
  }

  private resolveNavigationTarget(url: string) {
    const { pathname, query } = parseNavigationUrl(url)
    const baseRoute = this.currentPageInstance
      ? stripLeadingSlash(this.currentPageInstance.route)
      : undefined
    const normalizedRoute = resolveNavigationPath(pathname, baseRoute)
    const routeRecord = this.project.routes.find(item => item.route === normalizedRoute)
    if (!routeRecord) {
      this.bootstrap(createAppLaunchOptions(normalizedRoute, query))
      this.appInstance?.onPageNotFound?.(createAppLaunchOptions(normalizedRoute, query))
      throw new Error(`Unknown route for browser simulator navigation: ${url}`)
    }
    return {
      normalizedRoute,
      query,
      routeRecord,
    }
  }

  private resolveTabBarItem(route: string) {
    const pagePath = stripLeadingSlash(route)
    const item = this.tabBarItems.get(pagePath)
    if (!item) {
      throw new Error(`Missing tabBar metadata for route "${route}" in browser simulator runtime.`)
    }
    return {
      ...item,
    }
  }

  private unloadAllPages() {
    const pagesToUnload = new Set<HeadlessPageInstance>([
      ...this.pages,
      ...this.tabPages.values(),
    ])
    for (const page of [...pagesToUnload].reverse()) {
      this.unloadPage(page)
    }
    this.pages.length = 0
    this.tabPages.clear()
    this.componentCache.clear()
    this.componentScopes.clear()
    this.currentPageInstance = null
  }

  private unloadPage(page: HeadlessPageInstance) {
    page.onUnload?.()
    this.detachPageComponents(page.route)
    this.tabPages.delete(stripLeadingSlash(page.route))
  }

  private requireCurrentPage(action: string) {
    this.bootstrap()
    const current = this.currentPageInstance
    if (!current) {
      throw new Error(`Cannot call ${action} without an active page in browser simulator runtime.`)
    }
    return current
  }

  private detachPageComponents(route: string) {
    const prefix = `page:${stripLeadingSlash(route)}`
    for (const [scopeId, instance] of [...this.componentCache.entries()]) {
      if (!scopeId.startsWith(prefix)) {
        continue
      }
      instance.__definition__?.lifetimes?.detached?.call(instance)
      this.componentCache.delete(scopeId)
      this.componentScopes.delete(scopeId)
    }
  }

  private runPageComponentLifetime(
    route: string,
    lifetimeName: 'hide' | 'resize' | 'show',
    payload?: unknown,
  ) {
    const prefix = `page:${stripLeadingSlash(route)}`
    for (const [scopeId, instance] of this.componentCache.entries()) {
      if (!scopeId.startsWith(prefix)) {
        continue
      }
      runComponentPageLifetime(instance, lifetimeName, payload)
    }
  }
}

export function createBrowserHeadlessSession(options: BrowserHeadlessSessionOptions) {
  return new BrowserHeadlessSession(options)
}
