import path from 'pathe'
import { normalizePath } from '../../utils/path'
import { resolveRealpath, withRealpathScope } from '../../utils/realpathScope'

/** 静态复制按物理文件比较；虚拟或已移除的来源没有物理身份。 */
export function readAssetPhysicalPath(file: string): string | undefined {
  if (path.isAbsolute(file)) {
    try {
      return normalizePath(resolveRealpath(file))
    }
    catch {
      return undefined
    }
  }
  return undefined
}

/** 仅排除已命名的同一物理文件，保留其他具有独立路径的静态文件。 */
export function excludeLinkedAssetCopies(files: string[], unmatched: string[], emitted: ReadonlySet<string>) {
  return withRealpathScope(() => {
    const copyPaths = new Set(files.map(normalizePath))
    const physicalSources = new Set<string>()
    for (const source of emitted) {
      if (!copyPaths.has(source)) {
        const physical = readAssetPhysicalPath(source)
        if (physical) {
          physicalSources.add(physical)
        }
      }
    }
    if (!physicalSources.size) {
      return unmatched
    }
    return unmatched.filter((file) => {
      const normalized = normalizePath(file)
      return !physicalSources.has(normalized) && !physicalSources.has(readAssetPhysicalPath(file) ?? normalized)
    })
  })
}
