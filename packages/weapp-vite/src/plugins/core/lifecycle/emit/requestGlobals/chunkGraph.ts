import type { OutputBundle } from 'rolldown'
import { REQUEST_GLOBAL_REQUIRE_CALL_RE } from '../constants'
import { normalizeRelativeChunkImport } from '../rewrite'

/** 将 support 合入 runtime 之前，保留其他依赖先读取 support 的无环初始化顺序。 */
export function wouldCollapseSupportCreateCycle(bundle: OutputBundle, runtimeFileName: string, supportFileName: string): boolean {
  const pending = [runtimeFileName]
  const visited = new Set<string>()
  while (pending.length) {
    const fileName = pending.pop()!
    if (visited.has(fileName)) {
      continue
    }
    visited.add(fileName)
    const chunk = bundle[fileName]
    if (!chunk || chunk.type !== 'chunk') {
      continue
    }
    for (const match of chunk.code.matchAll(REQUEST_GLOBAL_REQUIRE_CALL_RE)) {
      const request = match[2] ?? match[3] ?? match[4]
      if (!request) {
        continue
      }
      const imported = normalizeRelativeChunkImport(fileName, request)
      if (imported === supportFileName) {
        if (fileName !== runtimeFileName) {
          return true
        }
        continue
      }
      pending.push(imported)
    }
  }
  return false
}
