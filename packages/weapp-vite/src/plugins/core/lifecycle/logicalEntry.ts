import type { PluginContext } from 'rolldown'
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
import { findCssEntry, findJsEntry, findJsonEntry, findTemplateEntry, findVueEntry, isTemplate } from '../../../utils'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { pathExists as pathExistsCached } from '../../utils/cache'

function resolveEntryRecord(state: CorePluginState, sourceId: string) {
  const relativeBase = removeExtensionDeep(state.ctx.configService.relativeAbsoluteSrcRoot(sourceId))
  return state.entriesMap.get(relativeBase)
    ?? state.entriesMap.get(removeExtensionDeep(sourceId))
}

async function resolveLocalModule(state: CorePluginState, source: string, importer: string) {
  const localBase = path.isAbsolute(source)
    ? source
    : source.startsWith('/')
      ? source
      : path.resolve(path.dirname(importer), source)
  const resolved = await state.ctx.moduleGraphService.resolve(localBase, importer)
  if (resolved?.id) {
    return normalizeFsResolvedId(resolved.id)
  }
  if (path.isAbsolute(localBase) && !path.extname(localBase)) {
    const jsEntry = await findJsEntry(localBase)
    const localEntry = jsEntry.path ?? await findVueEntry(localBase)
    if (localEntry) {
      const fallbackResolved = await state.ctx.moduleGraphService.resolve(localEntry, importer)
      return normalizeFsResolvedId(fallbackResolved?.id ?? localEntry)
    }
  }
}

async function collectUsingComponentDependencies(
  state: CorePluginState,
  ownerId: string,
  json: unknown,
) {
  if (!json || typeof json !== 'object' || !('usingComponents' in json)) {
    return []
  }
  const usingComponents = json.usingComponents
  if (!usingComponents || typeof usingComponents !== 'object' || Array.isArray(usingComponents)) {
    return []
  }
  const dependencies: LogicalEntryDependency[] = []
  for (const value of Object.values(usingComponents)) {
    if (typeof value !== 'string' || !value || value.includes('://')) {
      continue
    }
    const outputKey = removeExtensionDeep(value).replace(/^\/+/, '')
    const mapped = state.ctx.runtimeState.build.hmr.externalComponentEntryMap.get(outputKey)
    const candidate = mapped
      ?? (value.startsWith('/')
        ? path.resolve(state.ctx.configService.absoluteSrcRoot, value.slice(1))
        : value)
    const resolved = await resolveLocalModule(state, candidate, ownerId)
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
  for (const sourceId of state.ctx.wxmlService?.depsMap?.get(templatePath) ?? []) {
    dependencies.push({
      kind: isTemplate(sourceId) ? 'template' : 'wxs',
      sourceId: normalizeFsResolvedId(sourceId),
    })
  }
  return dependencies
}

async function collectLogicalEntryDependencies(
  state: CorePluginState,
  ownerId: string,
) {
  const pendingDependencies = state.ctx.moduleGraphService.getEntryDependencies(ownerId)
  const dependencies: LogicalEntryDependency[] = []
  const addExistingDependency = async (kind: SidecarModuleKind, sourceId?: string) => {
    if (sourceId && await pathExistsCached(sourceId)) {
      dependencies.push({ kind, sourceId: normalizeFsResolvedId(sourceId) })
    }
  }
  for (const dependency of pendingDependencies) {
    await addExistingDependency(dependency.kind, dependency.sourceId)
  }
  await addExistingDependency('script', ownerId)
  const entry = resolveEntryRecord(state, ownerId)
  const [jsonEntry, templateEntry, styleEntry] = await Promise.all([
    findJsonEntry(ownerId),
    findTemplateEntry(ownerId),
    findCssEntry(ownerId),
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
  dependencies.push(...await collectUsingComponentDependencies(state, ownerId, entry?.json))
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
      return { id: resolvedId, moduleSideEffects: 'no-treeshake' }
    }
    const sidecarSource = parseSidecarSourceRequest(id)
    if (!sidecarSource) {
      return null
    }
    state.ctx.moduleGraphService.bindPluginContext(this)
    const resolved = await state.ctx.moduleGraphService.resolve(id, importer, { skipSelf: true })
    return {
      id: resolved?.id ?? createSidecarSourceSpecifier(sidecarSource.ownerId, sidecarSource.sourceId, sidecarSource.kind),
      moduleSideEffects: 'no-treeshake',
    }
  }
}

export function createLogicalEntryLoadHook(state: CorePluginState) {
  return async function load(this: PluginContext, id: string) {
    const logicalEntry = parseLogicalEntryId(id)
    if (logicalEntry) {
      state.ctx.moduleGraphService.bindPluginContext(this)
      if (state.ctx.configService.isDev) {
        await state.loadEntry.call(
          this,
          logicalEntry.sourceId,
          logicalEntry.type === 'app'
            ? 'app'
            : logicalEntry.type === 'page' ? 'page' : 'component',
        )
      }
      const dependencies = await collectLogicalEntryDependencies(state, logicalEntry.sourceId)
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
