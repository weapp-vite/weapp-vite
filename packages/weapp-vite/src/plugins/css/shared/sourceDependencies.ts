import type { ModuleGraphService } from '../../../moduleGraph/service'
import { normalizeSourceId } from '../../../moduleGraph/traversal'

interface SharedStyleDependency {
  source: string
  dependencies: Iterable<string>
}

const owners = new WeakMap<ModuleGraphService, Set<string>>()

/** 共享样式资产持有自身及预处理依赖的失效归属，每代替换并释放已移除资产。 */
export function replaceSharedStyleDependencies(graph: ModuleGraphService | undefined, styles: Iterable<SharedStyleDependency>) {
  if (!graph) {
    return
  }
  const previous = owners.get(graph)
  const next = new Map<string, Set<string>>()
  for (const { source, dependencies } of styles) {
    const owner = normalizeSourceId(source)
    const sources = next.get(owner) ?? new Set<string>()
    sources.add(source)
    for (const dependency of dependencies) {
      sources.add(dependency)
    }
    next.set(owner, sources)
  }
  for (const [owner, sources] of next) {
    graph.replaceEntryDependencies(owner, 'style', sources)
  }
  for (const owner of previous ?? []) {
    if (!next.has(owner)) {
      graph.replaceEntryDependencies(owner, 'style', [])
    }
  }
  owners.set(graph, new Set(next.keys()))
}
