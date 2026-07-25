import type { PageStackEntry } from './options'

export type WebRoutingMode = 'memory' | 'history' | 'hash'

export interface WebRoutingConfig {
  mode?: WebRoutingMode
  /** 部署目录前缀，例如 /mini-program。 */
  base?: string
}

export interface ResolvedWebRoutingConfig {
  mode: WebRoutingMode
  base: string
}

export interface WebRouteTarget {
  id: string
  query: Record<string, string>
}

export interface WebRouteHistoryState {
  __weappWebRuntime?: {
    stack: WebRouteTarget[]
  }
}

const DEFAULT_CONFIG: ResolvedWebRoutingConfig = {
  mode: 'memory',
  base: '/',
}

let resolvedConfig = { ...DEFAULT_CONFIG }
let knownPageIds = new Set<string>()
let popstateHandler: (() => void) | undefined
let hashchangeHandler: (() => void) | undefined
let scrollRestorationHistory: History | undefined
let previousScrollRestoration: ScrollRestoration | undefined

function normalizeBase(base?: string) {
  if (!base?.trim()) {
    return '/'
  }
  const normalized = base.trim().replace(/\\/g, '/').replace(/^\/*/, '/').replace(/\/*$/, '')
  return normalized || '/'
}

export function resolveWebRoutingConfig(config?: WebRoutingConfig): ResolvedWebRoutingConfig {
  return {
    mode: config?.mode === 'history' || config?.mode === 'hash' ? config.mode : 'memory',
    base: normalizeBase(config?.base),
  }
}

function isBrowserHistoryAvailable() {
  return typeof window !== 'undefined'
    && typeof window.history?.pushState === 'function'
    && typeof window.history?.replaceState === 'function'
}

function bindManualScrollRestoration() {
  if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) {
    return
  }
  scrollRestorationHistory = window.history
  previousScrollRestoration = window.history.scrollRestoration
  window.history.scrollRestoration = 'manual'
}

function restoreBrowserScrollRestoration() {
  if (scrollRestorationHistory && previousScrollRestoration) {
    scrollRestorationHistory.scrollRestoration = previousScrollRestoration
  }
  scrollRestorationHistory = undefined
  previousScrollRestoration = undefined
}

function normalizePath(path: string) {
  const decoded = decodeURIComponent(path || '/')
  const withoutQuery = decoded.split('?')[0] ?? '/'
  const withoutLeading = withoutQuery.replace(/^\/+/, '').replace(/\/+$/, '')
  return withoutLeading.replace(/\.html$/, '')
}

function parseQuery(search: string) {
  const query: Record<string, string> = {}
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  for (const [key, value] of params.entries()) {
    query[key] = value
  }
  return query
}

function toQueryString(query: Record<string, string>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value)
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

function resolvePageId(path: string) {
  const normalized = normalizePath(path)
  if (knownPageIds.has(normalized)) {
    return normalized
  }
  const indexId = `${normalized}/index`
  if (knownPageIds.has(indexId)) {
    return indexId
  }
  return undefined
}

function resolveTargetFromUrl(url: URL) {
  if (resolvedConfig.mode === 'hash') {
    const rawHash = url.hash.replace(/^#\/?/, '')
    const [path, query = ''] = rawHash.split('?')
    const id = resolvePageId(path ?? '')
    return id ? { id, query: parseQuery(query) } : undefined
  }

  const base = resolvedConfig.base === '/' ? '' : resolvedConfig.base
  const matchesBase = !base || url.pathname === base || url.pathname.startsWith(`${base}/`)
  const path = matchesBase ? url.pathname.slice(base.length) : url.pathname
  const id = resolvePageId(path)
  return id ? { id, query: parseQuery(url.search) } : undefined
}

export function readWebRouteTarget(pageIds: string[], url?: string): WebRouteTarget | undefined {
  knownPageIds = new Set(pageIds)
  if (resolvedConfig.mode === 'memory' || typeof URL === 'undefined') {
    return undefined
  }
  const runtimeUrl = url ?? (typeof window !== 'undefined' ? window.location.href : undefined)
  if (!runtimeUrl) {
    return undefined
  }
  try {
    return resolveTargetFromUrl(new URL(runtimeUrl, 'http://weapp-vite.local'))
  }
  catch {
    return undefined
  }
}

function formatRouteUrl(target: WebRouteTarget) {
  const query = toQueryString(target.query)
  const path = `${target.id}${query}`
  if (resolvedConfig.mode === 'hash') {
    const prefix = resolvedConfig.base === '/' ? '' : resolvedConfig.base
    return `${prefix}/#/${path}`
  }
  const prefix = resolvedConfig.base === '/' ? '' : resolvedConfig.base
  return `${prefix}/${path}`
}

function toHistoryState(entries: PageStackEntry[]): WebRouteHistoryState {
  return {
    __weappWebRuntime: {
      stack: entries.map(entry => ({
        id: entry.id,
        query: { ...entry.query },
      })),
    },
  }
}

function resolveCurrentUrl() {
  if (typeof window === 'undefined') {
    return undefined
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function disposeWebRouting() {
  if (typeof window !== 'undefined') {
    if (popstateHandler) {
      window.removeEventListener('popstate', popstateHandler)
    }
    if (hashchangeHandler) {
      window.removeEventListener('hashchange', hashchangeHandler)
    }
  }
  popstateHandler = undefined
  hashchangeHandler = undefined
  restoreBrowserScrollRestoration()
  resolvedConfig = { ...DEFAULT_CONFIG }
  knownPageIds = new Set()
}

export function configureWebRouting(
  config: WebRoutingConfig | undefined,
  pageIds: string[],
  onPopState: (target: WebRouteTarget | undefined, state: WebRouteHistoryState | undefined) => void,
) {
  disposeWebRouting()
  resolvedConfig = resolveWebRoutingConfig(config)
  knownPageIds = new Set(pageIds)
  if (resolvedConfig.mode === 'memory' || typeof window === 'undefined') {
    return resolvedConfig
  }

  bindManualScrollRestoration()

  popstateHandler = () => {
    const state = window.history.state as WebRouteHistoryState | undefined
    onPopState(readWebRouteTarget(pageIds), state)
  }
  window.addEventListener('popstate', popstateHandler)
  if (resolvedConfig.mode === 'hash') {
    hashchangeHandler = () => {
      const state = window.history.state as WebRouteHistoryState | undefined
      onPopState(readWebRouteTarget(pageIds), state)
    }
    window.addEventListener('hashchange', hashchangeHandler)
  }
  return resolvedConfig
}

export function syncWebRouting(entries: PageStackEntry[], operation: 'push' | 'replace') {
  if (resolvedConfig.mode === 'memory' || !isBrowserHistoryAvailable() || !entries.length) {
    return
  }
  const target = entries[entries.length - 1]!
  const url = formatRouteUrl({ id: target.id, query: target.query })
  const state = toHistoryState(entries)
  if (operation === 'push') {
    window.history.pushState(state, '', url)
  }
  else {
    window.history.replaceState(state, '', url)
  }
}

export function getWebHistoryStack(state: WebRouteHistoryState | undefined) {
  const stack = state?.__weappWebRuntime?.stack
  return Array.isArray(stack) ? stack : undefined
}

export function getWebRoutingConfig() {
  return { ...resolvedConfig }
}

export function getWebRoutingUrl() {
  return resolveCurrentUrl()
}
