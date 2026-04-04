import type { HeadlessAppDefinition, HeadlessHostRegistries, HeadlessWxLaunchOptions, HeadlessWxNetworkType, HeadlessWxSavedFileInfo } from '../host'
import type { HeadlessProjectDescriptor } from '../project/createProjectDescriptor'
import type { HeadlessRouteRecord } from '../project/resolveRoutes'
import type { HeadlessAppInstance } from '../runtime/appInstance'
import type { HeadlessPageInstance } from '../runtime/pageInstance'
import type {
  HeadlessWxActionSheetMockDefinition,
  HeadlessWxClipboardSnapshot,
  HeadlessWxDownloadFileMockDefinition,
  HeadlessWxModalMockDefinition,
  HeadlessWxOpenDocumentSnapshot,
  HeadlessWxRequestMockDefinition,
  HeadlessWxUploadFileMockDefinition,
} from '../runtime/wxState'
import type { BrowserVirtualFiles } from './virtualFiles'
import { join, posix } from 'pathe'
import { createHostRegistries } from '../host'
import { cloneBackgroundSnapshot, cloneNavigationBarSnapshot, resolveBackgroundSnapshot, resolveNavigationBarSnapshot } from '../project/pageConfig'
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
import { executeSelectorQueryRequests, resolveSelectorQueryScopeRoot } from '../view'
import { createHeadlessAnimation } from '../view/animation'
import { createHeadlessCanvasContext } from '../view/canvasContext'
import { createHeadlessIntersectionObserver } from '../view/intersectionObserver'
import { createHeadlessMediaQueryObserver } from '../view/mediaQueryObserver'
import { resolveSelectorScrollTop } from '../view/selectorQuery'
import { createHeadlessVideoContext } from '../view/videoContext'
import { createBrowserModuleLoader } from './moduleLoader'
import { createBrowserProject } from './project'
import { renderBrowserPageTree } from './render'
import { readBrowserVirtualFile } from './virtualFiles'

export interface BrowserHeadlessSessionOptions {
  files: BrowserVirtualFiles
  project?: HeadlessProjectDescriptor
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

interface HeadlessTabBarSnapshotItem extends HeadlessTabBarItem {
  badge: string | null
  redDot: boolean
}

interface HeadlessPullDownRefreshState {
  active: boolean
  stopCalls: number
}

interface HeadlessMediaQueryObserverEntry {
  disconnect: () => void
  notify: () => void
  ownerPage: HeadlessPageInstance
}

const LEADING_SLASH_RE = /^\/+/
const PAGE_STACK_LIMIT = 10
const WHITESPACE_RE = /\s+/
const DATA_ATTR_SELECTOR_RE = /^\[data-([^=\]]+)="([^"]*)"\]$/
const COMPOUND_SELECTOR_PART_RE = /#[\w-]+|\.[\w-]+|\[data-[^=\]]+="[^"]*"\]|[A-Za-z][\w-]*/g
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

function parseCompoundSelector(selector: string) {
  const parts = selector.match(COMPOUND_SELECTOR_PART_RE) ?? []
  return parts.join('') === selector ? parts : []
}

function matchesComponentSelector(
  scope: { alias: string, classList?: string[], dataset?: Record<string, string>, id?: string },
  selector: string,
) {
  const parts = parseCompoundSelector(selector)
  if (parts.length === 0) {
    return false
  }

  return parts.every((part) => {
    if (part.startsWith('#')) {
      return scope.id === part.slice(1)
    }
    if (part.startsWith('.')) {
      return scope.classList?.includes(part.slice(1)) ?? false
    }

    const dataAttrMatch = part.match(DATA_ATTR_SELECTOR_RE)
    if (dataAttrMatch) {
      const [, key, value] = dataAttrMatch
      const datasetKey = key.replace(DATASET_KEY_RE, (_match, char: string) => char.toUpperCase())
      return scope.dataset?.[datasetKey] === value
    }

    return scope.alias === part
  })
}

