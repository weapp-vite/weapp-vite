import type { HeadlessAppDefinition, HeadlessHostRegistries, HeadlessWxLaunchOptions, HeadlessWxNetworkType } from '../host'
import type { HeadlessProjectDescriptor, HeadlessRouteRecord } from '../project'
import type { HeadlessAppInstance } from './appInstance'
import type { HeadlessPageInstance } from './pageInstance'
import type { HeadlessWxActionSheetMockDefinition, HeadlessWxModalMockDefinition, HeadlessWxRequestMockDefinition } from './wxState'
import fs from 'node:fs'
import path from 'node:path'
import { createHostRegistries } from '../host'
import { loadProject } from '../project'
import { resolveNavigationBarTitle } from '../project/pageConfig'
import { createAppInstance } from './appInstance'
import { createModuleLoader } from './moduleLoader'
import { createPageInstance } from './pageInstance'
import {
  applyResizeToSystemInfo,
  createDefaultSystemInfo,
  deriveAppBaseInfo,
  deriveMenuButtonBoundingClientRect,
  deriveWindowInfo,
} from './systemInfo'
import { createHeadlessWxState } from './wxState'

export interface HeadlessSessionOptions {
  projectPath: string
}

interface ResolvedNavigationTarget {
  normalizedRoute: string
  query: Record<string, string>
  routeRecord: HeadlessRouteRecord
}

interface HeadlessTabBarItem {
  index: number
  pagePath: string
  text?: string
}

const LEADING_SLASH_RE = /^\/+/
const PAGE_STACK_LIMIT = 10

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
    throw new Error('Navigation url must be a non-empty string in headless runtime.')
  }

  const [pathWithHash, queryString = ''] = trimmedUrl.split('?')
  const [pathname] = pathWithHash.split('#')
  return {
    pathname: pathname || '',
    query: normalizeQuery(queryString),
  }
}

function createAppLaunchOptions(pathname: string, query: Record<string, string>): HeadlessWxLaunchOptions {
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

function readJsonObject(filePath: string) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : undefined
  }
  catch {
    return undefined
  }
}

function resolveNavigationPath(targetPath: string, baseRoute?: string) {
  if (!targetPath) {
    throw new Error('Navigation url must include a pathname in headless runtime.')
  }

  if (targetPath.startsWith('/')) {
    return path.posix.normalize(targetPath).replace(LEADING_SLASH_RE, '')
  }

  if (!baseRoute) {
    throw new Error(`Cannot resolve relative navigation url "${targetPath}" without an active page.`)
  }

  const resolved = path.posix.resolve(`/${path.posix.dirname(baseRoute)}`, targetPath)
  return resolved.replace(LEADING_SLASH_RE, '')
}

export class HeadlessSession {
  readonly project: HeadlessProjectDescriptor

  private appDefinition: HeadlessAppDefinition | null = null
  private appInstance: HeadlessAppInstance | null = null
  private readonly moduleLoader
  private readonly registries: HeadlessHostRegistries
  private currentPageInstance: HeadlessPageInstance | null = null
  private readonly pages: HeadlessPageInstance[] = []
  private readonly tabBarRoutes: Set<string>
  private readonly tabPages = new Map<string, HeadlessPageInstance>()
  private readonly tabBarItems = new Map<string, HeadlessTabBarItem>()
  private readonly systemInfo = createDefaultSystemInfo()
  private enterOptions = createAppLaunchOptions('', {})
  private launchOptions = createAppLaunchOptions('', {})
  private readonly wxState = createHeadlessWxState()

