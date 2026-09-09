import type { OutputBundle } from 'rolldown'
import { parseJsLike, traverse } from '../../../../../utils/babel'
import { REQUEST_GLOBAL_REQUIRE_CALL_RE } from '../constants'
import { getStaticStringLiteral, normalizeRelativeChunkImport } from '../rewrite'

/** 初始化器及其同步依赖先于 prelude 执行，不能反向加载 prelude。 */
export function collectRequestGlobalsInstallerDependencies(bundle: OutputBundle, installerFileNames: Iterable<string>) {
  const pending = [...installerFileNames]
  const dependencies = new Set<string>()
  while (pending.length) {
    const fileName = pending.pop()!
    if (dependencies.has(fileName)) {
      continue
    }
    const output = bundle[fileName]
    if (!output || output.type !== 'chunk') {
      continue
    }
    dependencies.add(fileName)
    for (const importee of output.imports ?? []) {
      pending.push(bundle[importee] ? importee : normalizeRelativeChunkImport(fileName, importee))
    }
    // 产物后处理新增的 require 不一定已同步到 chunk.imports。
    traverse(parseJsLike(output.code) as any, {
      CallExpression(call: any) {
        if (call.node.callee?.type !== 'Identifier' || call.node.callee.name !== 'require' || call.scope.hasBinding('require')) {
          return
        }
        const importee = getStaticStringLiteral(call.node.arguments?.[0])
        if (importee) {
          pending.push(normalizeRelativeChunkImport(fileName, importee))
        }
      },
    })
  }
  return dependencies
}

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
