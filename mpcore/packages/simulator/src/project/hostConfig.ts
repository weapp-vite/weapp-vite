/**
 * @description 根据构建后的 app.json 创建模拟器提供给小程序脚本读取的宿主配置。
 * 微信开发者工具的 tabBar 页面路径通常带有 `.html` 后缀，保留该形态以覆盖路由归一化边界。
 */
export function createMiniProgramHostConfig(
  appConfig: Record<string, any>,
  override?: unknown,
): Record<string, any> {
  const appTabBar = appConfig.tabBar && typeof appConfig.tabBar === 'object'
    ? appConfig.tabBar
    : undefined
  const tabBar = appTabBar
    ? {
        ...appTabBar,
        ...(Array.isArray(appTabBar.list)
          ? {
              list: appTabBar.list.map((item: any) => {
                if (!item || typeof item !== 'object') {
                  return item
                }
                const pagePath = typeof item.pagePath === 'string'
                  ? item.pagePath.replace(/^\/+/, '').replace(/\.html$/, '')
                  : undefined
                return pagePath
                  ? { ...item, pagePath: `${pagePath}.html` }
                  : { ...item }
              }),
            }
          : {}),
      }
    : undefined
  const generated = {
    ...appConfig,
    ...(tabBar ? { tabBar } : {}),
  }
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return generated
  }
  const overrideRecord = override as Record<string, any>
  return {
    ...generated,
    ...overrideRecord,
    ...(generated.tabBar || overrideRecord.tabBar
      ? {
          tabBar: {
            ...(generated.tabBar ?? {}),
            ...(overrideRecord.tabBar ?? {}),
          },
        }
      : {}),
  }
}
