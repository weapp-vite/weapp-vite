import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import type { ResolvedEntryRecord } from './resolve'
import path from 'pathe'
import { analyzeAppJson, analyzePluginJson } from '../../../utils/analyze'
import { collectAppSideFiles } from './watch'

export interface AppEntryResult {
  entries: string[]
  pluginResolvedRecords?: ResolvedEntryRecord[]
  pluginJsonPathForRegistration?: string
  pluginJsonForRegistration?: any
}

interface CollectAppEntriesOptions {
  pluginCtx: PluginContext
  id: string
  json: any
  ctx: CompilerContext
  isPluginBuild: boolean
  registerJsonAsset: (entry: JsonEmitFileEntry) => void
  existsCache: Map<string, boolean>
  pathExistsTtlMs: number
  normalizeEntry: (entry: string, jsonPath: string) => string
  resolveEntryWithCache: (pluginCtx: PluginContext, absPath: string) => Promise<ResolvedEntryRecord['resolvedId']>
  extendedLibManager: ExtendedLibManager
}

export async function collectAppEntries(options: CollectAppEntriesOptions): Promise<AppEntryResult> {
  const {
    pluginCtx,
    id,
    json,
    ctx,
    isPluginBuild,
    registerJsonAsset,
    existsCache,
    pathExistsTtlMs,
    normalizeEntry,
    resolveEntryWithCache,
    extendedLibManager,
  } = options

  const { jsonService, configService, scanService } = ctx
  const entries: string[] = []
  let pluginResolvedRecords: ResolvedEntryRecord[] | undefined
  let pluginJsonPathForRegistration: string | undefined
  let pluginJsonForRegistration: any

  if (!isPluginBuild) {
    extendedLibManager.syncFromAppJson(json)
    entries.push(...analyzeAppJson(json))
    await collectAppSideFiles(
      pluginCtx,
      id,
      json,
      jsonService,
      registerJsonAsset,
      existsCache,
      pathExistsTtlMs,
    )
  }

  const pluginJsonPath = scanService?.pluginJsonPath
  if (configService.absolutePluginRoot && pluginJsonPath) {
    pluginCtx.addWatchFile(pluginJsonPath)
    const pluginJson = await jsonService.read(pluginJsonPath)
    if (pluginJson && typeof pluginJson === 'object') {
      if (scanService) {
        scanService.pluginJson = pluginJson
      }
      pluginJsonPathForRegistration = pluginJsonPath
      pluginJsonForRegistration = pluginJson
      const pluginEntries = analyzePluginJson(pluginJson)
      const pluginBaseDir = path.dirname(pluginJsonPath)
      const pluginRecords = await Promise.all(
        pluginEntries.map(async (entry) => {
          const normalizedEntry = normalizeEntry(entry, pluginJsonPath)
          if (normalizedEntry.includes(':')) {
            return null
          }
          const absPath = path.resolve(pluginBaseDir, entry)
          return {
            entry: normalizedEntry,
            resolvedId: await resolveEntryWithCache(pluginCtx, absPath),
          }
        }),
      )
      pluginResolvedRecords = pluginRecords.filter((record): record is ResolvedEntryRecord => Boolean(record))
    }
  }

  return {
    entries,
    pluginResolvedRecords,
    pluginJsonPathForRegistration,
    pluginJsonForRegistration,
  }
}
