const PRIVATE_PLUGIN_ROUTE_RE = /^plugin-private:\/\/([^/]+)\/(.+)$/

/** 将内部插件路由映射为 DevTools 页面协议路径，保留 AppService 实例路由。 */
export function resolveTestingPagePath(route: string) {
  return route.replace(PRIVATE_PLUGIN_ROUTE_RE, '__plugin__/$1/$2')
}
