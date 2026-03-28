import type { ConfigService } from '../config/types'
import path from 'pathe'

const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const VIRTUAL_MODULE_ID = 'virtual:weapp-vite-auto-routes'
const RESOLVED_VIRTUAL_ID = '\0weapp-vite:auto-routes'

/**
 * 判断当前是否应按 watch 模式为 auto-routes 注册依赖文件。
 */
export function isAutoRoutesWatchMode(
  configService?: Pick<ConfigService, 'inlineConfig' | 'isDev'>,
) {
  return Boolean(configService?.isDev || configService?.inlineConfig?.build?.watch)
}

/**
 * 合并 service 与 matcher 提供的监听目录，并去重保留顺序。
 */
export function collectAutoRoutesWatchDirs(
  watchDirectories: Iterable<string>,
  matcherWatchRoots: Iterable<string>,
) {
  const watchDirs = new Set<string>()

  for (const dir of watchDirectories) {
    watchDirs.add(dir)
  }

  for (const dir of matcherWatchRoots) {
    watchDirs.add(dir)
  }

  return [...watchDirs]
}

/**
 * 过滤出真正需要交给 auto-routes watcher 处理的路由 Vue 文件。
 */
export function isAutoRoutesWatchFile(
  filePath: string,
  allowedExtensions: ReadonlySet<string>,
  isPagesRelatedPath: (id: string) => boolean,
) {
  return allowedExtensions.has(path.extname(filePath)) && isPagesRelatedPath(filePath)
}

/**
 * 统一解析 auto-routes 虚拟模块与 alias 入口的命中关系。
 */
export function resolveAutoRoutesVirtualId(
  id: string,
  aliasTargets: ReadonlySet<string>,
) {
  if (id === AUTO_ROUTES_ID || id === VIRTUAL_MODULE_ID || id === RESOLVED_VIRTUAL_ID) {
    return RESOLVED_VIRTUAL_ID
  }

  return aliasTargets.has(id) ? RESOLVED_VIRTUAL_ID : null
}

/**
 * 将 create/delete 这类结构性变化映射为 auto-routes 的全量重扫语义。
 */
export function resolveAutoRoutesWatchChangeEvent(event?: string) {
  if (event === 'create' || event === 'delete') {
    return 'rename'
  }

  return undefined
}

/**
 * 判断某次热更新是否需要触发 auto-routes 虚拟模块失效。
 */
export function resolveAutoRoutesHotUpdateAction(
  command: 'serve' | 'build' | undefined,
  options: {
    isRouteFile: boolean
    isPagesRelatedPath: boolean
  },
) {
  if (command === 'serve') {
    return options.isRouteFile
      ? { shouldHandle: true, shouldUpdateRouteFile: true }
      : { shouldHandle: false, shouldUpdateRouteFile: false }
  }

  if (options.isRouteFile || options.isPagesRelatedPath) {
    return { shouldHandle: true, shouldUpdateRouteFile: false }
  }

  return { shouldHandle: false, shouldUpdateRouteFile: false }
}

export {
  AUTO_ROUTES_ID,
  RESOLVED_VIRTUAL_ID,
  VIRTUAL_MODULE_ID,
}
