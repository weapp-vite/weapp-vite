import { computed, ref } from '../reactivity'
import { getCurrentSetupContext, onAttached, onShow } from './hooks'
import { getCurrentMiniProgramPages, getMiniProgramGlobalObject } from './platform'

export interface PageStackSnapshot {
  canGoBack: boolean
  currentRoute: string
  stackLength: number
}

export interface UsePageStackOptions {
  autoRefresh?: boolean
}

export interface NavigationBarMetrics {
  navigationBarHeight: number
  navigationHeight: number
  statusBarHeight: number
}

export interface UseNavigationBarMetricsOptions {
  autoRefresh?: boolean
  defaultNavigationBarHeight?: number
  defaultStatusBarHeight?: number
}

interface MenuButtonRect {
  height?: number
  top?: number
}

function normalizeRoute(route?: string) {
  return route ? route.split('?')[0]?.replace(/^\/+/, '') ?? '' : ''
}

/**
 * 获取当前小程序页面栈的稳定快照。
 */
export function getCurrentPageStackSnapshot(): PageStackSnapshot {
  const pages = getCurrentMiniProgramPages()
  const currentPage = pages.at(-1)
  const stackLength = pages.length || 1
  return {
    canGoBack: stackLength > 1,
    currentRoute: normalizeRoute(currentPage?.route),
    stackLength,
  }
}

/**
 * 在 setup 中跟踪当前小程序页面栈状态。
 */
export function usePageStack(options: UsePageStackOptions = {}) {
  if (!getCurrentSetupContext()) {
    throw new Error('usePageStack() 必须在 setup() 的同步阶段调用')
  }

  const snapshot = getCurrentPageStackSnapshot()
  const currentRoute = ref(snapshot.currentRoute)
  const stackLength = ref(snapshot.stackLength)
  const canGoBack = computed(() => stackLength.value > 1)

  const refresh = () => {
    const nextSnapshot = getCurrentPageStackSnapshot()
    currentRoute.value = nextSnapshot.currentRoute
    stackLength.value = nextSnapshot.stackLength
  }

  if (options.autoRefresh ?? true) {
    onAttached(refresh)
    onShow(refresh)
  }

  return {
    canGoBack,
    currentRoute,
    refresh,
    stackLength,
  }
}

/**
 * 计算自定义导航栏所需的状态栏和胶囊占位高度。
 */
export function getNavigationBarMetrics(
  options: Omit<UseNavigationBarMetricsOptions, 'autoRefresh'> = {},
): NavigationBarMetrics {
  const defaultStatusBarHeight = options.defaultStatusBarHeight ?? 20
  const defaultNavigationBarHeight = options.defaultNavigationBarHeight ?? 44
  const miniProgramGlobal = getMiniProgramGlobalObject()
  const systemInfo = typeof miniProgramGlobal?.getSystemInfoSync === 'function'
    ? miniProgramGlobal.getSystemInfoSync()
    : {}
  const statusBarHeight = Number(systemInfo?.statusBarHeight || defaultStatusBarHeight)
  let menuButtonRect: MenuButtonRect | undefined

  try {
    menuButtonRect = typeof miniProgramGlobal?.getMenuButtonBoundingClientRect === 'function'
      ? miniProgramGlobal.getMenuButtonBoundingClientRect()
      : undefined
  }
  catch {}

  const menuTop = Number(menuButtonRect?.top || 0)
  const menuHeight = Number(menuButtonRect?.height || 0)
  const navigationBarHeight = menuTop > statusBarHeight && menuHeight > 0
    ? (menuTop - statusBarHeight) * 2 + menuHeight
    : defaultNavigationBarHeight

  return {
    navigationBarHeight,
    navigationHeight: statusBarHeight + navigationBarHeight,
    statusBarHeight,
  }
}

/**
 * 在 setup 中跟踪自定义导航栏尺寸。
 */
export function useNavigationBarMetrics(options: UseNavigationBarMetricsOptions = {}) {
  if (!getCurrentSetupContext()) {
    throw new Error('useNavigationBarMetrics() 必须在 setup() 的同步阶段调用')
  }

  const initialMetrics = getNavigationBarMetrics(options)
  const statusBarHeight = ref(initialMetrics.statusBarHeight)
  const navigationBarHeight = ref(initialMetrics.navigationBarHeight)
  const navigationHeight = computed(() => statusBarHeight.value + navigationBarHeight.value)

  const refresh = () => {
    const nextMetrics = getNavigationBarMetrics(options)
    statusBarHeight.value = nextMetrics.statusBarHeight
    navigationBarHeight.value = nextMetrics.navigationBarHeight
  }

  if (options.autoRefresh ?? true) {
    onAttached(refresh)
  }

  return {
    navigationBarHeight,
    navigationHeight,
    refresh,
    statusBarHeight,
  }
}