function normalizeSelectorParts(selector: string) {
  return selector.trim().split(WHITESPACE_RE).filter(Boolean)
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

function readJsonObject(files: BrowserVirtualFiles, filePath: string) {
  const content = readBrowserVirtualFile(files, filePath)
  if (!content) {
    return undefined
  }

  try {
    const value = JSON.parse(content)
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
  private readonly tabBarState = new Map<number, HeadlessTabBarSnapshotItem>()
  private tabBarVisible = false
  private readonly systemInfo = createDefaultSystemInfo()
  private readonly mediaQueryObservers = new Set<HeadlessMediaQueryObserverEntry>()
  private readonly canvasContexts = new Map<string, import('../host').HeadlessWxCanvasContext>()
  private enterOptions = createAppLaunchOptions('', {})
  private launchOptions = createAppLaunchOptions('', {})
  private readonly wxState = createHeadlessWxState()
  private pullDownRefreshState: HeadlessPullDownRefreshState = {
    active: false,
    stopCalls: 0,
  }

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
      this.tabBarState.set(index, {
        badge: null,
        index,
        pagePath,
        redDot: false,
        text: typeof item.text === 'string' ? item.text : undefined,
      })
    })
    this.tabBarVisible = this.tabBarRoutes.size > 0
    this.moduleLoader = createBrowserModuleLoader(
      this.files,
      this.registries,
      () => this.pages.slice(),
      () => this.getApp(),
      {
        chooseImage: option => this.wxState.chooseImage(option ?? {}),
        chooseMessageFile: option => this.wxState.chooseMessageFile(option ?? {}),
        chooseMedia: option => this.wxState.chooseMedia(option ?? {}),
        chooseVideo: option => this.wxState.chooseVideo(option ?? {}),
        compressImage: option => this.wxState.compressImage(option),
        createAnimation: option => this.createAnimation(option),
        createCanvasContext: (canvasId, scope) => this.createCanvasContext(canvasId, scope),
        canvasToTempFilePath: option => this.canvasToTempFilePath(option),
        createIntersectionObserver: (scope, options) => this.createIntersectionObserver(scope, options),
        createVideoContext: (videoId, scope) => this.createVideoContext(videoId, scope),
        executeSelectorQuery: (requests, scope) => this.executeSelectorQuery(requests, scope),
        getFileInfo: option => this.wxState.getFileInfo(option),
        getImageInfo: option => this.wxState.getImageInfo(option),
        getVideoInfo: option => this.wxState.getVideoInfo(option),
        getFileSystemManager: () => this.wxState.getFileSystemManager(),
        getSavedFileInfo: option => this.wxState.getSavedFileInfo(option),
        getSavedFileList: () => this.wxState.getSavedFileList(),
        getEnterOptionsSync: () => ({ ...this.enterOptions, query: { ...this.enterOptions.query }, referrerInfo: { ...this.enterOptions.referrerInfo, extraData: { ...this.enterOptions.referrerInfo.extraData } } }),
        getAppBaseInfoSync: () => deriveAppBaseInfo(this.systemInfo),
        getLaunchOptionsSync: () => ({ ...this.launchOptions, query: { ...this.launchOptions.query }, referrerInfo: { ...this.launchOptions.referrerInfo, extraData: { ...this.launchOptions.referrerInfo.extraData } } }),
        getClipboardData: () => this.wxState.getClipboardData(),
        getMenuButtonBoundingClientRect: () => deriveMenuButtonBoundingClientRect(this.systemInfo),
        getNetworkType: () => this.wxState.getNetworkType(),
        navigateBack: option => this.navigateBack(option?.delta),
        navigateTo: option => this.navigateTo(option.url),
        pageScrollTo: option => this.pageScrollTo(option),
        openDocument: option => this.wxState.openDocument(option),
        clearStorageSync: () => this.wxState.clearStorageSync(),
        getStorageInfoSync: () => this.wxState.getStorageInfoSync(),
        getStorageSync: key => this.wxState.getStorageSync(key),
        getSystemInfoSync: () => ({ ...this.systemInfo }),
        getWindowInfoSync: () => deriveWindowInfo(this.systemInfo),
        hideLoading: () => this.wxState.hideLoading(),
        hideToast: () => this.wxState.hideToast(),
        downloadFile: option => this.wxState.downloadFile(option),
        reLaunch: option => this.reLaunch(option.url),
        redirectTo: option => this.redirectTo(option.url),
        removeSavedFile: option => this.wxState.removeSavedFile(option),
        saveImageToPhotosAlbum: option => this.wxState.saveImageToPhotosAlbum(option),
        saveVideoToPhotosAlbum: option => this.wxState.saveVideoToPhotosAlbum(option),
        nextTick: callback => queueMicrotask(() => callback?.()),
        offNetworkStatusChange: callback => this.wxState.offNetworkStatusChange(callback),
        onNetworkStatusChange: callback => this.wxState.onNetworkStatusChange(callback),
        removeStorageSync: key => this.wxState.removeStorageSync(key),
        previewImage: option => this.wxState.previewImage(option),
        request: option => this.wxState.request(option),
        saveFile: option => this.wxState.saveFile(option),
        setBackgroundColor: option => this.setBackgroundColor(option),
        setBackgroundTextStyle: option => this.setBackgroundTextStyle(option.textStyle),
        setClipboardData: option => this.wxState.setClipboardData(option),
        setStorageSync: (key, value) => this.wxState.setStorageSync(key, value),
        setNavigationBarColor: option => this.setNavigationBarColor(option),
        setNavigationBarTitle: option => this.setNavigationBarTitle(option.title),
        hideShareMenu: () => this.wxState.hideShareMenu(),
        hideNavigationBarLoading: () => this.hideNavigationBarLoading(),
        hideTabBar: () => this.hideTabBar(),
        hideTabBarRedDot: option => this.hideTabBarRedDot(option.index),
        showShareMenu: option => this.wxState.showShareMenu(option),
        showNavigationBarLoading: () => this.showNavigationBarLoading(),
        showTabBar: () => this.showTabBar(),
        showTabBarRedDot: option => this.showTabBarRedDot(option.index),
        showActionSheet: option => this.wxState.showActionSheet(option),
        showLoading: option => this.wxState.showLoading(option),
        showModal: option => this.wxState.showModal(option),
        showToast: option => this.wxState.showToast(option),
        startPullDownRefresh: () => this.startPullDownRefresh(),
        stopPullDownRefresh: () => this.stopPullDownRefresh(),
        switchTab: option => this.switchTab(option.url),
        uploadFile: option => this.wxState.uploadFile(option),
        removeTabBarBadge: option => this.removeTabBarBadge(option.index),
        setTabBarBadge: option => this.setTabBarBadge(option.index, option.text),
        updateShareMenu: option => this.wxState.updateShareMenu(option),
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

  getCurrentPageNavigationBar() {
    const snapshot = this.currentPageInstance?.__navigationBar__
    return snapshot ? cloneNavigationBarSnapshot(snapshot) : null
  }

  getCurrentPageBackground() {
    const snapshot = this.currentPageInstance?.__background__
    return snapshot ? cloneBackgroundSnapshot(snapshot) : null
  }

  getActionSheetLogs() {
    return this.wxState.getActionSheetLogs()
  }

  getRequestLogs() {
    return this.wxState.getRequestLogs()
  }

  getDownloadFileLogs() {
    return this.wxState.getDownloadFileLogs()
  }

  getUploadFileLogs() {
    return this.wxState.getUploadFileLogs()
  }

  getFileSnapshot() {
    return this.wxState.getFileSnapshot()
  }

  getDirectorySnapshot() {
    return this.wxState.getDirectorySnapshot()
  }

  getFileText(filePath: string) {
    return this.wxState.getFileText(filePath)
  }

  getSavedFileListSnapshot(): HeadlessWxSavedFileInfo[] {
    return this.wxState.getSavedFileList().fileList
  }

  getStorageSnapshot() {
    return this.wxState.getStorageSnapshot()
  }

  getShareMenu() {
    return this.wxState.getShareMenu()
  }

  getTabBar() {
    return {
      visible: this.tabBarVisible,
    }
  }

  getTabBarSnapshot() {
    return {
      items: Array.from(this.tabBarState.values(), item => ({
        badge: item.badge,
        index: item.index,
        pagePath: item.pagePath,
        redDot: item.redDot,
        text: item.text,
      })),
      visible: this.tabBarVisible,
    }
  }

  getStorageInfo() {
    return this.wxState.getStorageInfoSync()
  }

  getClipboardData(): HeadlessWxClipboardSnapshot {
    return this.wxState.getClipboardSnapshot()
  }

  getPreviewImage() {
    return this.wxState.getPreviewImage()
  }

  getOpenedDocument(): HeadlessWxOpenDocumentSnapshot | null {
    return this.wxState.getOpenedDocument()
  }

  getPullDownRefreshState() {
    return { ...this.pullDownRefreshState }
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

  mockDownloadFile(definition: HeadlessWxDownloadFileMockDefinition) {
    this.wxState.mockDownloadFile(definition)
  }

  mockUploadFile(definition: HeadlessWxUploadFileMockDefinition) {
    this.wxState.mockUploadFile(definition)
  }

  setFile(filePath: string, fileContent: string) {
    this.wxState.setFile(filePath, fileContent)
  }

  setNetworkType(networkType: HeadlessWxNetworkType) {
    return this.wxState.setNetworkType(networkType)
  }

  setBackgroundTextStyle(textStyle: string) {
    if (textStyle !== 'dark' && textStyle !== 'light') {
      throw new Error('setBackgroundTextStyle:fail invalid textStyle')
    }
    const current = this.requireCurrentPage('wx.setBackgroundTextStyle()')
    current.__background__ ??= {
      backgroundColor: '#ffffff',
      backgroundColorBottom: '#ffffff',
      backgroundColorTop: '#ffffff',
      textStyle: 'dark',
    }
    current.__background__.textStyle = textStyle
    current.__backgroundTextStyle__ = textStyle
    return {
      errMsg: 'setBackgroundTextStyle:ok',
    }
  }

  setBackgroundColor(option: {
    backgroundColor?: string
    backgroundColorBottom?: string
    backgroundColorTop?: string
  }) {
    const current = this.requireCurrentPage('wx.setBackgroundColor()')
    current.__background__ ??= {
      backgroundColor: '#ffffff',
      backgroundColorBottom: '#ffffff',
      backgroundColorTop: '#ffffff',
      textStyle: current.__backgroundTextStyle__ ?? 'dark',
    }
    if (typeof option.backgroundColor === 'string') {
      current.__background__.backgroundColor = option.backgroundColor
    }
    if (typeof option.backgroundColorTop === 'string') {
      current.__background__.backgroundColorTop = option.backgroundColorTop
    }
    if (typeof option.backgroundColorBottom === 'string') {
      current.__background__.backgroundColorBottom = option.backgroundColorBottom
    }
    return {
      errMsg: 'setBackgroundColor:ok',
    }
  }

  setNavigationBarTitle(title: string) {
    const current = this.requireCurrentPage('wx.setNavigationBarTitle()')
    current.__navigationBar__ ??= {
      animation: null,
      backgroundColor: '#ffffff',
      frontColor: '#000000',
      loading: false,
      title: '',
    }
    current.__navigationBar__.title = title
    current.__navigationBarTitle__ = title
    return {
      errMsg: 'setNavigationBarTitle:ok',
    }
  }

  setNavigationBarColor(option: {
    animation?: {
      duration?: number
      timingFunction?: string
    }
    backgroundColor?: string
    frontColor?: string
  }) {
    const current = this.requireCurrentPage('wx.setNavigationBarColor()')
    current.__navigationBar__ ??= {
      animation: null,
      backgroundColor: '#ffffff',
      frontColor: '#000000',
      loading: false,
      title: current.__navigationBarTitle__ ?? '',
    }
    if (typeof option.backgroundColor === 'string') {
      current.__navigationBar__.backgroundColor = option.backgroundColor
    }
    if (typeof option.frontColor === 'string') {
      current.__navigationBar__.frontColor = option.frontColor
    }
    current.__navigationBar__.animation = option.animation
      ? {
          duration: option.animation.duration,
          timingFunction: option.animation.timingFunction,
        }
      : null
    return {
      errMsg: 'setNavigationBarColor:ok',
    }
  }

  showNavigationBarLoading() {
    const current = this.requireCurrentPage('wx.showNavigationBarLoading()')
    current.__navigationBar__ ??= {
      animation: null,
      backgroundColor: '#ffffff',
      frontColor: '#000000',
      loading: false,
      title: current.__navigationBarTitle__ ?? '',
    }
    current.__navigationBar__.loading = true
    return {
      errMsg: 'showNavigationBarLoading:ok',
    }
  }

  hideNavigationBarLoading() {
    const current = this.requireCurrentPage('wx.hideNavigationBarLoading()')
    current.__navigationBar__ ??= {
      animation: null,
      backgroundColor: '#ffffff',
      frontColor: '#000000',
      loading: false,
      title: current.__navigationBarTitle__ ?? '',
    }
    current.__navigationBar__.loading = false
    return {
      errMsg: 'hideNavigationBarLoading:ok',
    }
  }

  hideTabBar() {
    this.tabBarVisible = false
    return {
      errMsg: 'hideTabBar:ok',
    }
  }

  hideTabBarRedDot(index: number) {
    const item = this.requireTabBarItem(index, 'wx.hideTabBarRedDot()')
    item.redDot = false
    return {
      errMsg: 'hideTabBarRedDot:ok',
    }
  }

  showTabBar() {
    this.tabBarVisible = this.tabBarRoutes.size > 0
    return {
      errMsg: 'showTabBar:ok',
    }
  }

  showTabBarRedDot(index: number) {
    const item = this.requireTabBarItem(index, 'wx.showTabBarRedDot()')
    item.badge = null
    item.redDot = true
    return {
      errMsg: 'showTabBarRedDot:ok',
    }
  }

  removeTabBarBadge(index: number) {
    const item = this.requireTabBarItem(index, 'wx.removeTabBarBadge()')
    item.badge = null
    return {
      errMsg: 'removeTabBarBadge:ok',
    }
  }

  setTabBarBadge(index: number, text: string) {
    const item = this.requireTabBarItem(index, 'wx.setTabBarBadge()')
    item.badge = text
    item.redDot = false
    return {
      errMsg: 'setTabBarBadge:ok',
    }
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

  getScopeIdForComponent(component: import('../runtime').HeadlessComponentInstance | null | undefined) {
    if (!component) {
      return null
    }
    return this.getComponentScopeId(component)
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
    const selectorParts = normalizeSelectorParts(selector)
    if (selectorParts.length === 0) {
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

        const lastPart = selectorParts.at(-1)
        if (!lastPart || !matchesComponentSelector(scope, lastPart)) {
          return false
        }

        let currentScope = scope.ownerScopeId
          ? this.componentScopes.get(scope.ownerScopeId)
          : undefined

        for (let partIndex = selectorParts.length - 2; partIndex >= 0; partIndex -= 1) {
          while (currentScope && !matchesComponentSelector(currentScope, selectorParts[partIndex]!)) {
            currentScope = currentScope.ownerScopeId
              ? this.componentScopes.get(currentScope.ownerScopeId)
              : undefined
          }
          if (!currentScope) {
            return false
          }
          currentScope = currentScope.ownerScopeId
            ? this.componentScopes.get(currentScope.ownerScopeId)
            : undefined
        }
        return true
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
        createIntersectionObserver: (scope, options) => this.createIntersectionObserver(scope, options),
        createMediaQueryObserver: scope => this.createMediaQueryObserver(scope),
        selectAllComponentsWithin: (scopeId: string, selector: string) => this.selectAllComponentsWithin(scopeId, selector),
        selectComponentWithin: (scopeId: string, selector: string) => this.selectComponentWithin(scopeId, selector),
        selectOwnerComponent: (scopeId: string) => this.selectOwnerComponent(scopeId),
      },
    }, current)
    current.__lastChangedKeys__ = []
    return rendered
  }

  callScopeMethod(scopeId: string | null, methodName: string, event: Record<string, any>) {
    const current = this.requireCurrentPage(`scope method "${methodName}"`)
    this.renderCurrentPage()

    if (!scopeId || scopeId === `page:${stripLeadingSlash(current.route)}`) {
      const method = current[methodName]
      if (typeof method !== 'function') {
        throw new TypeError(`Method "${methodName}" does not exist on browser simulator page ${current.route}.`)
      }
      return method.call(current, event)
    }

    const instance = this.componentCache.get(scopeId)
    if (!instance) {
      throw new Error(`Unknown scope "${scopeId}" in browser simulator runtime.`)
    }
    instance.__lastInteractionEvent__ = {
      currentTarget: event.currentTarget,
      mark: event.mark,
      target: event.target,
    }
    const method = instance[methodName]
    if (typeof method !== 'function') {
      throw new TypeError(`Method "${methodName}" does not exist on browser simulator component scope "${scopeId}".`)
    }
    return method.call(instance, event)
  }

  callScopeMethodDirect(scopeId: string, methodName: string, ...args: any[]) {
    const normalizedScopeId = scopeId.trim()
    if (!normalizedScopeId) {
      throw new Error('Scope id must be a non-empty string in browser simulator runtime.')
    }

    const current = this.requireCurrentPage(`scope method "${methodName}"`)
    if (normalizedScopeId === `page:${stripLeadingSlash(current.route)}`) {
      const method = current[methodName]
      if (typeof method !== 'function') {
        throw new TypeError(`Method "${methodName}" does not exist on browser simulator page ${current.route}.`)
      }
      return method.apply(current, args)
    }

    const instance = this.componentCache.get(normalizedScopeId)
    if (!instance) {
      throw new Error(`Unknown scope "${normalizedScopeId}" in browser simulator runtime.`)
    }
    instance.__lastInteractionEvent__ = undefined
    const method = instance[methodName]
    if (typeof method !== 'function') {
      throw new TypeError(`Method "${methodName}" does not exist on browser simulator component scope "${normalizedScopeId}".`)
    }
    return method.apply(instance, args)
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
      mark?: Record<string, unknown>
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
        mark: event.mark,
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
      mark: event.mark,
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

    this.launchOptions = createAppLaunchOptions(launchOptions.path, launchOptions.query)
    this.enterOptions = createAppLaunchOptions(launchOptions.path, launchOptions.query)
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
    duration?: number
    selector?: string
    scrollTop?: number
  }) {
    const current = this.requireCurrentPage('wx.pageScrollTo()')
    const rendered = renderBrowserPageTree({
      changedPageKeys: current.__lastChangedKeys__ ?? [],
      componentCache: this.componentCache,
      componentScopes: this.componentScopes,
      files: this.files,
      moduleLoader: this.moduleLoader,
      project: this.project,
      session: {
        createIntersectionObserver: (scope, options) => this.createIntersectionObserver(scope, options),
        createMediaQueryObserver: scope => this.createMediaQueryObserver(scope),
        selectAllComponentsWithin: (scopeId: string, selector: string) => this.selectAllComponentsWithin(scopeId, selector),
        selectComponentWithin: (scopeId: string, selector: string) => this.selectComponentWithin(scopeId, selector),
        selectOwnerComponent: (scopeId: string) => this.selectOwnerComponent(scopeId),
      },
    }, current)
    const selectorScrollTop = resolveSelectorScrollTop(rendered.root, option.selector)
    current.__scrollTop__ = Number(selectorScrollTop ?? option.scrollTop ?? 0)
    current.onPageScroll?.({
      scrollTop: current.__scrollTop__,
    })
  }

  triggerPullDownRefresh() {
    const current = this.requireCurrentPage('triggerPullDownRefresh()')
    this.pullDownRefreshState = {
      ...this.pullDownRefreshState,
      active: true,
    }
    current.onPullDownRefresh?.()
    return current
  }

  startPullDownRefresh() {
    this.triggerPullDownRefresh()
    return {
      errMsg: 'startPullDownRefresh:ok',
    }
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
    this.notifyMediaQueryObservers()
    return current
  }

  triggerRouteDone(options: Record<string, any> = {}) {
    const current = this.requireCurrentPage('triggerRouteDone()')
    current.onRouteDone?.(options)
    return current
  }

  stopPullDownRefresh() {
    this.pullDownRefreshState = {
      active: false,
      stopCalls: this.pullDownRefreshState.stopCalls + 1,
    }
  }

  private executeSelectorQuery(
    requests: import('../host').HeadlessWxSelectorQueryRequest[],
    scope?: Record<string, any>,
  ) {
    const current = this.requireCurrentPage('wx.createSelectorQuery().exec()')
    if (scope && scope !== current && !Array.from(this.componentCache.values()).includes(scope as import('../runtime').HeadlessComponentInstance)) {
      throw new Error('wx.createSelectorQuery().in(component) received an unknown scope in browser simulator runtime.')
    }
    const scopeId = scope && scope !== current
      ? this.getComponentScopeId(scope as import('../runtime').HeadlessComponentInstance)
      : null
    const rendered = renderBrowserPageTree({
      changedPageKeys: current.__lastChangedKeys__ ?? [],
      componentCache: this.componentCache,
      componentScopes: this.componentScopes,
      files: this.files,
      moduleLoader: this.moduleLoader,
      project: this.project,
      session: {
        createIntersectionObserver: (scope, options) => this.createIntersectionObserver(scope, options),
        createMediaQueryObserver: scope => this.createMediaQueryObserver(scope),
        selectAllComponentsWithin: (scopeId: string, selector: string) => this.selectAllComponentsWithin(scopeId, selector),
        selectComponentWithin: (scopeId: string, selector: string) => this.selectComponentWithin(scopeId, selector),
        selectOwnerComponent: (scopeId: string) => this.selectOwnerComponent(scopeId),
      },
    }, current)
    return executeSelectorQueryRequests(requests, {
      page: current,
      resolveContext: (node) => {
        if (node.name !== 'canvas') {
          return {
            type: 'unsupported-context',
          }
        }
        const canvasId = node.attribs?.['canvas-id']
        return typeof canvasId === 'string' && canvasId
          ? this.createCanvasContext(canvasId, scope)
          : {
              type: 'unsupported-context',
            }
      },
      root: resolveSelectorQueryScopeRoot(rendered.root, scopeId),
      windowInfo: this.getWindowInfo(),
    })
  }

  private createFreshPage(target: ResolvedNavigationTarget) {
    const pageModulePath = join(this.project.miniprogramRootPath, `${target.routeRecord.route}.js`)
    const pageConfigPath = join(this.project.miniprogramRootPath, `${target.routeRecord.route}.json`)
    const pageDefinition = this.moduleLoader.executePageModule(pageModulePath, target.routeRecord.route)
    const pageConfig = readJsonObject(this.files, pageConfigPath)
    const pageInstance = createPageInstance(target.routeRecord.route, pageDefinition, target.query, {
      background: resolveBackgroundSnapshot(this.project.appConfig, pageConfig),
      navigationBar: resolveNavigationBarSnapshot(this.project.appConfig, pageConfig),
    })
    pageInstance.createIntersectionObserver = (options?: Record<string, any>) => this.createIntersectionObserver(pageInstance, options)
    pageInstance.createMediaQueryObserver = () => this.createMediaQueryObserver(pageInstance)
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

  private requireTabBarItem(index: number, action: string) {
    const normalizedIndex = Number.isFinite(index) ? Math.trunc(index) : Number.NaN
    const item = this.tabBarState.get(normalizedIndex)
    if (!item) {
      throw new Error(`Cannot call ${action} with unknown tabBar index ${index} in browser simulator runtime.`)
    }
    return item
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
    this.clearMediaQueryObservers()
    this.currentPageInstance = null
  }

  private unloadPage(page: HeadlessPageInstance) {
    page.onUnload?.()
    this.clearMediaQueryObservers(page)
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

  private notifyMediaQueryObservers() {
    for (const entry of [...this.mediaQueryObservers]) {
      if (entry.ownerPage !== this.currentPageInstance) {
        continue
      }
      entry.notify()
    }
  }

  private clearMediaQueryObservers(ownerPage?: HeadlessPageInstance) {
    for (const entry of [...this.mediaQueryObservers]) {
      if (ownerPage && entry.ownerPage !== ownerPage) {
        continue
      }
      entry.disconnect()
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

  private getComponentScopeId(component: import('../runtime').HeadlessComponentInstance) {
    for (const [scopeId, instance] of this.componentCache.entries()) {
      if (instance === component) {
        return scopeId
      }
    }
    return null
  }

  private createVideoContext(videoId: string, scope?: Record<string, any>) {
    return createHeadlessVideoContext(
      {
        callScopeMethod: (scopeId, methodName, event) => this.callScopeMethod(scopeId, methodName, event),
        renderCurrentPage: () => this.renderCurrentPage(),
        resolveScope: (value) => {
          const current = this.currentPageInstance
          if (!value || value === current) {
            return {
              kind: 'page' as const,
            }
          }
          const scopeId = this.getScopeIdForComponent(value as import('../runtime').HeadlessComponentInstance)
          if (!scopeId) {
            return {
              kind: 'missing' as const,
            }
          }
          return {
            kind: 'component' as const,
            scopeId,
          }
        },
      },
      videoId,
      scope,
    )
  }

  private createAnimation(option?: import('../host').HeadlessWxAnimationStepOption) {
    return createHeadlessAnimation(option)
  }

  private resolveCanvasScopeKey(scope?: Record<string, any>) {
    const current = this.currentPageInstance
    if (!scope || scope === current) {
      return 'page'
    }
    const scopeId = this.getScopeIdForComponent(scope as import('../runtime').HeadlessComponentInstance)
    return scopeId ? `component:${scopeId}` : 'missing'
  }

  private createCanvasContext(canvasId: string, scope?: Record<string, any>) {
    const context = createHeadlessCanvasContext(
      {
        renderCurrentPage: () => this.renderCurrentPage(),
        resolveScope: (value) => {
          const current = this.currentPageInstance
          if (!value || value === current) {
            return {
              kind: 'page' as const,
            }
          }
          const scopeId = this.getScopeIdForComponent(value as import('../runtime').HeadlessComponentInstance)
          if (!scopeId) {
            return {
              kind: 'missing' as const,
            }
          }
          return {
            kind: 'component' as const,
            scopeId,
          }
        },
      },
      canvasId,
      scope,
    )
    this.canvasContexts.set(`${this.resolveCanvasScopeKey(scope)}:${canvasId}`, context)
    return context
  }

  private canvasToTempFilePath(option: import('../host').HeadlessWxCanvasToTempFilePathOption) {
    const context = this.canvasContexts.get(`${this.resolveCanvasScopeKey(option.component)}:${option.canvasId}`)
    if (!context) {
      throw new Error(`canvasToTempFilePath:fail canvas "${option.canvasId}" has not been drawn in browser runtime.`)
    }
    const tempFilePath = this.wxState.createTempFile(JSON.stringify({
      canvasId: option.canvasId,
      config: {
        destHeight: option.destHeight,
        destWidth: option.destWidth,
        fileType: option.fileType,
        height: option.height,
        quality: option.quality,
        width: option.width,
        x: option.x,
        y: option.y,
      },
      snapshot: context.__getSnapshot(),
    }))
    return {
      errMsg: 'canvasToTempFilePath:ok',
      tempFilePath,
    }
  }

  private createIntersectionObserver(
    scope?: Record<string, any>,
    options?: import('../host').HeadlessWxCreateIntersectionObserverOption,
  ) {
    return createHeadlessIntersectionObserver(
      {
        getWindowInfo: () => this.getWindowInfo(),
        renderCurrentPage: () => this.renderCurrentPage(),
        resolveScope: (value) => {
          const current = this.currentPageInstance
          if (!value || value === current) {
            return {
              kind: 'page' as const,
            }
          }
          const scopeId = this.getScopeIdForComponent(value as import('../runtime').HeadlessComponentInstance)
          if (!scopeId) {
            return {
              kind: 'missing' as const,
            }
          }
          return {
            kind: 'component' as const,
            scopeId,
          }
        },
      },
      scope,
      options,
    )
  }

  private createMediaQueryObserver(scope?: Record<string, any>) {
    const current = this.requireCurrentPage('createMediaQueryObserver()')
    const ownerPage = scope === current || !scope
      ? current
      : this.currentPageInstance ?? current
    let entry!: HeadlessMediaQueryObserverEntry
    const controller = createHeadlessMediaQueryObserver(
      {
        getWindowInfo: () => this.getWindowInfo(),
      },
      () => {
        this.mediaQueryObservers.delete(entry)
      },
    )
    entry = {
      disconnect: controller.disconnect,
      notify: controller.notify,
      ownerPage,
    }
    this.mediaQueryObservers.add(entry)
    return controller.observer
  }
}

export function createBrowserHeadlessSession(options: BrowserHeadlessSessionOptions) {
  return new BrowserHeadlessSession(options)
}
