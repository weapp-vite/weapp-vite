import type { PluginContext, ResolvedId } from 'rolldown'
import type { LogicalEntryDependency } from '../../../moduleGraph/logicalEntry'
import type { LogicalEntryType, SidecarModuleKind } from '../../../moduleGraph/protocol'
import type { Entry } from '../../../types'
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
import { resolveHmrRuntimeDecision } from '../../../runtime/hmrRuntime'
import { findCssEntry, findJsEntry, findJsonEntry, findTemplateEntry, findVueEntry } from '../../../utils'
import { withRealpathScope } from '../../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { collectComponentEntries } from '../../utils/analyze'
import { pathExists as pathExistsCached } from '../../utils/cache'
import { compilerSnapshotSourceId, getCompilerSourceSnapshot } from '../../utils/sourceSnapshot'
import { collectTemplateDependencySources } from '../../utils/templateDependencies'

function resolveEntryRecord(state: CorePluginState, sourceId: string) {
  const relativeBase = removeExtensionDeep(state.ctx.configService.relativeAbsoluteSrcRoot(sourceId))
  return state.entriesMap.get(relativeBase)
    ?? state.entriesMap.get(removeExtensionDeep(sourceId))
}

function ownsLayoutMetadata(state: CorePluginState, entry: Entry | undefined, sourceId: string) {
  if (!entry?.path) {
    return false
  }
  const declaredPath = normalizeFsResolvedId(entry.path)
  const ownerId = normalizeFsResolvedId(sourceId)
  // 插件生成的入口无需落盘；相同虚拟或词法身份也能持有自己的配置。
  if (declaredPath === ownerId) {
    return true
  }
  if (declaredPath.startsWith('\0') || ownerId.startsWith('\0')) {
    return false
  }
  const absolutePath = path.isAbsolute(declaredPath)
    ? declaredPath
    : path.resolve(state.ctx.configService.absoluteSrcRoot, declaredPath)
  return withRealpathScope(() => normalizeSourceId(absolutePath) === normalizeSourceId(ownerId))
}

function collectLayoutStyleSources(state: CorePluginState, ownerId: string) {
  return withRealpathScope(() => {
    const sources = new Set<string>()
    const owners = new Set([normalizeFsResolvedId(ownerId), normalizeSourceId(ownerId)])
    for (const owner of owners) {
      const cssSources = state.ctx.runtimeState.css?.importerToDependencies.get(owner) ?? []
      const sfcSources = state.ctx.runtimeState.build.hmr.vueEntryStyleBindings?.get(owner)?.sources ?? []
      for (const source of [...cssSources, ...sfcSources]) {
        sources.add(normalizeSourceId(source))
      }
    }
    return sources
  })
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
  const dependencies: LogicalEntryDependency[] = []
  const sources = collectTemplateDependencySources(state.ctx.wxmlService, templatePath)
  for (const kind of ['template', 'wxs'] as const) {
    for (const sourceId of sources[kind]) {
      dependencies.push({ kind, sourceId })
    }
  }
  return dependencies
}

