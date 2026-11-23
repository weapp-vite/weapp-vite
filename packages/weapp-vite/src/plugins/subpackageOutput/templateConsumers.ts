import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../context'
import { parseLogicalEntryId } from '../../moduleGraph/protocol'
import { isVueLikeFile, resolveVueOutputBase } from '../vue/transform/shared'

/** 读取本轮原生模板，以及已进入当前逻辑入口图的组件编译结果。 */
export function* collectTemplateConsumers(ctx: CompilerContext, plugin: PluginContext): Iterable<[string, string]> {
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
