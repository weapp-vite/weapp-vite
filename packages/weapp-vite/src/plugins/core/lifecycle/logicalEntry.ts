import type { PluginContext, ResolvedId } from 'rolldown'
import type { LogicalEntryDependency } from '../../../moduleGraph/logicalEntry'
import type { SidecarModuleKind } from '../../../moduleGraph/protocol'
import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { createLogicalEntryModuleCode, createSidecarModuleCode } from '../../../moduleGraph/logicalEntry'
import {
  createSidecarSourceSpecifier,
  parseLogicalEntryId,
  parseSidecarModuleId,
  parseSidecarSourceRequest,
  resolveVirtualModuleId,
} from '../../../moduleGraph/protocol'
import { normalizeSourceId } from '../../../moduleGraph/traversal'
import { getSelectedAutoRouteSource } from '../../../runtime/autoRoutesPlugin/selection'
import { extractConfigFromVue, findCssEntry, findJsEntry, findJsonEntry, findTemplateEntry, findVueEntry, isTemplate } from '../../../utils'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { collectComponentEntries } from '../../utils/analyze'
import { pathExists as pathExistsCached } from '../../utils/cache'
import { readCompilerInput } from '../../utils/sourceSnapshot'

function resolveEntryRecord(state: CorePluginState, sourceId: string) {
  const relativeBase = removeExtensionDeep(state.ctx.configService.relativeAbsoluteSrcRoot(sourceId))
  const ownerId = normalizeSourceId(sourceId)
  for (const key of [relativeBase, removeExtensionDeep(sourceId)]) {
    const entry = state.entriesMap.get(key)
    // 尚未加载的子入口记录可能携带父入口信息；注册身份不代表元数据归属。
    if (entry?.path && normalizeSourceId(entry.path) === ownerId) {
      return entry
    }
  }
}

async function readEntryDeclaration(state: CorePluginState, pluginContext: PluginContext, ownerId: string, jsonPath?: string) {
  if (jsonPath) {
    return state.ctx.jsonService.read(jsonPath)
  }
  const baseName = removeExtensionDeep(ownerId)
  const vuePath = ownerId.endsWith('.vue')
    ? ownerId
    : getSelectedAutoRouteSource(state.ctx, baseName) ? undefined : await findVueEntry(baseName)
  if (vuePath) {
    pluginContext.addWatchFile(vuePath)
    return extractConfigFromVue(vuePath, {
      compilerContext: state.ctx,
      readSource: () => readCompilerInput(state.ctx.configService, vuePath),
    })
  }
}

async function resolveLocalModule(
  pluginContext: PluginContext,
  source: string,
  importer: string,
) {
  const localBase = path.isAbsolute(source)
    ? source
    : source.startsWith('/')
      ? source
      : path.resolve(path.dirname(importer), source)
  const resolved = await pluginContext.resolve(localBase, importer)
  if (resolved?.id) {
    return normalizeFsResolvedId(resolved.id)
  }
  if (path.isAbsolute(localBase) && !path.extname(localBase)) {
    const jsEntry = await findJsEntry(localBase)
    const localEntry = jsEntry.path ?? await findVueEntry(localBase)
    if (localEntry) {
      const fallbackResolved = await pluginContext.resolve(localEntry, importer)
      return normalizeFsResolvedId(fallbackResolved?.id ?? localEntry)
    }
  }
}

async function collectComponentDependencies(
  state: CorePluginState,
  pluginContext: PluginContext,
  ownerId: string,
  json: unknown,
) {
  const dependencies: LogicalEntryDependency[] = []
  for (const value of collectComponentEntries(json)) {
    if (typeof value !== 'string' || !value || value.includes('://')) {
      continue
    }
    const outputKey = removeExtensionDeep(value).replace(/^\/+/, '')
    const mapped = state.ctx.runtimeState.build.hmr.externalComponentEntryMap.get(outputKey)
    const candidate = mapped
      ?? (value.startsWith('/')
        ? path.resolve(state.ctx.configService.absoluteSrcRoot, value.slice(1))
        : value)
    const resolved = await resolveLocalModule(pluginContext, candidate, ownerId)
    if (resolved) {
      dependencies.push({ kind: 'using-component', sourceId: resolved })
    }
  }
  return dependencies
}

function collectTemplateDependencies(state: CorePluginState, templatePath?: string) {
  if (!templatePath) {
    return []
  }
  const dependencies: LogicalEntryDependency[] = []
  const visited = new Set([normalizeFsResolvedId(templatePath)])
  const pending = [templatePath]
  while (pending.length) {
    const template = pending.pop()!
    for (const dependency of state.ctx.wxmlService?.depsMap?.get(template) ?? []) {
      const sourceId = normalizeFsResolvedId(dependency)
      if (visited.has(sourceId)) {
        continue
      }
      visited.add(sourceId)
      dependencies.push({ kind: isTemplate(sourceId) ? 'template' : 'wxs', sourceId })
      if (isTemplate(sourceId)) {
        pending.push(sourceId)
      }
    }
  }
  return dependencies
}

