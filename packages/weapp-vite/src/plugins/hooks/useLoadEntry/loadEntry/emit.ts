import type { PluginContext, ResolvedId } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { Entry } from '../../../../types'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import type { ResolvedEntryRecord } from './resolve'
import MagicString from 'magic-string'
import path from 'pathe'
import logger from '../../../../logger'
import { normalizeWatchPath } from '../../../../utils/path'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { readFile as readFileCached } from '../../../utils/cache'
import { applyPageLayoutPlanToNativePage, injectNativePageLayoutRuntime, resolvePageLayoutPlan } from '../../../vue/transform/pageLayout'
import { collectStyleImports } from './watch'

const NON_VUE_PAGE_RE = /\.vue$|\.jsx$|\.tsx$/

interface NormalizedEntryOptions {
  entries: string[]
  json: any
  jsonPath: string
  templatePath: string
  id: string
  skipOwnEntries?: boolean
  entriesMap: Map<string, Entry | undefined>
  normalizeEntry: (entry: string, jsonPath: string) => string
  extendedLibManager: ExtendedLibManager
  entryType?: Entry['type']
}

export function prepareNormalizedEntries(options: NormalizedEntryOptions) {
  const {
    entries,
    json,
    jsonPath,
    templatePath,
    id,
    skipOwnEntries,
    entriesMap,
    normalizeEntry,
    extendedLibManager,
    entryType,
  } = options

  const filteredEntries = skipOwnEntries
    ? []
    : entries.filter(entry => !extendedLibManager.shouldIgnoreEntry(entry))
  const normalizedEntries = skipOwnEntries
    ? []
    : filteredEntries.map(entry => normalizeEntry(entry, jsonPath))
  if (!skipOwnEntries) {
    for (const normalizedEntry of normalizedEntries) {
      entriesMap.set(normalizedEntry, {
        type: entryType ?? (json.component ? 'component' : 'page'),
        templatePath,
        jsonPath,
        json,
        path: id,
      })
    }
  }

  return normalizedEntries
}

interface EmitEntryOutputOptions {
  pluginCtx: PluginContext
  id: string
  type: 'app' | 'page' | 'component'
  json: any
  jsonPath: string
  templatePath: string
  isPluginBuild: boolean
  normalizedEntries: string[]
  pluginResolvedRecords?: ResolvedEntryRecord[]
  pluginJsonPathForRegistration?: string
  pluginJsonForRegistration?: any
  resolveEntriesWithCache: (pluginCtx: PluginContext, entries: string[], absoluteRoot: string) => Promise<ResolvedEntryRecord[]>
  configService: CompilerContext['configService']
  wxmlService?: CompilerContext['wxmlService']
  resolvedEntryMap: Map<string, ResolvedId>
  loadedEntrySet: Set<string>
  dirtyEntrySet: Set<string>
  emitEntriesChunks: (this: PluginContext, resolvedIds: (ResolvedId | null)[]) => Promise<unknown>[]
  registerJsonAsset: (entry: JsonEmitFileEntry) => void
  existsCache: Map<string, boolean>
  pathExistsTtlMs: number
  debug?: (...args: any[]) => void
  relativeCwdId: string
  getTime: () => string
  skipEntries?: boolean
  entryResolveRoot: string
}

