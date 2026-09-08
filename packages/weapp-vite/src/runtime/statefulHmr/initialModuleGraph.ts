import type { PluginContext, RenderedChunk } from 'rolldown'
import path from 'pathe'

/** 显式约束引擎与首包依赖图的模块 ID 根目录，避免编程调用退回进程 cwd。 */
export function resolveStatefulHmrModuleRoot(root: string, cwd?: string): string {
  return cwd === undefined ? root : path.resolve(cwd)
}

export function toStableModuleId(id: string, root: string): string {
  const normalizedId = id.replaceAll('\\', '/')
  const absolute = path.posix.isAbsolute(normalizedId) || /^[A-Z]:\//i.test(normalizedId)
  if (normalizedId.startsWith('\0') || !absolute) {
    return normalizedId
  }
  return path.posix.relative(root.replaceAll('\\', '/'), normalizedId)
}

/** Rolldown 的初始 CJS 输出缺少图前导，在原生 renderChunk 阶段补齐与 HMR payload 相同的图协议。 */
export function createStatefulHmrInitialGraph(
  chunk: Pick<RenderedChunk, 'moduleIds'>,
  context: Pick<PluginContext, 'getModuleInfo'>,
  root: string,
): string {
  // bundler 合成的 runtime helper 不属于可执行源码模块图，getModuleInfo 按契约返回 null。
  const modules = chunk.moduleIds.flatMap((id) => {
    const info = context.getModuleInfo(id)
    return info ? [{ id, info }] : []
  })
  const ids = modules.map(({ id }) => toStableModuleId(id, root))
  const indices = new Map(ids.map((id, index) => [id, index]))
  const indexOf = (rawId: string) => {
    const id = toStableModuleId(rawId, root)
    let index = indices.get(id)
    if (index === undefined) {
      index = ids.length
      indices.set(id, index)
      ids.push(id)
    }
    return index
  }
  const graph = {
    ids,
    localCount: modules.length,
    edges: [] as number[][],
    dynamicEdges: [] as number[][],
  }
  for (const { info } of modules) {
    graph.edges.push(info.importedIds.map(indexOf))
    graph.dynamicEdges.push(info.dynamicallyImportedIds.map(indexOf))
  }
  return `\n__rolldown_runtime__.registerGraph(${JSON.stringify(graph)});\n`
}
