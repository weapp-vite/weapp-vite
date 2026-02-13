import type { ButtonFormConfig } from './button'
import type { ComponentOptions, ComponentPublicInstance } from './component'
import type { NavigationBarMetrics } from './navigationBar'
import type { TemplateRenderer } from './template'
import { slugify } from '../shared/slugify'
import { ensureButtonDefined, setButtonFormConfig } from './button'
import { defineComponent } from './component'
import { ensureNavigationBarDefined, setNavigationBarMetrics } from './navigationBar'
import { setupRpx } from './rpx'

interface RegisterMeta {
  id: string
  template?: TemplateRenderer
  style?: string
}

interface PageHooks {
  onLoad?: (this: ComponentPublicInstance, query: Record<string, string>) => void
  onReady?: (this: ComponentPublicInstance) => void
  onShow?: (this: ComponentPublicInstance) => void
  onHide?: (this: ComponentPublicInstance) => void
  onUnload?: (this: ComponentPublicInstance) => void
}

interface PageRecord {
  tag: string
  hooks: PageHooks
  instances: Set<ComponentPublicInstance>
}

interface ComponentRecord {
  tag: string
}

type MethodHandler = (this: ComponentPublicInstance, ...args: unknown[]) => unknown

interface PageStackEntry {
  id: string
  query: Record<string, string>
  instance?: ComponentPublicInstance
}

interface RouteMeta {
  id: string
  query: Record<string, string>
  entry: PageStackEntry
}

const ROUTE_META_SYMBOL = Symbol('@weapp-vite/web:route-meta')
const PAGE_STATE_SYMBOL = Symbol('@weapp-vite/web:page-state')

interface RouteMetaCarrier {
  [ROUTE_META_SYMBOL]?: RouteMeta
}

interface PageStateCarrier {
  [PAGE_STATE_SYMBOL]?: PageInstanceState
}

interface AppLifecycleHooks {
  onLaunch?: (this: AppRuntime, options: AppLaunchOptions) => void
  onShow?: (this: AppRuntime, options: AppLaunchOptions) => void
}

type AppRuntime = Record<string, unknown> & Partial<AppLifecycleHooks> & {
  globalData?: Record<string, unknown>
}

interface AppLaunchOptions {
  path: string
  scene: number
  query: Record<string, string>
  referrerInfo: Record<string, unknown>
}

interface WxBaseResult {
  errMsg: string
}

interface WxAsyncOptions<SuccessResult extends WxBaseResult> {
  success?: (result: SuccessResult) => void
  fail?: (result: WxBaseResult) => void
  complete?: (result: SuccessResult | WxBaseResult) => void
}

interface ShowToastOptions extends WxAsyncOptions<WxBaseResult> {
  title?: string
  icon?: 'success' | 'error' | 'none'
  duration?: number
}

interface SetClipboardDataOptions extends WxAsyncOptions<WxBaseResult> {
  data?: string
}

interface ShowLoadingOptions extends WxAsyncOptions<WxBaseResult> {
  title?: string
  mask?: boolean
}

interface ShowModalSuccessResult extends WxBaseResult {
  confirm: boolean
  cancel: boolean
}

interface ShowModalOptions extends WxAsyncOptions<ShowModalSuccessResult> {
  title?: string
  content?: string
  showCancel?: boolean
  confirmText?: string
  cancelText?: string
}

interface SystemInfo {
  brand: string
  model: string
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
  language: string
  version: string
  system: string
  platform: string
}

const pageRegistry = new Map<string, PageRecord>()
const componentRegistry = new Map<string, ComponentRecord>()
const navigationHistory: PageStackEntry[] = []
let pageOrder: string[] = []
// eslint-disable-next-line ts/no-unused-vars
let activeEntry: PageStackEntry | undefined
let appInstance: AppRuntime | undefined
let appLaunched = false

