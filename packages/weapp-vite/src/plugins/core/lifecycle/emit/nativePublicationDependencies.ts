import type { OutputBundle, OutputChunk } from 'rolldown'
import type { RequestGlobalsAnalysisOptions } from './requestGlobals/analysis'
import path from 'pathe'
import { toPosixPath } from '../../../../utils'
import { collectRequireAsyncChunkTargets } from '../../requireAsyncTarget'
import { resolveRequestGlobalsInstallerName } from './requestGlobals'

/** 原生局部发布保留当前根入口、prelude 和原生异步加载所需依赖，不借用历史发布图。 */
export function collectNativePublicationDependencies(
  bundle: OutputBundle,
  options: { rootFileName: string, requestGlobalsPrelude: boolean, analysis?: RequestGlobalsAnalysisOptions },
) {
  const chunks = new Map<string, OutputChunk>()
  const pending: string[] = []
  for (const [fileName, output] of Object.entries(bundle)) {
    if (output.type !== 'chunk') {
      continue
    }
    chunks.set(toPosixPath(fileName), output)
    chunks.set(toPosixPath(output.fileName), output)
    // 原生异步加载不属于 bundler 的 import 图，但仍是当前活跃产物的发布依赖。
    pending.push(...collectRequireAsyncChunkTargets(output.code))
    if ((fileName === options.rootFileName && output.isEntry)
      || (options.requestGlobalsPrelude && resolveRequestGlobalsInstallerName(output.code, options.analysis, output.fileName))) {
      pending.push(toPosixPath(output.fileName))
    }
  }
  const dependencies = new Set<string>()
  while (pending.length) {
    const fileName = pending.pop()!
    const chunk = chunks.get(fileName)
    if (!chunk || dependencies.has(toPosixPath(chunk.fileName))) {
      continue
    }
    dependencies.add(toPosixPath(chunk.fileName))
    for (const imported of [...chunk.imports ?? [], ...chunk.dynamicImports ?? []]) {
      const normalized = toPosixPath(imported)
      pending.push(chunks.has(normalized) ? normalized : path.posix.join(path.posix.dirname(toPosixPath(chunk.fileName)), normalized))
    }
  }
  return dependencies
}

/** 原生依赖必须先于选择性裁剪登记；空发射计划仍表示完整元数据批次，不改成局部发布。 */
export function registerNativePublicationDependencies(
  bundle: OutputBundle,
  dependencies: ReadonlySet<string>,
  emittedChunkFileNames: Set<string> | undefined,
  rootFileName: string,
) {
  if (!emittedChunkFileNames?.size || !dependencies.size) {
    return
  }
  for (const [fileName, output] of Object.entries(bundle)) {
    if (output.type !== 'chunk' || !dependencies.has(toPosixPath(output.fileName))) {
      continue
    }
    // 根 input 已有裁剪豁免，仍按最终字节去重；遍历起点不代表动态强制发射。
    if (output.isEntry && toPosixPath(output.fileName) === rootFileName) {
      continue
    }
    emittedChunkFileNames.add(fileName)
    emittedChunkFileNames.add(output.fileName)
  }
}
