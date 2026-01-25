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
import { collectStyleImports } from './watch'

interface NormalizedEntryOptions {
  entries: string[]
  json: any
  jsonPath: string
  templatePath: string
  id: string
  isPluginBuild: boolean
  entriesMap: Map<string, Entry | undefined>
  normalizeEntry: (entry: string, jsonPath: string) => string
  extendedLibManager: ExtendedLibManager
}

export function prepareNormalizedEntries(options: NormalizedEntryOptions) {
  const {
    entries,
    json,
    jsonPath,
    templatePath,
    id,
    isPluginBuild,
    entriesMap,
    normalizeEntry,
    extendedLibManager,
  } = options

  const filteredEntries = isPluginBuild
    ? []
    : entries.filter(entry => !extendedLibManager.shouldIgnoreEntry(entry))
  const normalizedEntries = isPluginBuild
    ? []
    : filteredEntries.map(entry => normalizeEntry(entry, jsonPath))
  if (!isPluginBuild) {
    for (const normalizedEntry of normalizedEntries) {
      entriesMap.set(normalizedEntry, {
        type: json.component ? 'component' : 'page',
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
  isPluginBuild: boolean
  normalizedEntries: string[]
  pluginResolvedRecords?: ResolvedEntryRecord[]
  pluginJsonPathForRegistration?: string
  pluginJsonForRegistration?: any
  resolveEntriesWithCache: (pluginCtx: PluginContext, entries: string[], absoluteRoot: string) => Promise<ResolvedEntryRecord[]>
  configService: CompilerContext['configService']
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
}

export async function emitEntryOutput(options: EmitEntryOutputOptions) {
  const {
    pluginCtx,
    id,
    type,
    json,
    jsonPath,
    isPluginBuild,
    normalizedEntries,
    pluginResolvedRecords,
    pluginJsonPathForRegistration,
    pluginJsonForRegistration,
    resolveEntriesWithCache,
    configService,
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

  const shouldSkipEntries = Boolean(options.skipEntries)
  const resolvedIds = shouldSkipEntries
    ? []
    : normalizedEntries.length
      ? await resolveEntriesWithCache(
          pluginCtx,
          normalizedEntries,
          configService.absoluteSrcRoot,
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

  if (!isPluginBuild) {
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

  const code = await readFileCached(id, { checkMtime: configService.isDev })
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