const PAGE_LIFECYCLE_KEYS = new Set(['onLoad', 'onReady', 'onShow', 'onHide', 'onUnload'])
const RESERVED_PAGE_METHOD_KEYS = new Set([
  'data',
  'methods',
  'lifetimes',
  'properties',
  'behaviors',
  'options',
  'observers',
  'mixins',
  ...PAGE_LIFECYCLE_KEYS,
])
const RESERVED_COMPONENT_METHOD_KEYS = new Set([
  'data',
  'methods',
  'lifetimes',
  'properties',
  'behaviors',
  'options',
  'observers',
  'mixins',
])

function ensureDocumentReady(callback: () => void) {
  if (typeof document === 'undefined') {
    return
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => callback(), { once: true })
    return
  }
  callback()
}

function ensureContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  return (document.querySelector('#app') as HTMLElement | null) ?? document.body
}

function cloneLifetimes(source?: ComponentOptions['lifetimes']): ComponentOptions['lifetimes'] {
  if (!source) {
    return undefined
  }
  return {
    ...source,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMethodHandler(value: unknown): value is MethodHandler {
  return typeof value === 'function'
}

function normalizeMethodBag(
  source: Record<string, unknown> | undefined,
  reserved: Set<string>,
) {
  const methods: Record<string, MethodHandler> = {}
  const sourceMethods = isRecord(source?.methods) ? source?.methods : undefined

  if (sourceMethods) {
    for (const [key, value] of Object.entries(sourceMethods)) {
      if (isMethodHandler(value)) {
        methods[key] = value
      }
    }
  }

  if (source) {
    for (const [key, value] of Object.entries(source)) {
      if (reserved.has(key)) {
        continue
      }
      if (isMethodHandler(value) && methods[key] === undefined) {
        methods[key] = value
      }
    }
  }
  return methods
}

type PageRawOptions = ComponentOptions & PageHooks & Record<string, unknown>
type ComponentRawOptions = ComponentOptions & Record<string, unknown>

function normalizePageOptions(raw: PageRawOptions | undefined): { component: ComponentOptions, hooks: PageHooks } {
  const component = { ...(raw ?? {}) } as ComponentOptions
  component.methods = normalizeMethodBag(raw as Record<string, unknown> | undefined, RESERVED_PAGE_METHOD_KEYS) as ComponentOptions['methods']
  if (raw?.lifetimes) {
    component.lifetimes = cloneLifetimes(raw.lifetimes)
  }
  const hooks: PageHooks = {}
  if (typeof raw?.onLoad === 'function') {
    hooks.onLoad = raw.onLoad as PageHooks['onLoad']
  }
  if (typeof raw?.onReady === 'function') {
    hooks.onReady = raw.onReady as PageHooks['onReady']
  }
  if (typeof raw?.onShow === 'function') {
    hooks.onShow = raw.onShow as PageHooks['onShow']
  }
  if (typeof raw?.onHide === 'function') {
    hooks.onHide = raw.onHide as PageHooks['onHide']
  }
  if (typeof raw?.onUnload === 'function') {
    hooks.onUnload = raw.onUnload as PageHooks['onUnload']
  }
  return { component, hooks }
}

function normalizeComponentOptions(raw: ComponentRawOptions | undefined): ComponentOptions {
  const component = { ...(raw ?? {}) } as ComponentOptions
  component.methods = normalizeMethodBag(raw as Record<string, unknown> | undefined, RESERVED_COMPONENT_METHOD_KEYS) as ComponentOptions['methods']
  if (raw?.lifetimes) {
    component.lifetimes = cloneLifetimes(raw.lifetimes)
  }
  return component
}

function getRouteMeta(instance: ComponentPublicInstance): RouteMeta | undefined {
  return (instance as RouteMetaCarrier)[ROUTE_META_SYMBOL]
}

interface PageInstanceState {
  loaded: boolean
}

function getPageState(instance: ComponentPublicInstance): PageInstanceState {
  const target = instance as PageStateCarrier
  target[PAGE_STATE_SYMBOL] ??= { loaded: false }
  return target[PAGE_STATE_SYMBOL]!
}

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
  if (typeof appInstance.onLaunch === 'function') {
    appInstance.onLaunch(launchOptions)
  }
  if (typeof appInstance.onShow === 'function') {
    appInstance.onShow(launchOptions)
  }
  appLaunched = true
}

function mountEntry(entry: PageStackEntry) {
  const record = pageRegistry.get(entry.id)
  if (!record) {
    return
  }
  ensureDocumentReady(() => {
    const container = ensureContainer()
    if (!container) {
      return
    }
    while (container.childNodes.length) {
      container.removeChild(container.childNodes[0]!)
    }
    const element = document.createElement(record.tag) as HTMLElement & ComponentPublicInstance & RouteMetaCarrier
    element[ROUTE_META_SYMBOL] = {
      id: entry.id,
      query: entry.query,
      entry,
    }
    container.append(element)
    activeEntry = entry
    ensureAppLaunched(entry)
  })
}

function pushEntry(id: string, query: Record<string, string>) {
  if (!pageRegistry.has(id)) {
    return
  }
  const entry: PageStackEntry = { id, query }
  navigationHistory.push(entry)
  mountEntry(entry)
}

function replaceEntry(id: string, query: Record<string, string>) {
  if (!pageRegistry.has(id)) {
    return
  }
  const entry: PageStackEntry = { id, query }
  if (navigationHistory.length) {
    navigationHistory[navigationHistory.length - 1] = entry
  }
  else {
    navigationHistory.push(entry)
  }
  mountEntry(entry)
}

function relaunchEntry(id: string, query: Record<string, string>) {
  navigationHistory.length = 0
  pushEntry(id, query)
}

const PAGE_TEMPLATE_EXTENSIONS = ['.wxml', '.axml', '.swan', '.ttml', '.qml', '.ksml', '.xhsml', '.html']

function stripTemplateExtension(id: string) {
  const lowered = id.toLowerCase()
  for (const ext of PAGE_TEMPLATE_EXTENSIONS) {
    if (lowered.endsWith(ext)) {
      return id.slice(0, -ext.length)
    }
  }
  return id
}

function parsePageId(raw: string) {
  const normalized = raw.replace(/^\//, '')
  return stripTemplateExtension(normalized)
}

function parsePageUrl(url: string) {
  const [path, search = ''] = url.split('?')
  const query: Record<string, string> = {}
  if (search) {
    const params = new URLSearchParams(search)
    for (const [key, value] of params.entries()) {
      query[key] = value
    }
  }
  return {
    id: parsePageId(path || ''),
    query,
  }
}

function augmentPageComponentOptions(component: ComponentOptions, record: PageRecord) {
  const lifetimes = component.lifetimes ?? {}
  const originalCreated = lifetimes?.created
  const originalAttached = lifetimes?.attached
  const originalReady = lifetimes?.ready
  const originalDetached = lifetimes?.detached

  const enhanced: ComponentOptions = {
    ...component,
    lifetimes: {
      ...lifetimes,
      created(this: ComponentPublicInstance) {
        originalCreated?.call(this)
        getPageState(this)
        record.instances.add(this)
      },
      attached(this: ComponentPublicInstance) {
        originalAttached?.call(this)
        const meta = getRouteMeta(this)
        if (meta?.entry) {
          meta.entry.instance = this
        }
        const state = getPageState(this)
        if (!state.loaded) {
          record.hooks.onLoad?.call(this, meta?.query ?? {})
          state.loaded = true
        }
        record.hooks.onShow?.call(this)
      },
      ready(this: ComponentPublicInstance) {
        originalReady?.call(this)
        record.hooks.onReady?.call(this)
      },
      detached(this: ComponentPublicInstance) {
        originalDetached?.call(this)
        const meta = getRouteMeta(this)
        if (meta?.entry) {
          meta.entry.instance = undefined
        }
        record.hooks.onHide?.call(this)
        record.hooks.onUnload?.call(this)
        const state = getPageState(this)
        state.loaded = false
        record.instances.delete(this)
      },
    },
  }

  return enhanced
}

export function initializePageRoutes(
  ids: string[],
  options?: {
    rpx?: { designWidth?: number, varName?: string }
    navigationBar?: NavigationBarMetrics
    form?: ButtonFormConfig
  },
) {
  pageOrder = Array.from(new Set(ids))
  if (!pageOrder.length) {
    return
  }
  if (options?.rpx) {
    setupRpx(options.rpx)
  }
  if (options?.navigationBar) {
    setNavigationBarMetrics(options.navigationBar)
  }
  if (options?.form) {
    setButtonFormConfig(options.form)
  }
  if (!navigationHistory.length) {
    pushEntry(pageOrder[0], {})
  }
}

export function registerPage<T extends PageRawOptions | undefined>(options: T, meta: RegisterMeta): T {
  ensureButtonDefined()
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
  ensureButtonDefined()
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
  if (!isRecord(appInstance.globalData)) {
    appInstance.globalData = {}
  }
  return options
}

export function navigateTo(options: { url: string }) {
  if (!options?.url) {
    return Promise.resolve()
  }
  const { id, query } = parsePageUrl(options.url)
  pushEntry(id, query)
  return Promise.resolve()
}

export function redirectTo(options: { url: string }) {
  if (!options?.url) {
    return Promise.resolve()
  }
  const { id, query } = parsePageUrl(options.url)
  replaceEntry(id, query)
  return Promise.resolve()
}

export function reLaunch(options: { url: string }) {
  if (!options?.url) {
    return Promise.resolve()
  }
  const { id, query } = parsePageUrl(options.url)
  relaunchEntry(id, query)
  return Promise.resolve()
}

export function switchTab(options: { url: string }) {
  return redirectTo(options)
}

export function navigateBack(options?: { delta?: number }) {
  if (navigationHistory.length <= 1) {
    return Promise.resolve()
  }
  const delta = Math.max(1, options?.delta ?? 1)
  const targetIndex = Math.max(0, navigationHistory.length - 1 - delta)
  const target = navigationHistory[targetIndex]
  navigationHistory.length = targetIndex
  pushEntry(target.id, target.query)
  return Promise.resolve()
}

function getCurrentPagesInternal() {
  return navigationHistory
    .map(entry => entry.instance)
    .filter((instance): instance is ComponentPublicInstance => Boolean(instance))
}

function getAppInstance() {
  return appInstance
}

function getActiveNavigationBar() {
  const pages = getCurrentPagesInternal()
  const current = pages[pages.length - 1]
  if (!current) {
    return undefined
  }
  const renderRoot = (current as { renderRoot?: ShadowRoot }).renderRoot
    ?? current.shadowRoot
    ?? current
  if (!renderRoot || typeof (renderRoot as ParentNode).querySelector !== 'function') {
    return undefined
  }
  return (renderRoot as ParentNode).querySelector('weapp-navigation-bar') as HTMLElement | null
}

let warnedNavigationBarMissing = false
let toastHideTimer: ReturnType<typeof setTimeout> | undefined

const TOAST_ID = '__weapp_vite_web_toast__'
const TOAST_SELECTOR = `#${TOAST_ID}`
const LOADING_ID = '__weapp_vite_web_loading__'
const LOADING_SELECTOR = `#${LOADING_ID}`

function warnNavigationBarMissing(action: string) {
  if (warnedNavigationBarMissing) {
    return
  }
  warnedNavigationBarMissing = true
  const logger = (globalThis as { console?: Console }).console
  if (logger?.warn) {
    logger.warn(`[@weapp-vite/web] ${action} 需要默认导航栏支持，但当前页面未渲染 weapp-navigation-bar。`)
  }
}

export function setNavigationBarTitle(options: { title: string }) {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.setNavigationBarTitle')
    return Promise.resolve()
  }
  if (options?.title !== undefined) {
    bar.setAttribute('title', options.title)
  }
  return Promise.resolve()
}

export function setNavigationBarColor(options: {
  frontColor?: string
  backgroundColor?: string
  animation?: { duration?: number, timingFunction?: string }
}) {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.setNavigationBarColor')
    return Promise.resolve()
  }
  if (options?.frontColor) {
    bar.setAttribute('front-color', options.frontColor)
  }
  if (options?.backgroundColor) {
    bar.setAttribute('background-color', options.backgroundColor)
  }
  if (options?.animation) {
    const duration = typeof options.animation.duration === 'number'
      ? `${options.animation.duration}ms`
      : undefined
    const easing = options.animation.timingFunction
    if (duration) {
      bar.style.setProperty('--weapp-nav-transition-duration', duration)
    }
    if (easing) {
      bar.style.setProperty('--weapp-nav-transition-easing', easing)
    }
  }
  return Promise.resolve()
}

