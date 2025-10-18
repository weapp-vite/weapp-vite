import type { ComponentOptions, ComponentPublicInstance } from './component'
import type { TemplateRenderer } from './template'
import { defineComponent } from './component'

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

const pageRegistry = new Map<string, PageRecord>()
const componentRegistry = new Map<string, ComponentRecord>()
const navigationHistory: PageStackEntry[] = []
let pageOrder: string[] = []
// eslint-disable-next-line ts/no-unused-vars
let activeEntry: PageStackEntry | undefined
let appInstance: AppRuntime | undefined
let appLaunched = false

const ROUTE_META_SYMBOL = Symbol('@weapp-vite/web:route-meta')
const PAGE_STATE_SYMBOL = Symbol('@weapp-vite/web:page-state')

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

function slugify(id: string, prefix: string) {
  const normalized = id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${prefix}-${normalized || 'index'}`
}

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

export function initializePageRoutes(ids: string[]) {
  pageOrder = Array.from(new Set(ids))
  if (!pageOrder.length) {
    return
  }
  if (!navigationHistory.length) {
    pushEntry(pageOrder[0], {})
  }
}

export function registerPage<T extends PageRawOptions | undefined>(options: T, meta: RegisterMeta): T {
  const tag = slugify(meta.id, 'wv-page')
  const template = meta.template ?? (() => '')
  const normalized = normalizePageOptions(options)
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
  const tag = slugify(meta.id, 'wv-component')
  const template = meta.template ?? (() => '')
  const component = normalizeComponentOptions(options)
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

const globalTarget = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {}

if (globalTarget) {
  const wxBridge = (globalTarget.wx as Record<string, unknown> | undefined) ?? {}
  Object.assign(wxBridge, {
    navigateTo,
    navigateBack,
    redirectTo,
    switchTab,
    reLaunch,
  })
  globalTarget.wx = wxBridge
  if (typeof globalTarget.getApp !== 'function') {
    globalTarget.getApp = getAppInstance
  }
  if (typeof globalTarget.getCurrentPages !== 'function') {
    globalTarget.getCurrentPages = getCurrentPagesInternal
  }
}
