import type { OutputChunk } from 'rolldown'
import type { RequestGlobalsAnalysisOptions } from './analysis'
import { REQUEST_GLOBAL_ACTUALS_KEY, REQUEST_GLOBAL_BUNDLE_HOST_REF, REQUEST_GLOBAL_CHUNK_HOST_REF, REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER } from '@weapp-core/constants'
import { parseJsLike, traverse } from '../../../../../utils/babel'
import { editOutputChunkCode } from '../../../../../utils/outputChunk'
import { getRequestGlobalsContentFacts } from './analysis'
import { createTopLevelCallCollector } from './bindings'

/** 复用源码已有的安装时机，安装返回后更新占位绑定，避免在模块常量初始化前调用。 */
export function synchronizeInlineInstallerBindings(
  chunk: OutputChunk,
  installer: string,
  targets: string[],
  localTargets: string[],
  analysis?: RequestGlobalsAnalysisOptions,
) {
  const facts = getRequestGlobalsContentFacts(chunk.code, chunk.fileName, analysis)
  let calls = facts?.topLevelCalls
  if (!calls) {
    const collector = createTopLevelCallCollector()
    traverse(parseJsLike(chunk.code) as any, collector.visitor)
    calls = collector.calls
  }
  const installations = calls.filter(call => call.name === installer && call.binding !== REQUEST_GLOBAL_BUNDLE_HOST_REF)
  if (!installations.length) {
    return false
  }
  const host = REQUEST_GLOBAL_CHUNK_HOST_REF
  const bindings = [
    ...targets.map(target => `${REQUEST_GLOBAL_ACTUALS_KEY}[${JSON.stringify(target)}]=(${host}||globalThis).${target}`),
    ...targets.map(target => `try{globalThis[${JSON.stringify(target)}]=(${host}||globalThis).${target}}catch{}`),
    ...localTargets.map(target => `${target}=(${host}||globalThis).${target}`),
    `return ${host}`,
  ].join(';')
  editOutputChunkCode(chunk, (magicString) => {
    magicString.prepend(`/* ${REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER} */ ${localTargets.length ? `var ${localTargets.join(',')};` : ''}\n`)
    for (const call of installations) {
      magicString.appendLeft(call.start, `(function(${host}){${bindings}})(`)
      magicString.appendLeft(call.end, ')')
    }
  })
  return true
}