export function showNavigationBarLoading() {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.showNavigationBarLoading')
    return Promise.resolve()
  }
  bar.setAttribute('loading', 'true')
  return Promise.resolve()
}

export function hideNavigationBarLoading() {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.hideNavigationBarLoading')
    return Promise.resolve()
  }
  bar.removeAttribute('loading')
  return Promise.resolve()
}

function callWxAsyncSuccess<SuccessResult extends WxBaseResult>(
  options: WxAsyncOptions<SuccessResult> | undefined,
  result: SuccessResult,
) {
  options?.success?.(result)
  options?.complete?.(result)
  return result
}

function callWxAsyncFailure<SuccessResult extends WxBaseResult>(
  options: WxAsyncOptions<SuccessResult> | undefined,
  errMsg: string,
) {
  const result: WxBaseResult = { errMsg }
  options?.fail?.(result)
  options?.complete?.(result)
  return result
}

function normalizeDuration(duration: number | undefined, fallback: number) {
  if (typeof duration !== 'number' || Number.isNaN(duration)) {
    return fallback
  }
  return Math.max(0, duration)
}

function getToastElement() {
  if (typeof document === 'undefined') {
    return undefined
  }
  const existing = document.querySelector(TOAST_SELECTOR) as HTMLElement | null
  if (existing) {
    return existing
  }
  const toast = document.createElement('div')
  toast.setAttribute('id', TOAST_ID)
  toast.setAttribute('data-weapp-web-toast', 'true')
  toast.setAttribute('hidden', 'true')
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  if (!document.body) {
    return undefined
  }
  document.body.append(toast)
  return toast
}

