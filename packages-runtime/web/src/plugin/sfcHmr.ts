import type { ModuleNode } from 'vite'
import type { WebDevServer } from './hostTypes'
import type { ScanState } from './types'
import { normalizePath } from './path'
import { resolveWebVueSfcStyleLanguage } from './vueSfc'

function reachesSfcOwner(module: ModuleNode, owners: Set<ModuleNode>) {
  const pending = [module]
  const visited = new Set<ModuleNode>()
  while (pending.length) {
    const current = pending.pop()!
    if (owners.has(current)) {
      return true
    }
    if (!visited.has(current)) {
      visited.add(current)
      pending.push(...current.importers)
    }
  }
  return false
}

/** 只将仍连接到 SFC 注册模块的派生节点交给 Vite，避免删除恢复后旧节点触发额外刷新。 */
export function collectSfcHmrModules<Module extends object>(
  state: ScanState,
  changedFile: string,
  graph: NonNullable<WebDevServer['moduleGraph']>,
  modules?: Module[],
) {
  const changed = normalizePath(changedFile)
  const owners = new Set<ModuleNode>()
  const candidates = new Set<ModuleNode>()
  for (const [filename, result] of state.sfcResults) {
    if (filename !== changed && !result.meta?.sfcSrcDeps?.some(dependency => normalizePath(dependency) === changed)) {
      continue
    }
    for (const file of [filename, `${filename}.${resolveWebVueSfcStyleLanguage(result, filename)}`]) {
      for (const module of graph.getModulesByFile(file) ?? []) {
        candidates.add(module)
        if (module.id && normalizePath(module.id) === filename) {
          owners.add(module)
        }
      }
    }
  }
  const affected = new Set(modules)
  for (const module of candidates) {
    // Vite 的 unlink 会拆除反向依赖，但保留旧文件节点；仅有节点身份不能证明它仍属于当前 SFC。
    if (reachesSfcOwner(module, owners)) {
      affected.add(module as Module)
    }
    else {
      affected.delete(module as Module)
    }
  }
  return [...affected]
}
