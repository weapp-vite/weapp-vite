/**
 * 开发环境路径存在性缓存 TTL（毫秒）。
 */
export const DEV_PATH_EXISTS_TTL_MS = 250
/**
 * 生产环境路径存在性缓存 TTL（毫秒）。
 */
export const PROD_PATH_EXISTS_TTL_MS = 60_000

/**
 * 获取 pathExists 的缓存 TTL。
 */
export function getPathExistsTtlMs(config?: { isDev?: boolean }) {
  return config?.isDev ? DEV_PATH_EXISTS_TTL_MS : PROD_PATH_EXISTS_TTL_MS
}

/**
 * 获取 readFile 是否检查 mtime 的策略。
 */
export function getReadFileCheckMtime(config?: { isDev?: boolean }) {
  return Boolean(config?.isDev)
}