function setToastVisible(toast: HTMLElement, visible: boolean) {
  if (visible) {
    toast.removeAttribute('hidden')
  }
  else {
    toast.setAttribute('hidden', 'true')
  }
  toast.setAttribute('style', [
    'position: fixed',
    'left: 50%',
    'top: 15%',
    'transform: translate(-50%, 0)',
    'max-width: min(560px, 90vw)',
    'padding: 10px 14px',
    'border-radius: 8px',
    'background: rgba(17, 24, 39, 0.9)',
    'color: #ffffff',
    'font-size: 14px',
    'line-height: 1.5',
    'text-align: center',
    'pointer-events: none',
    'z-index: 2147483646',
    `opacity: ${visible ? '1' : '0'}`,
  ].join(';'))
}

function hideToastElement() {
  const toast = getToastElement()
  if (!toast) {
    return
  }
  setToastVisible(toast, false)
}

function resolveToastPrefix(icon: ShowToastOptions['icon']) {
  if (icon === 'none') {
    return ''
  }
  if (icon === 'error') {
    return '[error] '
  }
  return '[ok] '
}

export function showToast(options?: ShowToastOptions) {
  const toast = getToastElement()
  const content = `${resolveToastPrefix(options?.icon)}${options?.title ?? ''}`.trim()
  if (toast) {
    toast.textContent = content
    setToastVisible(toast, true)
    if (toastHideTimer) {
      clearTimeout(toastHideTimer)
    }
    const duration = normalizeDuration(options?.duration, 1500)
    toastHideTimer = setTimeout(() => {
      hideToastElement()
      toastHideTimer = undefined
    }, duration)
  }
  const result = callWxAsyncSuccess(options, { errMsg: 'showToast:ok' })
  return Promise.resolve(result)
}

