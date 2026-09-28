import { existsSync } from 'node:fs'
import path from 'pathe'
import picomatch from 'picomatch'
import { toPosixPath } from '../../utils'

/** 组件发现目录由 glob 的完整静态目录前缀决定，不能把半个文件名当作目录。 */
export function resolveAutoImportWatchTargets(srcRoot: string, globs: readonly string[], includeSrcRoot = false) {
  const targets = new Set<string>(includeSrcRoot ? [srcRoot] : [])
  for (const pattern of globs) {
    const scanned = picomatch.scan(toPosixPath(pattern).replace(/^\.\//, '').replace(/^\/+/, ''))
    // 服务使用 picomatch 的数组匹配；否定项可以匹配静态前缀之外的文件，不能据其前缀剪枝。
    targets.add(scanned.negated ? srcRoot : path.resolve(srcRoot, scanned.base || '.'))
  }
  return targets
}

function contains(parent: string, child: string) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('../') && relative !== '..' && !path.isAbsolute(relative))
}

/** 先监听已存在的父目录，再剪枝到组件目录，覆盖启动后的首次创建及删除后恢复。 */
export function createAutoImportSidecarPlan(targets: ReadonlySet<string>) {
  const roots = new Set<string>()
  for (const target of targets) {
    let root = path.dirname(target)
    while (!existsSync(root) && path.dirname(root) !== root) {
      root = path.dirname(root)
    }
    if (![...roots].some(existing => contains(existing, root))) {
      for (const existing of roots) {
        if (contains(root, existing)) {
          roots.delete(existing)
        }
      }
      roots.add(root)
    }
  }
  return {
    roots: [...roots],
    ignored: (file: string) => ![...targets].some(target => contains(target, file) || contains(file, target)),
  }
}
