/** 缺失文件或其父目录属于同一可恢复的路径状态。 */
export function isMissingWatchPath(error: unknown) {
  return error !== null && typeof error === 'object' && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}