function getLoadingElement() {
  if (typeof document === 'undefined') {
    return undefined
  }
  const existing = document.querySelector(LOADING_SELECTOR) as HTMLElement | null
  if (existing) {
    return existing
  }
  if (!document.body) {
    return undefined
  }
  const loading = document.createElement('div')
  loading.setAttribute('id', LOADING_ID)
  loading.setAttribute('data-weapp-web-loading', 'true')
  loading.setAttribute('hidden', 'true')
  loading.setAttribute('role', 'status')
  loading.setAttribute('aria-live', 'polite')
  document.body.append(loading)
  return loading
}

function setLoadingVisible(
  loading: HTMLElement,
  visible: boolean,
  title: string,
  mask: boolean,
) {
  if (visible) {
    loading.removeAttribute('hidden')
  }
  else {
    loading.setAttribute('hidden', 'true')
  }
  loading.textContent = title
  loading.setAttribute('style', [
    'position: fixed',
    'left: 50%',
    'top: 45%',
    'transform: translate(-50%, -50%)',
    'min-width: 120px',
    'max-width: min(560px, 90vw)',
    'padding: 14px 18px',
    'border-radius: 10px',
    'background: rgba(17, 24, 39, 0.92)',
    'color: #ffffff',
    'font-size: 14px',
    'line-height: 1.5',
    'text-align: center',
    `pointer-events: ${mask ? 'auto' : 'none'}`,
    'z-index: 2147483647',
    `opacity: ${visible ? '1' : '0'}`,
    `box-shadow: ${mask ? '0 0 0 99999px rgba(0, 0, 0, 0.28)' : 'none'}`,
  ].join(';'))
}

