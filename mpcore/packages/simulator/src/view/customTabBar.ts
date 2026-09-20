export function customTabBarScopeId(route: string) {
  return `page:${route.replace(/^\/+/, '')}/custom-tab-bar`
}

export function hasCustomTabBar(appConfig: Record<string, any>, route: string) {
  const tabBar = appConfig.tabBar
  return tabBar?.custom === true && Array.isArray(tabBar.list)
    && tabBar.list.some((item: { pagePath?: string }) => item.pagePath === route.replace(/^\/+/, ''))
}

export function customTabBarHostScope() {
  return {
    data: {},
    genericComponents: new Map([['custom-tab-bar', 'custom-tab-bar/index']]),
    getMethod: () => undefined,
    getScopeId: () => 'tabbar-root',
  }
}
