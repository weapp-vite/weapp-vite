import type { CompilerContext } from '../../../context'
import { removeExtensionDeep } from '@weapp-core/shared'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { normalizeSourceId } from '../../../moduleGraph/traversal'
import { EntryChunkLifecycle } from '../../hooks/useLoadEntry/entryChunkLifecycle'
import { readEntryChunkLifecycle } from '../../hooks/useLoadEntry/entryChunkLifecycleRegistry'
import { resolveRelativeOutputFileNameWithExtension } from '../../utils/outputFileName'

/** 来源映射保留解析事实，入口发射复用当前构建的注册阶段与去重账本。 */
export function createComponentEntryRegistration(
  ctx: CompilerContext,
  pluginCtx: any,
  configService: NonNullable<CompilerContext['configService']>,
  externalComponentEntryMap: Map<string, string>,
  emitEntries: boolean,
) {
  // 独立调用编译选项时拥有自己的扫描；完整宿主始终使用 core 绑定的注册器。
  const lifecycle = readEntryChunkLifecycle(pluginCtx.environment ?? ctx)
    ?? new EntryChunkLifecycle(() => {
      throw new Error('Cannot register a new mini-program entry outside a full build scan')
    })
  return (resolved: { from: string, resolvedId: string }) => {
    const outputKey = removeExtensionDeep(resolved.from).replace(/^\/+/, '')
    const sourceId = normalizeSourceId(resolved.resolvedId)
    externalComponentEntryMap.set(outputKey, sourceId)
    if (!emitEntries || typeof pluginCtx.emitFile !== 'function') {
      return
    }
    const entryId = createLogicalEntryId(resolved.resolvedId, 'component')
    if (!lifecycle.prepare(sourceId, true, () => pluginCtx.getModuleInfo?.(entryId)?.isEntry === true)) {
      return
    }
    try {
      pluginCtx.emitFile({
        type: 'chunk',
        id: entryId,
        fileName: resolveRelativeOutputFileNameWithExtension(configService, resolved.resolvedId, '.js'),
        preserveSignature: 'exports-only',
      })
    }
    catch (error) {
      lifecycle.rollback(sourceId)
      throw error
    }
  }
}