async function collectLogicalEntryDependencies(
  state: CorePluginState,
  pluginContext: PluginContext,
  ownerId: string,
) {
  const pendingDependencies = state.ctx.moduleGraphService.getEntryDependencies(ownerId)
  const entry = resolveEntryRecord(state, ownerId)
  const dependencies: LogicalEntryDependency[] = []
  const addExistingDependency = async (kind: SidecarModuleKind, sourceId?: string) => {
    if (sourceId && await pathExistsCached(sourceId)) {
      dependencies.push({ kind, sourceId: normalizeFsResolvedId(sourceId) })
    }
  }
  for (const dependency of pendingDependencies) {
    // JSX 依赖在源码 transform 中发现并登记 addWatchFile，由源码模块持有。
    // 自动组件依赖同理由源码编译持有；逻辑入口只从声明配置重建组件侧车。
    // 不能把后发现的依赖提升为逻辑入口的新 import，否则纯脚本更新会改变包装模块。
    if (dependency.kind === 'jsx' || dependency.kind === 'using-component') {
      continue
    }
    // JSON 依赖由本轮入口记录重新声明，不能复活已移除的附属文件或父入口配置。
    if (dependency.kind === 'json') {
      continue
    }
    await addExistingDependency(dependency.kind, dependency.sourceId)
  }
  await addExistingDependency('script', ownerId)
  const [jsonEntry, templateEntry, styleEntry] = await Promise.all([
    findJsonEntry(ownerId),
    findTemplateEntry(ownerId, state.ctx.configService.platform),
    findCssEntry(ownerId, state.ctx.configService.platform),
  ])
  await addExistingDependency('json', entry?.jsonPath ?? jsonEntry.path)
  await addExistingDependency('json', entry && 'sitemapJsonPath' in entry ? entry.sitemapJsonPath : undefined)
  await addExistingDependency('json', entry && 'themeJsonPath' in entry ? entry.themeJsonPath : undefined)
  const templatePath = entry && 'templatePath' in entry ? entry.templatePath : templateEntry.path
  await addExistingDependency('template', templatePath)
  await addExistingDependency('style', styleEntry.path)
  if (templatePath) {
    await state.ctx.wxmlService?.scan(templatePath)
  }
  dependencies.push(...collectTemplateDependencies(state, templatePath))
  const declaredJson = entry
    ? entry.declaredJson ?? entry.json
    : await readEntryDeclaration(state, pluginContext, ownerId, jsonEntry.path)
  dependencies.push(...await collectComponentDependencies(state, pluginContext, ownerId, declaredJson))
  for (const kind of ['json', 'layout', 'script', 'style', 'template', 'using-component', 'wxs'] as const) {
    state.ctx.moduleGraphService.replaceEntryDependencies(
      ownerId,
      kind,
      dependencies.filter(dependency => dependency.kind === kind).map(dependency => dependency.sourceId),
    )
  }
  return dependencies
}

export function createLogicalEntryResolveHook(state: CorePluginState) {
  return async function resolveId(this: PluginContext, id: string, importer?: string) {
    const resolvedId = resolveVirtualModuleId(id)
    if (resolvedId) {
      return { id: resolvedId, moduleSideEffects: 'no-treeshake' as const }
    }
    const sidecarSource = parseSidecarSourceRequest(id)
    if (!sidecarSource) {
      return null
    }
    state.ctx.moduleGraphService.bindPluginContext(state, this)
    const resolved = await this.resolve(id, importer, { skipSelf: true })
    return {
      id: resolved?.id ?? createSidecarSourceSpecifier(sidecarSource.ownerId, sidecarSource.sourceId, sidecarSource.kind),
      moduleSideEffects: 'no-treeshake' as const,
    }
  }
}

export function createLogicalEntryLoadHook(state: CorePluginState) {
  return async function load(this: PluginContext, id: string) {
    const logicalEntry = parseLogicalEntryId(id)
    if (logicalEntry) {
      state.ctx.moduleGraphService.bindPluginContext(state, this)
      // 逻辑入口读取宿主源码中的配置，必须由该读取关系触发重新加载。
      // 仅依靠 script import 无法让原生增量图更新已缓存的侧车依赖列表。
      this.addWatchFile(logicalEntry.sourceId)
      // 入口图交接期间旧 DevEngine 可能在源文件删除后仍重载旧逻辑入口。
      // 这时保留一个空模块，避免再次生成指向已删除源码的 unresolved import；新宿主
      // 会在完整快照交付后重新注册实际入口。
      if (state.ctx.configService.isDev
        && !logicalEntry.sourceId.startsWith('\0')
        && !await pathExistsCached(logicalEntry.sourceId)) {
        return {
          code: '',
          moduleSideEffects: 'no-treeshake',
        }
      }
      if (state.ctx.configService.isDev) {
        await state.loadEntry.call(
          this,
          logicalEntry.sourceId,
          logicalEntry.type === 'app'
            ? 'app'
            : logicalEntry.type === 'page' ? 'page' : 'component',
        )
      }
      const dependencies = await collectLogicalEntryDependencies(state, this, logicalEntry.sourceId)
      if (state.ctx.configService.isDev) {
        // 编译器直接发射的组件同样拥有逻辑入口，不能依赖父入口再次扫描 JSON 才登记。
        // sourceId 已由发射方解析；保留原始模块身份以及已有解析元数据。
        const sourceId = normalizeSourceId(logicalEntry.sourceId)
        if (!state.resolvedEntryMap.has(sourceId)) {
          state.resolvedEntryMap.set(sourceId, { id: logicalEntry.sourceId } as ResolvedId)
        }
      }
      return {
        code: createLogicalEntryModuleCode(logicalEntry, dependencies),
        moduleSideEffects: 'no-treeshake',
      }
    }
    const sidecar = parseSidecarModuleId(id)
    if (sidecar) {
      return {
        code: createSidecarModuleCode(sidecar.ownerId, sidecar.sourceId, sidecar.kind),
        meta: {
          weappViteSidecar: sidecar,
        },
        moduleSideEffects: 'no-treeshake',
      }
    }
    return null
  }
}

export function replaceLogicalEntryDependencies(
  state: CorePluginState,
  ownerId: string,
  kind: SidecarModuleKind,
  sourceIds: Iterable<string>,
) {
  state.ctx.moduleGraphService.replaceEntryDependencies(ownerId, kind, sourceIds)
}
