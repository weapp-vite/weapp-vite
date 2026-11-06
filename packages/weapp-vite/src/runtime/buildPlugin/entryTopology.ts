import type { MutableCompilerContext } from '../../context'
import { normalizeSourceId } from '../../moduleGraph/traversal'
import { getRecordedSfcBlockSource } from '../../plugins/utils/sfcTemplateDependencies'
import { readVueLikeCompilerInput } from '../../plugins/vue/transform/sourceInput'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { entryTopologySignature } from './entryTopologySignature'
import { getRecordedVueEntryExternalBlockSources, getRecordedVueEntryTopologySignature, resolveVueEntryTopologySignature } from './vueEntryTopology'

export { entryTopologySignature } from './entryTopologySignature'

function collectEntryConfigs(ctx: MutableCompilerContext) {
  const entryConfigs = new Map<string, unknown>()
  for (const entry of ctx.runtimeState?.build.hmr.entriesMap.values() ?? []) {
    if (!entry) {
      continue
    }
    if (entry.jsonPath) {
      entryConfigs.set(normalizeFsResolvedId(entry.jsonPath), entry.declaredJson ?? entry.json)
    }
    const basename = normalizeFsResolvedId(entry.path).replace(/\.[^/.]+$/, '')
    for (const extension of ['.json', '.json.js', '.json.ts']) {
      const candidate = `${basename}${extension}`
      if (!entryConfigs.has(candidate)) {
        entryConfigs.set(candidate, undefined)
      }
    }
  }
  return entryConfigs
}

/** 冻结已发布完整扫描的入口拓扑，局部资源构建不得推进此基线。 */
export function captureEntryTopology(ctx: MutableCompilerContext) {
  const topology = new Map([...collectEntryConfigs(ctx)].map(([file, value]) => [file, entryTopologySignature(value)]))
  if (ctx.configService) {
    for (const file of ctx.runtimeState?.build.hmr.resolvedEntryMap?.keys() ?? []) {
      const signature = getRecordedVueEntryTopologySignature(ctx.configService, file)
      if (signature !== undefined) {
        topology.set(normalizeFsResolvedId(file), signature)
      }
    }
  }
  return topology
}

function changesExternalVueBlock(ctx: MutableCompilerContext, file: string) {
  const graph = ctx.moduleGraphService
  if (!ctx.configService || !graph?.collectAffectedEntries) {
    return false
  }
  const owners = new Set([...graph.collectAffectedEntries(file, 'script'), ...graph.collectAffectedEntries(file, 'template')])
  const changedSource = normalizeSourceId(file)
  for (const owner of owners) {
    const registered = ctx.runtimeState?.build.hmr.resolvedEntryMap
    if (registered && !registered.has(normalizeSourceId(owner))) {
      continue
    }
    for (const source of getRecordedVueEntryExternalBlockSources(ctx.configService, owner)) {
      const resolved = getRecordedSfcBlockSource(ctx.configService, source, owner)
      // 两次 snapshot 之间没有活动 hook；未知或被删除的输入均不能借旧 resolver 猜测稳定。
      if (!resolved || normalizeSourceId(resolved) === changedSource) {
        return true
      }
    }
  }
  return false
}

export async function hasEntryTopologyChange(
  ctx: MutableCompilerContext,
  files: Iterable<string>,
  committed?: ReadonlyMap<string, string>,
  deletedFiles?: ReadonlySet<string>,
) {
  const entryConfigs = collectEntryConfigs(ctx)
  let changed = false
  for (const file of files) {
    const normalizedFile = normalizeFsResolvedId(file)
    if (changesExternalVueBlock(ctx, normalizedFile)) {
      changed = true
    }
    if (normalizedFile.endsWith('.vue') && ctx.configService) {
      const before = committed ? committed.get(normalizedFile) : getRecordedVueEntryTopologySignature(ctx.configService, normalizedFile)
      if (before !== undefined) {
        const after = deletedFiles?.has(normalizedFile)
          ? undefined
          : resolveVueEntryTopologySignature(ctx.configService, normalizedFile, (await readVueLikeCompilerInput(ctx.configService, normalizedFile)).source)
        changed ||= before !== after
      }
      continue
    }
    if (!ctx.jsonService) {
      continue
    }
    if (!/\.json(?:\.[jt]s)?$/.test(file)) {
      continue
    }
    const cached = ctx.jsonService.cache.get(file) as unknown
    const before = cached === undefined ? entryConfigs.get(normalizedFile) : cached
    // 外部转换输入即使是 JSON，也不属于入口配置；解析、错误恢复由声明它的转换器负责。
    if (before === undefined && !entryConfigs.has(normalizedFile) && !committed?.has(normalizedFile)) {
      continue
    }
    // 结构删除表示配置不存在，不应交给 JSON 解析器报告语法错误。
    const after = deletedFiles?.has(normalizedFile) ? undefined : await ctx.jsonService.read(file) as unknown
    if ((committed?.get(normalizedFile) ?? entryTopologySignature(before)) !== entryTopologySignature(after)) {
      changed = true
    }
  }
  return changed
}