export function showLoading(options?: ShowLoadingOptions) {
  const loading = getLoadingElement()
  if (loading) {
    setLoadingVisible(
      loading,
      true,
      options?.title?.trim() || '加载中',
      Boolean(options?.mask),
    )
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'showLoading:ok' }))
}

export function hideLoading(options?: WxAsyncOptions<WxBaseResult>) {
  const loading = getLoadingElement()
  if (loading) {
    setLoadingVisible(loading, false, loading.textContent ?? '', false)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'hideLoading:ok' }))
}

function getGlobalDialogHandlers() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  return {
    confirm: runtimeGlobal.confirm as ((message?: string) => boolean) | undefined,
    alert: runtimeGlobal.alert as ((message?: string) => void) | undefined,
  }
}

export function showModal(options?: ShowModalOptions) {
  const title = options?.title?.trim() ?? ''
  const content = options?.content?.trim() ?? ''
  const message = [title, content].filter(Boolean).join('\n\n') || ' '
  const showCancel = options?.showCancel !== false
  const { confirm, alert } = getGlobalDialogHandlers()

  let confirmed = true
  if (showCancel) {
    if (typeof confirm === 'function') {
      confirmed = confirm(message)
    }
  }
  else if (typeof alert === 'function') {
    alert(message)
  }

  const result: ShowModalSuccessResult = {
    errMsg: 'showModal:ok',
    confirm: confirmed,
    cancel: !confirmed,
  }
  return Promise.resolve(callWxAsyncSuccess(options, result))
}

async function writeClipboardData(data: string) {
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  if (runtimeNavigator?.clipboard && typeof runtimeNavigator.clipboard.writeText === 'function') {
    await runtimeNavigator.clipboard.writeText(data)
    return
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Clipboard API is unavailable in current environment.')
  }

  const execCommand = (document as Document & { execCommand?: (command: string) => boolean }).execCommand
  if (typeof execCommand !== 'function') {
    throw new TypeError('Clipboard API is unavailable in current environment.')
  }

  const textarea = document.createElement('textarea') as HTMLTextAreaElement
  textarea.value = data
  textarea.setAttribute('readonly', 'true')
  textarea.setAttribute('style', 'position: fixed; top: -9999px; left: -9999px; opacity: 0;')
  document.body.append(textarea)
  textarea.select?.()
  const copied = execCommand.call(document, 'copy')
  if (textarea.parentNode) {
    textarea.parentNode.removeChild(textarea)
  }
  if (!copied) {
    throw new Error('document.execCommand("copy") returned false.')
  }
}

