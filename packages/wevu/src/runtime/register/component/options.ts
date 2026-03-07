import type { TemplateRefBinding } from '../../templateRefs'
import type { InternalRuntimeState, MiniProgramComponentRawOptions, PageFeatures } from '../../types'

interface PreparedComponentOptions {
  userMethods: Record<string, (...args: any[]) => any>
  userLifetimes: Record<string, any>
  userPageLifetimes: Record<string, any>
  userOptions: Record<string, any>
  restOptions: Record<string, any>
  topLevelMethods: Record<string, (...args: any[]) => any>
  templateRefs: TemplateRefBinding[] | undefined
  userObservers: Record<string, any> | undefined
  setupLifecycle: 'created' | 'attached'
  legacyCreated: unknown
  isPage: boolean
  features: PageFeatures
  userOnLoad: any
  userOnUnload: any
  userOnShow: any
  userOnHide: any
  userOnReady: any
  userOnSaveExitState: any
  userOnPullDownRefresh: any
  userOnReachBottom: any
  userOnPageScroll: any
  userOnRouteDone: any
  userOnTabItemTap: any
  userOnResize: any
  userOnShareAppMessage: any
  userOnShareTimeline: any
  userOnAddToFavorites: any
  applyExtraInstanceFields: (instance: InternalRuntimeState) => void
}

function cloneInstanceFieldValue(value: unknown, cache = new WeakMap<object, unknown>()): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }
  if (cache.has(value as object)) {
    return cache.get(value as object)
  }
  if (Array.isArray(value)) {
    const next: unknown[] = []
    cache.set(value, next)
    for (const item of value) {
      next.push(cloneInstanceFieldValue(item, cache))
    }
    return next
  }
  const next: Record<string, unknown> = {}
  cache.set(value as object, next)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    next[key] = cloneInstanceFieldValue(child, cache)
  }
  return next
}

export function getRuntimeOwnerLabel(instance: InternalRuntimeState) {
  const route = (instance as any).route
  if (typeof route === 'string' && route) {
    return route
  }
  const is = (instance as any).is
  if (typeof is === 'string' && is) {
    return is
  }
  return 'unknown'
}

export function prepareComponentOptions(mpOptions: MiniProgramComponentRawOptions): PreparedComponentOptions {
  const {
    methods: userMethods = {},
    lifetimes: userLifetimes = {},
    pageLifetimes: userPageLifetimes = {},
    options: userOptions = {},
    ...rest
  } = mpOptions

  const userOnLoad = (rest as any).onLoad
  const userOnUnload = (rest as any).onUnload
  const userOnShow = (rest as any).onShow
  const userOnHide = (rest as any).onHide
  const userOnReady = (rest as any).onReady
  const userOnSaveExitState = (rest as any).onSaveExitState
  const userOnPullDownRefresh = (rest as any).onPullDownRefresh
  const userOnReachBottom = (rest as any).onReachBottom
  const userOnPageScroll = (rest as any).onPageScroll
  const userOnRouteDone = (rest as any).onRouteDone
  const userOnTabItemTap = (rest as any).onTabItemTap
  const userOnResize = (rest as any).onResize
  const userOnShareAppMessage = (rest as any).onShareAppMessage
  const userOnShareTimeline = (rest as any).onShareTimeline
  const userOnAddToFavorites = (rest as any).onAddToFavorites
  const features = ((rest as any).features ?? {}) as PageFeatures
  const hasPageOnlyHooks = [
    userOnLoad,
    userOnUnload,
    userOnShow,
    userOnHide,
    userOnReady,
    userOnSaveExitState,
    userOnPullDownRefresh,
    userOnReachBottom,
    userOnPageScroll,
    userOnRouteDone,
    userOnTabItemTap,
    userOnResize,
    userOnShareAppMessage,
    userOnShareTimeline,
    userOnAddToFavorites,
  ].some(hook => typeof hook === 'function')
  const isPage = Boolean((rest as any).__wevu_isPage) || Object.keys(features ?? {}).length > 0 || hasPageOnlyHooks

  const restOptions: Record<string, any> = {
    ...(rest as any),
  }
  const preservedInstanceFieldKeys = new Set([
    'behaviors',
    'relations',
    'externalClasses',
    'options',
    'properties',
    'observers',
    'pureDataPattern',
    'virtualHost',
    'definitionFilter',
    'export',
    '__wevuTemplateRefs',
    'setupLifecycle',
    'features',
    '__wevu_isPage',
  ])
  const extraInstanceFieldEntries: Array<[string, unknown]> = []
  for (const [key, value] of Object.entries(restOptions)) {
    if (preservedInstanceFieldKeys.has(key)) {
      continue
    }
    if (typeof value === 'function') {
      continue
    }
    extraInstanceFieldEntries.push([key, value])
    delete restOptions[key]
  }

  const applyExtraInstanceFields = (instance: InternalRuntimeState) => {
    if (!extraInstanceFieldEntries.length) {
      return
    }
    for (const [key, value] of extraInstanceFieldEntries) {
      if (Object.prototype.hasOwnProperty.call(instance, key)) {
        continue
      }
      try {
        ;(instance as any)[key] = cloneInstanceFieldValue(value)
      }
      catch {
        // 忽略实例字段注入失败，避免阻断生命周期。
      }
    }
  }

  const moveToMethodsExcludes = new Set([
    'export',
    'definitionFilter',
    'onLoad',
    'onUnload',
    'onShow',
    'onHide',
    'onReady',
    'onSaveExitState',
    'onPullDownRefresh',
    'onReachBottom',
    'onPageScroll',
    'onRouteDone',
    'onTabItemTap',
    'onResize',
    'onShareAppMessage',
    'onShareTimeline',
    'onAddToFavorites',
  ])
  const topLevelMethods: Record<string, (...args: any[]) => any> = {}
  for (const [key, value] of Object.entries(restOptions)) {
    if (typeof value !== 'function' || moveToMethodsExcludes.has(key)) {
      continue
    }
    topLevelMethods[key] = value as (...args: any[]) => any
    delete restOptions[key]
  }
  const templateRefs = (restOptions as any).__wevuTemplateRefs as TemplateRefBinding[] | undefined
  delete (restOptions as any).__wevuTemplateRefs
  const userObservers = (restOptions as any).observers as Record<string, any> | undefined
  const setupLifecycle = (restOptions as any).setupLifecycle === 'created' ? 'created' : 'attached'
  delete (restOptions as any).setupLifecycle
  const legacyCreated = restOptions.created
  delete restOptions.features
  delete restOptions.created
  delete restOptions.onLoad
  delete restOptions.onUnload
  delete restOptions.onShow
  delete restOptions.onHide
  delete restOptions.onReady

  return {
    userMethods,
    userLifetimes,
    userPageLifetimes,
    userOptions,
    restOptions,
    topLevelMethods,
    templateRefs,
    userObservers,
    setupLifecycle,
    legacyCreated,
    isPage,
    features,
    userOnLoad,
    userOnUnload,
    userOnShow,
    userOnHide,
    userOnReady,
    userOnSaveExitState,
    userOnPullDownRefresh,
    userOnReachBottom,
    userOnPageScroll,
    userOnRouteDone,
    userOnTabItemTap,
    userOnResize,
    userOnShareAppMessage,
    userOnShareTimeline,
    userOnAddToFavorites,
    applyExtraInstanceFields,
  }
}
