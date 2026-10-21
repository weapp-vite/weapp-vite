import type { HeadlessHostRegistries } from '../host'
import type { HeadlessProjectDescriptor } from '../project'

/** 定义更新只解析已有路由，不触发普通导航的启动或 page-not-found 生命周期。 */
export function resolvePageDefinitionReloadRoute(project: HeadlessProjectDescriptor, route: string) {
  if (typeof route !== 'string' || !route.trim() || /[?#]/.test(route)) {
    throw new TypeError('Page definition reload requires a route path without query or hash.')
  }
  const normalized = route.trim().replace(/^\/+/, '')
  const record = project.routes.find(record => record.route === normalized)
  if (!record) {
    throw new Error(`Unknown page definition reload route: ${route}`)
  }
  return record
}

function restoreMap<K, V>(target: Map<K, V>, snapshot: Map<K, V>) {
  target.clear()
  for (const [key, value] of snapshot) {
    target.set(key, value)
  }
}

/** 仅替换目标 entry；失败恢复缓存和注册表，保留未变依赖的对象身份。 */
export function reloadPageModuleDefinition<T extends { source: string }>(options: {
  filePath: string
  route: string
  source: string | undefined
  cache: Map<string, T>
  registries: HeadlessHostRegistries
  execute: () => unknown
}) {
  const { filePath, route, source, cache, registries } = options
  const previous = cache.get(filePath)
  if (!previous || !registries.pages.has(route)) {
    throw new Error(`Cannot reload a page definition before it is loaded: ${route}`)
  }
  if (source === undefined) {
    throw new Error(`Missing page script for definition reload: ${route}`)
  }
  if (source === previous.source) {
    return false
  }
  const modules = new Map(cache)
  const pages = new Map(registries.pages)
  const components = new Map(registries.components)
  const app = registries.appDefinition
  cache.delete(filePath)
  registries.pages.delete(route)
  try {
    options.execute()
    return true
  }
  catch (error) {
    restoreMap(cache, modules)
    restoreMap(registries.pages, pages)
    restoreMap(registries.components, components)
    registries.appDefinition = app
    throw error
  }
}