export async function setClipboardData(options?: SetClipboardDataOptions) {
  const data = String(options?.data ?? '')
  try {
    await writeClipboardData(data)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `setClipboardData:fail ${message}`)
    return Promise.reject(failure)
  }
  return callWxAsyncSuccess(options, { errMsg: 'setClipboardData:ok' })
}

function resolveSystemName(userAgent: string) {
  if (/android/i.test(userAgent)) {
    return 'Android'
  }
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return 'iOS'
  }
  if (/windows/i.test(userAgent)) {
    return 'Windows'
  }
  if (/mac os x/i.test(userAgent)) {
    return 'macOS'
  }
  if (/linux/i.test(userAgent)) {
    return 'Linux'
  }
  return 'Unknown'
}

function resolvePlatformName(
  userAgent: string,
  runtimeNavigator: Navigator | undefined,
) {
  const navigatorWithUAData = runtimeNavigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const raw = navigatorWithUAData.userAgentData?.platform
    ?? runtimeNavigator?.platform
    ?? resolveSystemName(userAgent)
  const normalized = raw.toLowerCase()
  if (normalized.includes('android')) {
    return 'android'
  }
  if (normalized.includes('iphone') || normalized.includes('ipad') || normalized.includes('ios')) {
    return 'ios'
  }
  if (normalized.includes('win')) {
    return 'windows'
  }
  if (normalized.includes('mac')) {
    return 'mac'
  }
  if (normalized.includes('linux')) {
    return 'linux'
  }
  return normalized || 'web'
}

function normalizePositiveNumber(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return fallback
  }
  return value
}

export function getSystemInfoSync(): SystemInfo {
  const runtimeWindow = (typeof window !== 'undefined'
    ? window
    : globalThis) as {
    innerWidth?: number
    innerHeight?: number
    devicePixelRatio?: number
  }
  const runtimeScreen = (typeof screen !== 'undefined'
    ? screen
    : globalThis) as {
    width?: number
    height?: number
  }
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const userAgent = runtimeNavigator?.userAgent ?? ''
  const windowWidth = normalizePositiveNumber(
    runtimeWindow.innerWidth,
    normalizePositiveNumber(runtimeScreen.width, 0),
  )
  const windowHeight = normalizePositiveNumber(
    runtimeWindow.innerHeight,
    normalizePositiveNumber(runtimeScreen.height, 0),
  )
  const screenWidth = normalizePositiveNumber(runtimeScreen.width, windowWidth)
  const screenHeight = normalizePositiveNumber(runtimeScreen.height, windowHeight)

  return {
    brand: 'web',
    model: runtimeNavigator?.platform ?? 'web',
    pixelRatio: normalizePositiveNumber(runtimeWindow.devicePixelRatio, 1),
    screenWidth,
    screenHeight,
    windowWidth,
    windowHeight,
    statusBarHeight: 0,
    language: runtimeNavigator?.language ?? 'en',
    version: runtimeNavigator?.appVersion ?? userAgent,
    system: resolveSystemName(userAgent),
    platform: resolvePlatformName(userAgent, runtimeNavigator),
  }
}

const globalTarget = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {}

if (globalTarget) {
  const wxBridge = (globalTarget.wx as Record<string, unknown> | undefined) ?? {}
  Object.assign(wxBridge, {
    navigateTo,
    navigateBack,
    redirectTo,
    switchTab,
    reLaunch,
    setNavigationBarTitle,
    setNavigationBarColor,
    showNavigationBarLoading,
    hideNavigationBarLoading,
    showLoading,
    hideLoading,
    showModal,
    showToast,
    setClipboardData,
    getSystemInfoSync,
  })
  globalTarget.wx = wxBridge
  if (typeof globalTarget.getApp !== 'function') {
    globalTarget.getApp = getAppInstance
  }
  if (typeof globalTarget.getCurrentPages !== 'function') {
    globalTarget.getCurrentPages = getCurrentPagesInternal
  }
}
