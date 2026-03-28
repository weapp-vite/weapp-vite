import type { ConfigService } from '../config/types'
import path from 'pathe'

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