export async function emitEntryOutput(options: EmitEntryOutputOptions) {
  const {
    pluginCtx,
    id,
    type,
    json: initialJson,
    jsonPath,
    templatePath,
    isPluginBuild,
    normalizedEntries,
    pluginResolvedRecords,
    pluginJsonPathForRegistration,
    pluginJsonForRegistration,
    resolveEntriesWithCache,
    entryResolveRoot,
    configService,
    wxmlService,
    resolvedEntryMap,
    loadedEntrySet,
    dirtyEntrySet,
    emitEntriesChunks,
    registerJsonAsset,
    existsCache,
    pathExistsTtlMs,
    debug,
    relativeCwdId,
    getTime,
  } = options
  let json = initialJson

  const shouldSkipEntries = Boolean(options.skipEntries)
  const resolvedIds = shouldSkipEntries
    ? []
    : normalizedEntries.length
      ? await resolveEntriesWithCache(
          pluginCtx,
          normalizedEntries,
          entryResolveRoot,
        )
      : []

  debug?.(`resolvedIds ${relativeCwdId} 耗时 ${getTime()}`)

  const pendingResolvedIds: ResolvedId[] = []
  const combinedResolved = shouldSkipEntries
    ? []
    : pluginResolvedRecords
      ? (isPluginBuild ? pluginResolvedRecords : [...resolvedIds, ...pluginResolvedRecords])
      : resolvedIds
  const pluginEntrySet = shouldSkipEntries || !pluginResolvedRecords
    ? undefined
    : new Set(pluginResolvedRecords.map(record => record.entry))

  for (const { entry, resolvedId } of combinedResolved) {
    if (!resolvedId) {
      if (pluginEntrySet?.has(entry)) {
        logger.warn(`没有找到插件入口 \`${entry}\` 对应的脚本文件，请检查路径是否正确!`)
      }
      else {
        logger.warn(`没有找到 \`${entry}\` 的入口文件，请检查路径是否正确!`)
      }
      continue
    }

    const normalizedResolvedId = normalizeFsResolvedId(resolvedId.id)
    if (
      normalizedResolvedId
      && !isSkippableResolvedId(normalizedResolvedId)
      && path.isAbsolute(normalizedResolvedId)
    ) {
      pluginCtx.addWatchFile(normalizeWatchPath(normalizedResolvedId))
    }
    if (normalizedResolvedId && !isSkippableResolvedId(normalizedResolvedId)) {
      resolvedEntryMap.set(normalizedResolvedId, resolvedId)
    }

    const isDirtyEntry = dirtyEntrySet.has(normalizedResolvedId)
    if (!isDirtyEntry && loadedEntrySet.has(normalizedResolvedId)) {
      continue
    }

    pendingResolvedIds.push(resolvedId)
    if (isDirtyEntry) {
      dirtyEntrySet.delete(normalizedResolvedId)
    }
  }

  if (pendingResolvedIds.length) {
    await Promise.all(emitEntriesChunks.call(pluginCtx, pendingResolvedIds))
  }

  debug?.(`emitEntriesChunks ${relativeCwdId} 耗时 ${getTime()}`)

  let code = await readFileCached(id, { checkMtime: configService.isDev })

  if (
    type === 'page'
    && templatePath
    && !NON_VUE_PAGE_RE.test(id)
  ) {
    const layoutPlan = await resolvePageLayoutPlan(code, id, configService as any)
    if (layoutPlan) {
      const nativeTemplate = await readFileCached(templatePath, { checkMtime: configService.isDev })
      const transformed = applyPageLayoutPlanToNativePage(
        {
          script: code,
          template: nativeTemplate,
          config: JSON.stringify(json),
        },
        id,
        layoutPlan,
      )

      code = transformed.script ?? code

      if (transformed.config) {
        json = JSON.parse(transformed.config)
      }

      if (transformed.template && wxmlService) {
        const token = wxmlService.analyze(transformed.template)
        wxmlService.tokenMap.set(templatePath, token)
        wxmlService.setWxmlComponentsMap(templatePath, token.components)
      }
    }

    code = injectNativePageLayoutRuntime(code, id, layoutPlan) ?? code
  }

  if (!isPluginBuild || type !== 'app') {
    registerJsonAsset({
      jsonPath,
      json,
      type,
    })
  }
  if (pluginJsonPathForRegistration && pluginJsonForRegistration) {
    registerJsonAsset({
      jsonPath: pluginJsonPathForRegistration,
      json: pluginJsonForRegistration,
      type: 'plugin',
    })
  }

  const styleImports = await collectStyleImports(pluginCtx, id, existsCache, pathExistsTtlMs)

  debug?.(`loadEntry ${relativeCwdId} 耗时 ${getTime()}`)

  if (styleImports.length === 0) {
    return {
      code,
    }
  }

  const ms = new MagicString(code)
  for (const styleImport of styleImports) {
    ms.prepend(`import '${styleImport}';\n`)
  }

  return {
    code: ms.toString(),
  }
}
