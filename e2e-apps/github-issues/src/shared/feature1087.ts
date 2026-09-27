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
  useRouter().beforeEach((to) => {
    if (!to.path.includes('pages/feature-1087/')) {
      return
    }
    if (to.query.guard === 'abort') {
      feature1087Records.push({ phase: 'guard:abort', path: to.fullPath })
      return false
    }
    if (to.query.guard === 'redirect') {
      feature1087Records.push({ phase: 'guard:redirect', path: to.fullPath })
      return '/pages/feature-1087/index?feed=redirected'
    }
  })
}

/** 不等待已销毁源页的协议回包；结果由共享探针读取。 */
export function navigateFeature1087(url: string) {
  const router = useRouter()
  navigation.settled = false
  void router.push(url).then((failure) => {
    navigation.failed = Boolean(failure)
    navigation.path = router.currentRoute.fullPath
    navigation.settled = true
  }, (error: unknown) => {
    feature1087Errors.push(String(error))
    navigation.failed = true
    navigation.settled = true
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
      feature1087Records.push({ phase, path, routeEventId: event.routeEventId, openType: event.openType, webviewId: event.webviewId })
    })
  }
}