  constructor(options: HeadlessSessionOptions) {
    this.project = loadProject(options.projectPath)
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
    this.moduleLoader = createModuleLoader(
      this.registries,
      () => this.pages.slice(),
      () => this.getApp(),
      {
        getEnterOptionsSync: () => ({ ...this.enterOptions, query: { ...this.enterOptions.query }, referrerInfo: { ...this.enterOptions.referrerInfo, extraData: { ...this.enterOptions.referrerInfo.extraData } } }),
        getAppBaseInfoSync: () => deriveAppBaseInfo(this.systemInfo),
        getLaunchOptionsSync: () => ({ ...this.launchOptions, query: { ...this.launchOptions.query }, referrerInfo: { ...this.launchOptions.referrerInfo, extraData: { ...this.launchOptions.referrerInfo.extraData } } }),
        getMenuButtonBoundingClientRect: () => deriveMenuButtonBoundingClientRect(this.systemInfo),
        getNetworkType: () => this.wxState.getNetworkType(),
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
        offNetworkStatusChange: callback => this.wxState.offNetworkStatusChange(callback),
        onNetworkStatusChange: callback => this.wxState.onNetworkStatusChange(callback),
        removeStorageSync: key => this.wxState.removeStorageSync(key),
        request: option => this.wxState.request(option),
        setStorageSync: (key, value) => this.wxState.setStorageSync(key, value),
        setNavigationBarTitle: option => this.setNavigationBarTitle(option.title),
        showActionSheet: option => this.wxState.showActionSheet(option),
        showLoading: option => this.wxState.showLoading(option),
        showModal: option => this.wxState.showModal(option),
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

  getCurrentPageNavigationBarTitle() {
    return this.currentPageInstance?.__navigationBarTitle__ ?? null
  }

  getActionSheetLogs() {
    return this.wxState.getActionSheetLogs()
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

  getLaunchOptions() {
    return {
      ...this.launchOptions,
      query: { ...this.launchOptions.query },
      referrerInfo: {
        ...this.launchOptions.referrerInfo,
        extraData: { ...this.launchOptions.referrerInfo.extraData },
      },
    }
  }

  getEnterOptions() {
    return {
      ...this.enterOptions,
      query: { ...this.enterOptions.query },
      referrerInfo: {
        ...this.enterOptions.referrerInfo,
        extraData: { ...this.enterOptions.referrerInfo.extraData },
      },
    }
  }

  getMenuButtonBoundingClientRect() {
    return deriveMenuButtonBoundingClientRect(this.systemInfo)
  }

  getNetworkType() {
    return this.wxState.getNetworkType()
  }

  getLoading() {
    return this.wxState.getLoading()
  }

  getModalLogs() {
    return this.wxState.getModalLogs()
  }

  getToast() {
    return this.wxState.getToast()
  }

  mockModal(definition: HeadlessWxModalMockDefinition = {}) {
    this.wxState.mockModal(definition)
  }

  mockActionSheet(definition: HeadlessWxActionSheetMockDefinition = {}) {
    this.wxState.mockActionSheet(definition)
  }

  mockRequest(definition: HeadlessWxRequestMockDefinition) {
    this.wxState.mockRequest(definition)
  }

  setNetworkType(networkType: HeadlessWxNetworkType) {
    return this.wxState.setNetworkType(networkType)
  }

  setNavigationBarTitle(title: string) {
    const current = this.requireCurrentPage('wx.setNavigationBarTitle()')
    current.__navigationBarTitle__ = title
    return {
      errMsg: 'setNavigationBarTitle:ok',
    }
  }

  bootstrap(launchOptions = createAppLaunchOptions('', {})) {
    if (this.appInstance) {
      return this.appInstance
    }

    this.launchOptions = createAppLaunchOptions(launchOptions.path, launchOptions.query)
    this.enterOptions = createAppLaunchOptions(launchOptions.path, launchOptions.query)
    const appModulePath = path.resolve(this.project.miniprogramRootPath, 'app.js')
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
      throw new Error(`Cannot navigateTo() beyond a ${PAGE_STACK_LIMIT}-page stack in headless runtime.`)
    }

    if (this.isTabBarRoute(target.routeRecord.route)) {
      throw new Error(`wx.navigateTo() cannot open a tabBar page in headless runtime: ${url}`)
    }

    this.currentPageInstance?.onHide?.()
    const pageInstance = this.createFreshPage(target)
    this.pages.push(pageInstance)
    this.currentPageInstance = pageInstance
    return pageInstance
  }

  redirectTo(url: string) {
    const target = this.resolveNavigationTarget(url)
    this.bootstrap(createAppLaunchOptions(target.normalizedRoute, target.query))
    if (this.isTabBarRoute(target.routeRecord.route)) {
      throw new Error(`wx.redirectTo() cannot open a tabBar page in headless runtime: ${url}`)
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
    return nextPage
  }

  switchTab(url: string) {
    const target = this.resolveNavigationTarget(url)
    this.bootstrap(createAppLaunchOptions(target.normalizedRoute, target.query))
    if (Object.keys(target.query).length > 0) {
      throw new Error(`wx.switchTab() url cannot contain query in headless runtime: ${url}`)
    }
    if (!this.isTabBarRoute(target.routeRecord.route)) {
      throw new Error(`wx.switchTab() can only open a tabBar page in headless runtime: ${url}`)
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
    }

    nextPage.onTabItemTap?.(tabItem)

    this.pages.length = 0
    this.pages.push(nextPage)
    this.currentPageInstance = nextPage
    return nextPage
  }

  pageScrollTo(option: {
    scrollTop?: number
    duration?: number
    selector?: string
    success?: () => void
    fail?: (error: Error) => void
    complete?: () => void
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
    const pageModulePath = path.resolve(this.project.miniprogramRootPath, `${target.routeRecord.route}.js`)
    const pageConfigPath = path.resolve(this.project.miniprogramRootPath, `${target.routeRecord.route}.json`)
    const pageDefinition = this.moduleLoader.executePageModule(pageModulePath, target.routeRecord.route)
    const pageConfig = readJsonObject(pageConfigPath)
    const pageInstance = createPageInstance(`/${target.routeRecord.route}`, pageDefinition, target.query, {
      navigationBarTitle: resolveNavigationBarTitle(this.project.appConfig, pageConfig),
    })
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

  private resolveTabBarItem(route: string) {
    const pagePath = stripLeadingSlash(route)
    const item = this.tabBarItems.get(pagePath)
    if (!item) {
      throw new Error(`Missing tabBar metadata for route "${route}" in headless runtime.`)
    }
    return {
      ...item,
    }
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
      throw new Error(`Unknown route for headless runtime navigation: ${url}`)
    }
    return {
      normalizedRoute,
      query,
      routeRecord,
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
    this.currentPageInstance = null
  }

  private unloadPage(page: HeadlessPageInstance) {
    page.onUnload?.()
    this.tabPages.delete(stripLeadingSlash(page.route))
  }

  private requireCurrentPage(action: string) {
    this.bootstrap()
    const current = this.currentPageInstance
    if (!current) {
      throw new Error(`Cannot call ${action} without an active page in headless runtime.`)
    }
    return current
  }
}

export function createHeadlessSession(options: HeadlessSessionOptions) {
  return new HeadlessSession(options)
}
