export function resolveNavigationBarTitle(
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