async function collectLogicalEntryDependencies(
  state: CorePluginState,
  pluginContext: PluginContext,
  ownerId: string,
  entryType: LogicalEntryType,
) {
  const pendingDependencies = state.ctx.moduleGraphService.getEntryDependencies(ownerId, { preserveAliases: true })
  const record = resolveEntryRecord(state, ownerId)
  // 共享 layout 的发现占位记录携带父页面上下文，不能作为 layout 的配置所有者。
  const entry = entryType === 'layout' && !ownsLayoutMetadata(state, record, ownerId) ? undefined : record
  const dependencies: LogicalEntryDependency[] = []
  const layoutStyleSources = entryType === 'layout' ? collectLayoutStyleSources(state, ownerId) : undefined
  const [jsonEntry, templateEntry, styleEntry] = await Promise.all([
    findJsonEntry(ownerId),
    findTemplateEntry(ownerId, state.ctx.configService.platform),
    findCssEntry(ownerId, state.ctx.configService.platform),
  ])
  const templatePath = entry && 'templatePath' in entry ? entry.templatePath : templateEntry.path
  const templateRoot = templatePath || (ownerId.endsWith('.vue') ? ownerId : undefined)
  const addExistingDependency = async (kind: SidecarModuleKind, sourceId?: string) => {
    if (sourceId && await pathExistsCached(sourceId)) {
      dependencies.push({ kind, sourceId: normalizeFsResolvedId(sourceId) })
      return true
    }
    return false
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
    if (templateRoot && (dependency.kind === 'template' || dependency.kind === 'wxs')) {
      continue
    }
    // Layout 的脚本和模板依赖按当前物理所有者重建，不能继承旧包装模块的父页面边。
    // SFC 的外部样式只保留编译器登记在当前源码上的 CSS 或 src 依赖。
    if (layoutStyleSources && (dependency.kind !== 'style'
      || !withRealpathScope(() => layoutStyleSources.has(normalizeSourceId(dependency.sourceId))))) {
      continue
    }
    await addExistingDependency(dependency.kind, dependency.sourceId)
  }
  await addExistingDependency('script', ownerId)
  // App shell 独立发布，自身模板必须越过 App 脚本的接受边界。
  await addExistingDependency('template', entryType === 'app' && ownerId.endsWith('.vue') ? ownerId : undefined)
  const effectiveJsonPath = entry?.jsonPath ?? jsonEntry.path
  const hasJsonEntry = await addExistingDependency('json', effectiveJsonPath)
  await addExistingDependency('json', entry && 'sitemapJsonPath' in entry ? entry.sitemapJsonPath : undefined)
  await addExistingDependency('json', entry && 'themeJsonPath' in entry ? entry.themeJsonPath : undefined)
  await addExistingDependency('template', templateRoot !== ownerId ? templateRoot : undefined)
  await addExistingDependency('style', styleEntry.path)
  if (templatePath) {
    await state.ctx.wxmlService?.scan(templatePath)
  }
  dependencies.push(...collectTemplateDependencies(state, templateRoot))
  const declaredJson = entry?.declaredJson ?? entry?.json
  const componentJson = entryType === 'layout' && declaredJson === undefined && hasJsonEntry && effectiveJsonPath
    ? await state.ctx.jsonService.read(effectiveJsonPath)
    : declaredJson
  dependencies.push(...await collectComponentDependencies(state, pluginContext, ownerId, componentJson))
  return withRealpathScope(() => {
    const sources = getCompilerSourceSnapshot(state.ctx.configService)
    for (const kind of ['json', 'layout', 'script', 'style', 'template', 'using-component', 'wxs'] as const) {
      state.ctx.moduleGraphService.replaceEntryDependencies(
        ownerId,
        kind,
        dependencies.filter(dependency => dependency.kind === kind).map(dependency => dependency.sourceId),
        id => compilerSnapshotSourceId(sources, id),
      )
    }
    for (const dependency of dependencies) {
      dependency.sourceId = compilerSnapshotSourceId(sources, dependency.sourceId)
    }
    // 编译器读取的外部脚本、组件解析输入和插槽元数据仍保留图中的失效边。
    // 包装模块只导入自身脚本，避免后发现的编译依赖改变不执行注册的 HMR 入口。
    const scriptOwnerId = compilerSnapshotSourceId(sources, ownerId)
    return dependencies.filter(dependency => dependency.kind !== 'script' || dependency.sourceId === scriptOwnerId)
  })
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
      const dependencies = await collectLogicalEntryDependencies(state, this, logicalEntry.sourceId, logicalEntry.type)
      if (state.ctx.configService.isDev) {
        // 编译器直接发射的组件同样拥有逻辑入口，不能依赖父入口再次扫描 JSON 才登记。
        // sourceId 已由发射方解析；保留原始模块身份以及已有解析元数据。
        const sourceId = normalizeSourceId(logicalEntry.sourceId)
        if (!state.resolvedEntryMap.has(sourceId)) {
          state.resolvedEntryMap.set(sourceId, { id: logicalEntry.sourceId } as ResolvedId)
        }
      }
      return {
        code: createLogicalEntryModuleCode(logicalEntry, dependencies, {
          includeStatefulHmrAccept: state.ctx.configService.isDev && resolveHmrRuntimeDecision({
            platform: state.ctx.configService.platform,
            configured: state.ctx.configService.weappViteConfig?.hmr?.runtime,
            compileHotReLoad: state.ctx.configService.projectPrivateConfig?.setting?.compileHotReLoad,
          }).runtime === 'stateful-experimental',
        }),
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
