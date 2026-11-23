import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { PreparedTemplates } from '../outputFinalizer/templates'
import { parseLogicalEntryId } from '../../moduleGraph/protocol'
import { isVueLikeFile, resolveVueOutputBase } from '../vue/transform/shared'

/** 读取本轮原生模板，以及已进入当前逻辑入口图的组件编译结果。 */
function* collectRawTemplates(ctx: CompilerContext, plugin: PluginContext): Iterable<[string, string]> {
  if (ctx.configService.platform !== 'weapp') {
    return
  }
  yield* ctx.runtimeState.wxml.emittedCode
  const seen = new Set<string>()
  for (const id of plugin.getModuleIds()) {
    const entry = parseLogicalEntryId(id)
    if (!entry || entry.type === 'app' || !isVueLikeFile(entry.sourceId) || seen.has(entry.sourceId)) {
      continue
    }
    seen.add(entry.sourceId)
    const token = ctx.wxmlService.tokenMap.get(entry.sourceId)
    if (token?.code) {
      yield [`${resolveVueOutputBase(ctx.configService, entry.sourceId)}.${ctx.configService.outputExtensions.wxml}`, token.code]
    }
  }
}

/** 只把最终保留的本地图片引用纳入资源归属计算。 */
export async function* collectTemplateConsumers(ctx: CompilerContext, plugin: PluginContext, prepared: PreparedTemplates): AsyncIterable<[string, string]> {
  prepared.clear()
  for (const [fileName, code] of collectRawTemplates(ctx, plugin)) {
    const result = await prepared.prepare(fileName, code, {
      addWatchFile: file => plugin.addWatchFile(file),
      warn: message => plugin.warn(message),
    })
    yield [fileName, result]
  }
}
