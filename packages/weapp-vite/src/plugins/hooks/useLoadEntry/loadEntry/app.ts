import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import type { ResolvedEntryRecord } from './resolve'
import { createHash } from 'node:crypto'
import path from 'pathe'
import { analyzeAppJson, analyzePluginJson } from '../../../utils/analyze'
import { collectAppSideFiles } from './watch'

export interface AppEntryResult {
  entries: string[]
  pluginResolvedRecords?: ResolvedEntryRecord[]
  pluginJsonPathForRegistration?: string
  pluginJsonForRegistration?: any
  appSignature: string
  pluginSignature?: string
  pluginJsonPath?: string
  cacheHit?: boolean
}

export interface AppEntriesCache {
  appSignature: string
  pluginSignature?: string
  pluginJsonPath?: string
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
  cache?: { current?: AppEntriesCache }
}

function createJsonSignature(value: unknown) {
  let raw = ''
  try {
    raw = JSON.stringify(value) ?? ''
  }
  catch {
    raw = String(value ?? '')
  }
  return createHash('sha256').update(raw).digest('hex').slice(0, 12)
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
    cache,
  } = options

  const { jsonService, configService, scanService } = ctx
  const entries: string[] = []
  const appSignature = createJsonSignature(json)
  const useCache = configService.isDev && !isPluginBuild
  let pluginResolvedRecords: ResolvedEntryRecord[] | undefined
  let pluginJsonPathForRegistration: string | undefined
  let pluginJsonForRegistration: any
  let pluginSignature: string | undefined

  if (!isPluginBuild) {
    extendedLibManager.syncFromAppJson(json)
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
      pluginSignature = createJsonSignature(pluginJson)
      if (scanService) {
        scanService.pluginJson = pluginJson
      }
      pluginJsonPathForRegistration = pluginJsonPath
      pluginJsonForRegistration = pluginJson
    }
  }

  if (useCache && cache?.current) {
    const cached = cache.current
    const pluginPathMatches = cached.pluginJsonPath === pluginJsonPath
    const pluginSignatureMatches = cached.pluginSignature === pluginSignature
    if (cached.appSignature === appSignature && pluginPathMatches && pluginSignatureMatches) {
      return {
        entries: cached.entries,
        pluginResolvedRecords: cached.pluginResolvedRecords,
        pluginJsonPathForRegistration: cached.pluginJsonPathForRegistration,
        pluginJsonForRegistration: cached.pluginJsonForRegistration,
        appSignature,
        pluginSignature,
        pluginJsonPath,
        cacheHit: true,
      }
    }
  }

  if (!isPluginBuild) {
    entries.push(...analyzeAppJson(json))
  }

  if (pluginJsonForRegistration && pluginJsonPathForRegistration) {
    const pluginEntries = analyzePluginJson(pluginJsonForRegistration)
    const pluginBaseDir = path.dirname(pluginJsonPathForRegistration)
    const pluginRecords = await Promise.all(
      pluginEntries.map(async (entry) => {
        const normalizedEntry = normalizeEntry(entry, pluginJsonPathForRegistration)
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

  if (useCache && cache) {
    cache.current = {
      appSignature,
      pluginSignature,
      pluginJsonPath,
      entries: [...entries],
      pluginResolvedRecords,
      pluginJsonPathForRegistration,
      pluginJsonForRegistration,
    }
  }

  return {
    entries,
    pluginResolvedRecords,
    pluginJsonPathForRegistration,
    pluginJsonForRegistration,
    appSignature,
    pluginSignature,
    pluginJsonPath,
    cacheHit: false,
  }
}
