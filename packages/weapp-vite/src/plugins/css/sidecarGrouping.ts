import { toPosixPath } from '../../utils/path'
import { withRealpathScope } from '../../utils/realpathScope'
import { compilerSourceId } from '../compilerPlugin/hmr'

export interface StyleSidecarGroup {
  fileName: string
  sidecars: { path: string, sourceId: string }[]
}

/** 按本轮输出归属一次性解析 sidecar，索引不跨构建或输出配置复用。 */
export function groupStyleSidecars(
  paths: Iterable<string>,
  resolveOutput: (file: string) => string | undefined,
): Map<string, StyleSidecarGroup> {
  return withRealpathScope(() => {
    const groups = new Map<string, StyleSidecarGroup>()
    for (const path of paths) {
      const fileName = resolveOutput(path)
      if (!fileName) {
        continue
      }
      const owner = toPosixPath(fileName)
      let group = groups.get(owner)
      if (!group) {
        group = { fileName, sidecars: [] }
        groups.set(owner, group)
      }
      group.sidecars.push({ path, sourceId: compilerSourceId(path) })
    }
    return groups
  })
}
