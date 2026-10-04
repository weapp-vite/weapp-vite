import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { ResolvedAutoImportComponent } from '../autoImport'
import { get, isObject, removeExtensionDeep } from '@weapp-core/shared'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { shouldResolveUsingComponentFrom, usingComponentFromResolvedFile } from '../../../../utils/usingComponentFrom'

function collectCandidates(injectedComponents: ResolvedAutoImportComponent[], usingComponents: Record<string, unknown>) {
  const candidates = new Map<string, ResolvedAutoImportComponent>()
  for (const component of injectedComponents) {
    const existing = candidates.get(component.from)
    // 同一请求的来源有歧义时，仍交给 bundler 解析，不把任一组件的来源推广为共同事实。
    candidates.set(component.from, existing && (
      existing.resolvedId !== component.resolvedId || existing.sourceType !== component.sourceType
    )
      ? { from: component.from }
      : component)
  }
  for (const entry of Object.values(usingComponents)) {
    if (typeof entry === 'string' && entry.endsWith('.vue') && !candidates.has(entry)) {
      candidates.set(entry, { from: entry })
    }
  }
  return candidates
}

export async function materializeVueAutoImportEntries(
  ctx: CompilerContext,
  pluginCtx: PluginContext,
  importer: string,
  json: any,
  injectedComponents: ResolvedAutoImportComponent[],
) {
  const { configService } = ctx
  const injectedEntries = injectedComponents.map(component => component.from)
  const usingComponents = get(json, 'usingComponents')
  if (!isObject(usingComponents) || !injectedEntries.length) {
    if (!isObject(usingComponents) || !configService.weappViteConfig?.uniApp) {
      return injectedEntries
    }
  }

  const candidates = collectCandidates(injectedComponents, usingComponents)
  const rewritten = new Map<string, string>()
  for (const [entry, component] of candidates) {
    const normalizedSource = component.resolvedId ? normalizeFsResolvedId(component.resolvedId) : undefined
    const knownSource = shouldResolveUsingComponentFrom(normalizedSource) ? normalizedSource : undefined
    if (component.sourceType === 'native' || (knownSource && !knownSource.endsWith('.vue'))) {
      continue
    }
    const resolved = knownSource ? undefined : await pluginCtx.resolve(entry, importer)
    const resolvedId = knownSource ?? (resolved?.id ? normalizeFsResolvedId(resolved.id) : undefined)
    if (!resolvedId?.endsWith('.vue')) {
      if (configService.weappViteConfig?.uniApp && entry.endsWith('.vue')) {
        throw new Error(`[uni-app] 无法解析外部 Vue 组件: importer=${importer} request=${entry}`)
      }
      continue
    }
    // 本轮自动导入已给出的运行时输出路径必须保留，裸请求及 .vue 请求才需要物化。
    const outputPath = knownSource && entry.startsWith('/') && !entry.endsWith('.vue')
      ? entry
      : usingComponentFromResolvedFile(resolvedId, configService)
    if (!outputPath) {
      throw new Error(`[uni-app] 无法生成外部 Vue 组件输出路径: importer=${importer} resolvedId=${resolvedId}`)
    }
    for (const [name, value] of Object.entries(usingComponents)) {
      if (value === entry) {
        usingComponents[name] = outputPath
      }
    }
    ctx.runtimeState.build.hmr.externalComponentEntryMap.set(
      removeExtensionDeep(outputPath).replace(/^\/+/, ''),
      resolvedId,
    )
    rewritten.set(entry, outputPath)
  }
  return Array.from(new Set([
    ...injectedEntries.map(entry => rewritten.get(entry) ?? entry),
    ...Array.from(candidates.keys(), entry => rewritten.get(entry) ?? entry),
  ]))
}
