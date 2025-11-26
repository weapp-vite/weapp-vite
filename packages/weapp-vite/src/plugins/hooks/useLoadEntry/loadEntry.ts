import type { PluginContext, ResolvedId } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../../context'
import type { Entry } from '../../../types'
import type { ExtendedLibManager } from './extendedLib'
import type { JsonEmitFileEntry } from './jsonEmit'
import { performance } from 'node:perf_hooks'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import { supportedCssLangs } from '../../../constants'
import logger from '../../../logger'
import { changeFileExtension, findJsonEntry, findTemplateEntry } from '../../../utils'
import { analyzeAppJson, analyzeCommonJson, analyzePluginJson } from '../../utils/analyze'

interface EntryLoaderOptions {
  ctx: CompilerContext
  entriesMap: Map<string, Entry | undefined>
  loadedEntrySet: Set<string>
  normalizeEntry: (entry: string, jsonPath: string) => string
  registerJsonAsset: (entry: JsonEmitFileEntry) => void
  scanTemplateEntry: (templateEntry: string) => Promise<void>
  emitEntriesChunks: (this: PluginContext, resolvedIds: (ResolvedId | null)[]) => Promise<unknown>[]
  applyAutoImports: (baseName: string, json: any) => void
  extendedLibManager: ExtendedLibManager
  buildTarget: BuildTarget
  debug?: (...args: any[]) => void
}

function createStopwatch() {
  const start = performance.now()
  return () => `${(performance.now() - start).toFixed(2)}ms`
}

async function addWatchTarget(
  pluginCtx: PluginContext,
  target: string,
  existsCache: Map<string, boolean>,
): Promise<boolean> {
  if (!target || typeof pluginCtx.addWatchFile !== 'function') {
    return false
  }

  if (existsCache.has(target)) {
    const cached = existsCache.get(target)!
    pluginCtx.addWatchFile(target)
    return cached
  }

  const exists = await fs.exists(target)
  pluginCtx.addWatchFile(target)

  existsCache.set(target, exists)
  return exists
}

async function collectStyleImports(
  pluginCtx: PluginContext,
  id: string,
  existsCache: Map<string, boolean>,
) {
  const styleImports: string[] = []
  for (const ext of supportedCssLangs) {
    const mayBeCssPath = changeFileExtension(id, ext)
    const exists = await addWatchTarget(pluginCtx, mayBeCssPath, existsCache)
    if (exists) {
      styleImports.push(mayBeCssPath)
    }
  }
  return styleImports
}

async function collectAppSideFiles(
  pluginCtx: PluginContext,
  id: string,
  json: any,
  jsonService: CompilerContext['jsonService'],
  registerJsonAsset: (entry: JsonEmitFileEntry) => void,
  existsCache: Map<string, boolean>,
) {
  const { sitemapLocation = 'sitemap.json', themeLocation = 'theme.json' } = json

  const processSideJson = async (location?: string) => {
    if (!location) {
      return
    }

    const { path: jsonPath, predictions } = await findJsonEntry(
      path.resolve(path.dirname(id), location),
    )
    for (const prediction of predictions) {
      await addWatchTarget(pluginCtx, prediction, existsCache)
    }

    if (!jsonPath) {
      return
    }

    const content = await jsonService.read(jsonPath)
    registerJsonAsset({
      json: content,
      jsonPath,
      type: 'app',
    })
  }

  await processSideJson(sitemapLocation)
  await processSideJson(themeLocation)
}

async function ensureTemplateScanned(
  pluginCtx: PluginContext,
  id: string,
  scanTemplateEntry: (templateEntry: string) => Promise<void>,
  existsCache: Map<string, boolean>,
) {
  const { path: templateEntry, predictions } = await findTemplateEntry(id)
  for (const prediction of predictions) {
    await addWatchTarget(pluginCtx, prediction, existsCache)
  }

  if (!templateEntry) {
    return ''
  }

  await scanTemplateEntry(templateEntry)

  return templateEntry
}

async function resolveEntries(
  this: PluginContext,
  entries: string[],
  absoluteRoot: string,
) {
  return Promise.all(
    entries
      .filter(entry => !entry.includes(':'))
      .map(async (entry) => {
        const absPath = path.resolve(absoluteRoot, entry)
        return {
          entry,
          resolvedId: await this.resolve(absPath),
        }
      }),
  )
}

export function createEntryLoader(options: EntryLoaderOptions) {
  const {
    ctx,
    entriesMap,
    loadedEntrySet,
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    extendedLibManager,
    buildTarget,
    debug,
  } = options

  const isPluginBuild = buildTarget === 'plugin'
  const { jsonService, configService, scanService } = ctx
  const existsCache = new Map<string, boolean>()

  return async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    existsCache.clear()
    const stopwatch = debug ? createStopwatch() : undefined
    const getTime = () => (stopwatch ? stopwatch() : '0.00ms')
    const relativeCwdId = configService.relativeCwd(id)

    this.addWatchFile(id)
    const baseName = removeExtensionDeep(id)

    const jsonEntry = await findJsonEntry(id)
    let jsonPath = jsonEntry.path

    for (const prediction of jsonEntry.predictions) {
      await addWatchTarget(this, prediction, existsCache)
    }

    let json: any = {}
    if (jsonPath) {
      json = await jsonService.read(jsonPath)
    }
    else {
      jsonPath = changeFileExtension(id, '.json')
    }

    const entries: string[] = []
    let templatePath = ''
    let pluginResolvedRecords: Awaited<ReturnType<typeof resolveEntries>> | undefined
    let pluginJsonPathForRegistration: string | undefined
    let pluginJsonForRegistration: any

    if (type === 'app') {
      if (!isPluginBuild) {
        extendedLibManager.syncFromAppJson(json)
        entries.push(...analyzeAppJson(json))
        await collectAppSideFiles(
          this,
          id,
          json,
          jsonService,
          registerJsonAsset,
          existsCache,
        )
      }

      const pluginJsonPath = scanService?.pluginJsonPath
      if (configService.absolutePluginRoot && pluginJsonPath) {
        this.addWatchFile(pluginJsonPath)
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
                resolvedId: await this.resolve(absPath),
              }
            }),
          )
          pluginResolvedRecords = pluginRecords.filter((record): record is { entry: string, resolvedId: ResolvedId | null } => Boolean(record))
        }
      }
    }
    else {
      templatePath = await ensureTemplateScanned(this, id, scanTemplateEntry, existsCache)
      applyAutoImports(baseName, json)
      entries.push(...analyzeCommonJson(json))
    }

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

    const resolvedIds = normalizedEntries.length
      ? await resolveEntries.call(
          this,
          normalizedEntries,
          configService.absoluteSrcRoot,
        )
      : []

    debug?.(`resolvedIds ${relativeCwdId} 耗时 ${getTime()}`)

    const pendingResolvedIds: ResolvedId[] = []
    const combinedResolved = pluginResolvedRecords
      ? (isPluginBuild ? pluginResolvedRecords : [...resolvedIds, ...pluginResolvedRecords])
      : resolvedIds
    const pluginEntrySet = pluginResolvedRecords
      ? new Set(pluginResolvedRecords.map(record => record.entry))
      : undefined

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

      if (loadedEntrySet.has(resolvedId.id)) {
        continue
      }

      pendingResolvedIds.push(resolvedId)
    }

    if (pendingResolvedIds.length) {
      await Promise.all(emitEntriesChunks.call(this, pendingResolvedIds))
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

    const code = await fs.readFile(id, 'utf8')
    const styleImports = await collectStyleImports(this, id, existsCache)

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
}
