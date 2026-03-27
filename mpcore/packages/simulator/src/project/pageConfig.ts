export interface HeadlessNavigationBarSnapshot {
  animation: {
    duration?: number
    timingFunction?: string
  } | null
  backgroundColor: string
  frontColor: string
  loading: boolean
  title: string
}

const DEFAULT_NAVIGATION_BAR_BACKGROUND_COLOR = '#ffffff'
const DEFAULT_NAVIGATION_BAR_FRONT_COLOR = '#000000'
const DEFAULT_NAVIGATION_BAR_FRONT_COLOR_WHITE = '#ffffff'

function resolveNavigationBarTitle(
  appConfig: Record<string, any>,
  pageConfig?: Record<string, any>,
) {
  if (typeof pageConfig?.navigationBarTitleText === 'string') {
    return pageConfig.navigationBarTitleText
  }
  if (typeof appConfig.window?.navigationBarTitleText === 'string') {
    return appConfig.window.navigationBarTitleText
  }
  return ''
}

function resolveNavigationBarBackgroundColor(
  appConfig: Record<string, any>,
  pageConfig?: Record<string, any>,
) {
  if (typeof pageConfig?.navigationBarBackgroundColor === 'string') {
    return pageConfig.navigationBarBackgroundColor
  }
  if (typeof appConfig.window?.navigationBarBackgroundColor === 'string') {
    return appConfig.window.navigationBarBackgroundColor
  }
  return DEFAULT_NAVIGATION_BAR_BACKGROUND_COLOR
}

function resolveNavigationBarFrontColor(
  appConfig: Record<string, any>,
  pageConfig?: Record<string, any>,
) {
  const textStyle = typeof pageConfig?.navigationBarTextStyle === 'string'
    ? pageConfig.navigationBarTextStyle
    : typeof appConfig.window?.navigationBarTextStyle === 'string'
      ? appConfig.window.navigationBarTextStyle
      : undefined

  if (textStyle === 'white') {
    return DEFAULT_NAVIGATION_BAR_FRONT_COLOR_WHITE
  }

  return DEFAULT_NAVIGATION_BAR_FRONT_COLOR
}

export function cloneNavigationBarSnapshot(snapshot: HeadlessNavigationBarSnapshot) {
  return {
    animation: snapshot.animation
      ? { ...snapshot.animation }
      : null,
    backgroundColor: snapshot.backgroundColor,
    frontColor: snapshot.frontColor,
    loading: snapshot.loading,
    title: snapshot.title,
  }
}

export function resolveNavigationBarSnapshot(
  appConfig: Record<string, any>,
  pageConfig?: Record<string, any>,
): HeadlessNavigationBarSnapshot {
  return {
    animation: null,
    backgroundColor: resolveNavigationBarBackgroundColor(appConfig, pageConfig),
    frontColor: resolveNavigationBarFrontColor(appConfig, pageConfig),
    loading: false,
    title: resolveNavigationBarTitle(appConfig, pageConfig),
  }
}

export { resolveNavigationBarTitle }
