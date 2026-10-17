import path from 'node:path'
import { normalizeWatchPath } from '../../utils/path'

function coversDirectory(parent: string, directory: string) {
  const relative = path.relative(parent, directory)
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  )
}

/**
 * 物理 watcher 只登记尚未覆盖的根目录；重复 add 会把待发现文件当作初始文件静默吸收。
 */
export function createAutoRoutesWatchDirectoryRegistry() {
  const watched = new Set<string>()
  return {
    add(directories: Iterable<string>) {
      const candidates = [...new Set([...directories].map(directory => normalizeWatchPath(
        path.isAbsolute(directory) ? directory : path.resolve(directory),
      )))]
      const additions = candidates.filter((directory, index) => (
        ![...watched].some(parent => coversDirectory(parent, directory))
        && !candidates.some((parent, parentIndex) => parent !== directory && coversDirectory(parent, directory)
          // Windows 上不同大小写的同一路径保留首次登记者。
          && (!coversDirectory(directory, parent) || parentIndex < index))
      ))
      for (const directory of additions) {
        watched.add(directory)
      }
      return additions
    },
  }
}
