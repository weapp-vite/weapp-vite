import fs from 'node:fs'

/** 使用宿主规范路径注册 watcher，避免 Windows 短路径与事件长路径前缀不一致导致 libuv 中止。 */
export function watchResolvedDirectory(directoryPath: string, listener: fs.WatchListener<string>) {
  try {
    return fs.watch(fs.realpathSync.native(directoryPath), listener)
  }
  catch (error) {
    // 构建器可能在目录遍历与 watcher 注册之间删除整个输出目录，下一次同步会重新发现它。
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}
