import type { ScrollRestorationController } from 'wevu/router'
import { createScrollRestoration, useRouter } from 'wevu/router'

export interface Feature1087Record {
  phase: string
  instance?: number
  path?: string
  routeEventId?: string
  openType?: string
  webviewId?: number
  ready?: boolean
  contentReady?: boolean
  primaryTop?: number
  secondaryTop?: number
}

let controller: ScrollRestorationController
export const feature1087Records: Feature1087Record[] = []
export const feature1087Errors: string[] = []
const navigation = { settled: true, failed: false, path: '' }
const observedRenderers = new Map<string, string>()
const navigationDiagnostics: Record<string, unknown>[] = []
let diagnosticNavigation = 0
let nativeNavigationObserved = false

/** 诊断只保存值，不保留页面、宿主返回对象或错误栈。 */
function traceFeature1087Navigation(phase: string, detail: Record<string, unknown> = {}) {
  try {
    navigationDiagnostics.push({
      phase,
      at: Date.now(),
      navigationId: diagnosticNavigation,
      navigation: { ...navigation },
      ...detail,
    })
  }
  catch {
    // 诊断失败不得改变原导航返回值、回调或异常。
  }
}

/** 只摘录错误值；调用方输出时统一脱敏，不采集 stack。 */
function navigationDiagnosticError(error: unknown) {
  try {
    if (!error || typeof error !== 'object') {
      return String(error)
    }
    const value = error as Record<string, unknown>
    const result: Record<string, string | number | boolean | null | undefined> = {}
    for (const key of ['name', 'message', 'errMsg', 'errCode', 'errno']) {
      const field = value[key]
      result[key] = field === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof field)
        ? field as string | number | boolean | null | undefined
        : '<non-primitive>'
    }
    return result
  }
  catch {
    return '<unprintable>'
  }
}

/** 仅观察 fixture 的公开 nativeRouter；不替换返回值、不等待额外 Promise。 */
function observeFeature1087NativeNavigation() {
  if (nativeNavigationObserved) {
    return
  }
  nativeNavigationObserved = true
  interface NativeOptions {
    url: string
    success?: (...args: unknown[]) => unknown
    fail?: (...args: unknown[]) => unknown
    [key: string]: unknown
  }
  const nativeRouter = useRouter().nativeRouter as unknown as {
    navigateTo: (options: NativeOptions) => unknown
  }
  const original = nativeRouter.navigateTo
  nativeRouter.navigateTo = function (options) {
    if (!options.url.includes('pages/feature-1087/')) {
      return original.call(this, options)
    }
    const navigationId = diagnosticNavigation
    const detail = { navigationId, url: options.url }
    traceFeature1087Navigation('native:dispatch', detail)
    try {
      const result = original.call(this, {
        ...options,
        success(this: unknown, ...args) {
          traceFeature1087Navigation('native:success:enter', detail)
          try {
            return options.success?.apply(this, args)
          }
          finally {
            traceFeature1087Navigation('native:success:return', detail)
          }
        },
        fail(this: unknown, ...args) {
          traceFeature1087Navigation('native:fail:enter', { ...detail, error: navigationDiagnosticError(args[0]) })
          try {
            return options.fail?.apply(this, args)
          }
          finally {
            traceFeature1087Navigation('native:fail:return', detail)
          }
        },
      })
      try {
        const then = result && (result as PromiseLike<unknown>).then
        traceFeature1087Navigation('native:return', { ...detail, thenable: typeof then === 'function' })
        if (typeof then === 'function') {
          void then.call(result, () => traceFeature1087Navigation('native:then:fulfilled', detail), (error: unknown) => traceFeature1087Navigation('native:then:rejected', { ...detail, error: navigationDiagnosticError(error) }))
        }
      }
      catch (error) {
        traceFeature1087Navigation('native:observation-failed', { ...detail, error: navigationDiagnosticError(error) })
      }
      return result
    }
    catch (error) {
      traceFeature1087Navigation('native:throw', { ...detail, error: navigationDiagnosticError(error) })
      throw error
    }
  }
}
let nextInstance = 0
let releaseRestore: (() => void) | undefined

/** 初始化独立的滚动 fixture controller，不改变应用的 router 配置。 */
export function initializeFeature1087() {
  controller = createScrollRestoration({
    router: useRouter(),
    onError: error => feature1087Errors.push(String(error)),
  })
}

/** 读取当前场景的 controller，避免重置后复用已释放实例。 */
export function getFeature1087Controller() {
  return controller
}

export function releaseFeature1087Restore() {
  releaseRestore?.()
  releaseRestore = undefined
}

/** 仅由没有滚动注册的原生中转页重置场景。 */
export function resetFeature1087() {
  controller.dispose()
  releaseFeature1087Restore()
  feature1087Records.length = 0
  feature1087Errors.length = 0
  navigationDiagnostics.length = 0
  diagnosticNavigation = 0
  navigation.settled = true
  navigation.failed = false
  navigation.path = ''
  initializeFeature1087()
}

