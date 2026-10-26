/** 将绝对路径转换为对应版本 watcher 私有映射的键，保留大小写及旧版表示。 */
export function watcherPathKey(watcher, file) {
  return watcher.events ? file.replaceAll('\\', '/') : file
}