export function allocateFeature1087Instance() {
  return ++nextInstance
}

/** 守卫只匹配 feature 页面 query，不影响已有 Issue fixture 的路由行为。 */
export function installFeature1087Guards() {
  observeFeature1087NativeNavigation()
  const router = useRouter()
  router.beforeEach((route) => {
    const to = route!
    if (!to.path.includes('pages/feature-1087/')) {
      return
    }
    traceFeature1087Navigation('guard:enter', { to: to.fullPath })
    if (to.query.guard === 'abort') {
      feature1087Records.push({ phase: 'guard:abort', path: to.fullPath })
      traceFeature1087Navigation('guard:return', { to: to.fullPath, result: 'abort' })
      return false
    }
    if (to.query.guard === 'redirect') {
      feature1087Records.push({ phase: 'guard:redirect', path: to.fullPath })
      traceFeature1087Navigation('guard:return', { to: to.fullPath, result: '/pages/feature-1087/index?feed=redirected' })
      return '/pages/feature-1087/index?feed=redirected'
    }
    traceFeature1087Navigation('guard:return', { to: to.fullPath, result: 'continue' })
  })
  router.afterEach((to, from, failure) => {
    if (to?.path.includes('pages/feature-1087/')) {
      traceFeature1087Navigation('router:afterEach:enter', { to: to.fullPath, from: from.fullPath, failed: Boolean(failure) })
      traceFeature1087Navigation('router:afterEach:return', { to: to.fullPath })
    }
  })
}

/** 不等待已销毁源页的协议回包；结果由共享探针读取。 */
export function navigateFeature1087(url: string) {
  const router = useRouter()
  const navigationId = ++diagnosticNavigation
  traceFeature1087Navigation('probe:navigate', { navigationId, url })
  navigation.settled = false
  traceFeature1087Navigation('probe:pending', { navigationId, url })
  const pending = router.push(url)
  traceFeature1087Navigation('router:promise-returned', { navigationId, url })
  void pending.then((failure) => {
    traceFeature1087Navigation('router:resolved', { navigationId, url, failed: Boolean(failure) })
    navigation.failed = Boolean(failure)
    navigation.path = router.currentRoute.fullPath
    navigation.settled = true
    traceFeature1087Navigation('probe:settled', { navigationId, url })
  }, (error: unknown) => {
    traceFeature1087Navigation('router:rejected', { navigationId, url, error: navigationDiagnosticError(error) })
    feature1087Errors.push(String(error))
    navigation.failed = true
    navigation.settled = true
    traceFeature1087Navigation('probe:settled', { navigationId, url })
  })
}

/** 用业务完成信号控制异步 restore，不使用计时器模拟内容就绪。 */
export function waitFeature1087Restore() {
  return new Promise<void>((resolve) => {
    releaseRestore = resolve
  })
}

export function readFeature1087Probe() {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  const host = wx as unknown as Record<string, unknown>
  const apiNames = [
    'onBeforeAppRoute',
    'offBeforeAppRoute',
    'onBeforePageUnload',
    'offBeforePageUnload',
    'onAppRoute',
    'offAppRoute',
    'onAppRouteDone',
    'offAppRouteDone',
  ]
  const apis: Record<string, string> = {}
  for (const name of apiNames) {
    apis[name] = typeof host[name]
  }
  return {
    SDKVersion: wx.getAppBaseInfo().SDKVersion,
    platform: wx.getDeviceInfo().platform,
    renderer: observedRenderers.get(page?.route ?? '') ?? null,
    route: page?.route,
    automatic: controller.automatic,
    apis,
    records: feature1087Records.slice(),
    errors: feature1087Errors.slice(),
    navigation: { ...navigation },
    navigationDiagnostics: navigationDiagnostics.slice(),
    nativePages: pages.map(item => ({ route: item.route, query: { ...item.options } })),
  }
}

/** 只记录公开宿主事件，不保存原生页面对象，避免探针延长页面生命周期。 */
export function observeFeature1087Routes() {
  interface RouteEvent {
    path?: string
    page?: { route?: string }
    routeEventId?: string
    openType?: string
    webviewId?: number
    renderer?: string
  }
  // 宿主新版路由事件尚未包含在 fixture 的微信类型声明中。
  const host = wx as unknown as Record<string, ((callback: (event: RouteEvent) => void) => void) | undefined>
  for (const phase of ['BeforeAppRoute', 'BeforePageUnload', 'AppRoute', 'AppRouteDone']) {
    host[`on${phase}`]?.((event) => {
      const path = String(event.path ?? event.page?.route ?? '').replace(/^\/+/, '')
      if (!path.includes('feature-1087')) {
        return
      }
      if (typeof event.renderer === 'string') {
        observedRenderers.set(path, event.renderer)
      }
      traceFeature1087Navigation(`host:${phase}`, { path, routeEventId: event.routeEventId, openType: event.openType, webviewId: event.webviewId })
      feature1087Records.push({ phase, path, routeEventId: event.routeEventId, openType: event.openType, webviewId: event.webviewId })
    })
  }
}
