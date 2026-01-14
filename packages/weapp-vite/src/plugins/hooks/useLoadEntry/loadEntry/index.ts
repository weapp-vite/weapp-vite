import type { PluginContext, ResolvedId } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../../../context'
import type { Entry } from '../../../../types'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import { performance } from 'node:perf_hooks'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'
import logger from '../../../../logger'
import { changeFileExtension, extractConfigFromVue, findJsonEntry, findVueEntry } from '../../../../utils'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { resolveEntryPath } from '../../../../utils/entryResolve'
import { resolveReExportedName } from '../../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../../utils/usingComponentFrom'
import { analyzeAppJson, analyzeCommonJson, analyzePluginJson } from '../../../utils/analyze'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../../../utils/cache'
import { getSfcCheckMtime, readAndParseSfc } from '../../../utils/vueSfc'
import { collectScriptSetupImports, collectVueTemplateAutoImportTags, collectVueTemplateComponentNames } from './template'
import { addWatchTarget, collectAppSideFiles, collectStyleImports, ensureTemplateScanned } from './watch'

interface EntryLoaderOptions {
  ctx: CompilerContext
  entriesMap: Map<string, Entry | undefined>
  loadedEntrySet: Set<string>
  dirtyEntrySet: Set<string>
  resolvedEntryMap: Map<string, ResolvedId>
  normalizeEntry: (entry: string, jsonPath: string) => string
  registerJsonAsset: (entry: JsonEmitFileEntry) => void
  scanTemplateEntry: (templateEntry: string) => Promise<void>
  emitEntriesChunks: (this: PluginContext, resolvedIds: (ResolvedId | null)[]) => Promise<unknown>[]
  applyAutoImports: (baseName: string, json: any) => void
  extendedLibManager: ExtendedLibManager
  buildTarget?: BuildTarget
  debug?: (...args: any[]) => void
}

function createStopwatch() {
  const start = performance.now()
  return () => `${(performance.now() - start).toFixed(2)}ms`
}

export function createEntryLoader(options: EntryLoaderOptions) {
  const {
    ctx,
    entriesMap,
    loadedEntrySet,
    dirtyEntrySet,
    resolvedEntryMap,
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    extendedLibManager,
    debug,
  } = options

  const buildTarget = options.buildTarget ?? 'app'
  const isPluginBuild = buildTarget === 'plugin'
  const { jsonService, configService, scanService, wxmlService } = ctx
  const existsCache = new Map<string, boolean>()
  const pathExistsTtlMs = getPathExistsTtlMs(configService)
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const entryResolutionCache = new Map<string, ResolvedId | null>()

  async function resolveEntryWithCache(pluginCtx: PluginContext, absPath: string) {
    const normalized = path.normalize(absPath)
    if (entryResolutionCache.has(normalized)) {
      return entryResolutionCache.get(normalized) ?? null
    }
    const resolved = await pluginCtx.resolve(normalized)
    const resolvedId = resolved ?? null
    entryResolutionCache.set(normalized, resolvedId)
    return resolvedId
  }

  async function resolveEntriesWithCache(
    pluginCtx: PluginContext,
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
            resolvedId: await resolveEntryWithCache(pluginCtx, absPath),
          }
        }),
    )
  }

  const loadEntry = async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    existsCache.clear()
    const stopwatch = debug ? createStopwatch() : undefined
    const getTime = () => (stopwatch ? stopwatch() : '0.00ms')
    const relativeCwdId = configService.relativeCwd(id)

    this.addWatchFile(id)
    const baseName = removeExtensionDeep(id)

    const jsonEntry = await findJsonEntry(id)
    let jsonPath = jsonEntry.path

    for (const prediction of jsonEntry.predictions) {
      await addWatchTarget(this, prediction, existsCache, pathExistsTtlMs)
    }

    let json: any = {}
    if (jsonPath) {
      json = await jsonService.read(jsonPath)
    }
    else {
      jsonPath = changeFileExtension(id, '.json')
    }

    // 回退：当不存在 .json 时，尝试从 .vue 的 <json> 块读取配置
    const vueEntryPath = id.endsWith('.vue')
      ? id
      : await findVueEntry(removeExtensionDeep(id))

    if (vueEntryPath) {
      this.addWatchFile(vueEntryPath)
    }

    if (!jsonEntry.path) {
      if (vueEntryPath) {
        const configFromVue = await extractConfigFromVue(vueEntryPath)
        if (configFromVue && typeof configFromVue === 'object') {
          json = configFromVue
        }
      }
    }

    const entries: string[] = []
    let templatePath = ''
    let pluginResolvedRecords: Array<{ entry: string, resolvedId: ResolvedId | null }> | undefined
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
          pathExistsTtlMs,
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
                resolvedId: await resolveEntryWithCache(this, absPath),
              }
            }),
          )
          pluginResolvedRecords = pluginRecords.filter((record): record is { entry: string, resolvedId: ResolvedId | null } => Boolean(record))
        }
      }
    }
    else {
      templatePath = await ensureTemplateScanned(this, id, scanTemplateEntry, existsCache, pathExistsTtlMs)

      // <script setup> 自动 usingComponents：import 后模板使用的组件无需在 <json> 注册
      if (vueEntryPath) {
        try {
          const { descriptor, errors } = await readAndParseSfc(vueEntryPath, { checkMtime: getSfcCheckMtime(configService) })
          if (!errors?.length && descriptor?.template && !templatePath) {
            const tags = collectVueTemplateAutoImportTags(descriptor.template.content, vueEntryPath)
            if (tags.size) {
              const components = Object.fromEntries(
                Array.from(tags).map(tag => [tag, [{ start: 0, end: 0 }]]),
              )
              wxmlService?.setWxmlComponentsMap(vueEntryPath, components)
            }
          }

          if (!errors?.length && descriptor?.scriptSetup && descriptor?.template) {
            const templateComponentNames = collectVueTemplateComponentNames(descriptor.template.content, vueEntryPath)
            if (templateComponentNames.size) {
              const imports = collectScriptSetupImports(descriptor.scriptSetup.content, templateComponentNames)
              if (imports.length) {
                const usingComponents: Record<string, string> = (
                  json && typeof json.usingComponents === 'object' && json.usingComponents && !Array.isArray(json.usingComponents)
                    ? json.usingComponents
                    : {}
                )

                for (const { localName, importSource, importedName, kind } of imports) {
                  const resolved = await this.resolve(importSource, vueEntryPath)
                  let resolvedId = resolved?.id ? normalizeFsResolvedId(resolved.id) : undefined
                  if (!resolvedId || !path.isAbsolute(resolvedId)) {
                    if (importSource.startsWith('.')) {
                      resolvedId = path.resolve(path.dirname(vueEntryPath), importSource)
                    }
                  }

                  if (resolvedId && path.isAbsolute(resolvedId) && !path.extname(resolvedId)) {
                    const matched = await resolveEntryPath(resolvedId, {
                      kind,
                      exists: (p: string) => pathExistsCached(p, { ttlMs: getPathExistsTtlMs(configService) }),
                      stat: (p: string) => fs.stat(p) as any,
                    })
                    if (matched) {
                      resolvedId = matched
                    }
                  }

                  // 桶文件（barrel）支持：import { X } from '.../components' => 解析 re-export 到真实组件文件
                  if (kind === 'named' && importedName && resolvedId && path.isAbsolute(resolvedId) && /\.(?:[cm]?ts|[cm]?js)$/.test(resolvedId)) {
                    const mapped = await resolveReExportedName(resolvedId, importedName, {
                      cache: reExportResolutionCache,
                      maxDepth: 4,
                      readFile: file => readFileCached(file, { checkMtime: configService.isDev }),
                      resolveId: async (source, importer) => {
                        const hop = await this.resolve(source, importer)
                        const hopId = hop?.id ? normalizeFsResolvedId(hop.id) : undefined
                        if (isSkippableResolvedId(hopId)) {
                          return undefined
                        }
                        return hopId
                      },
                    })
                    if (mapped) {
                      resolvedId = mapped
                    }
                  }

                  let from: string | undefined
                  from = usingComponentFromResolvedFile(resolvedId, configService)

                  if (!from && importSource.startsWith('/')) {
                    from = removeExtensionDeep(importSource)
                  }

                  if (!from) {
                    continue
                  }

                  if (Reflect.has(usingComponents, localName) && usingComponents[localName] !== from) {
                    logger.warn(
                      `[auto usingComponents] 冲突: ${vueEntryPath} 中 usingComponents['${localName}']='${usingComponents[localName]}' 将被 script setup import 覆盖为 '${from}'`,
                    )
                  }

                  usingComponents[localName] = from
                }

                json.usingComponents = usingComponents
              }
            }
          }
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.warn(`[auto usingComponents] 解析失败: ${vueEntryPath}: ${message}`)
        }
      }

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
      ? await resolveEntriesWithCache(
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

      const normalizedResolvedId = normalizeFsResolvedId(resolvedId.id)
      if (
        normalizedResolvedId
        && !isSkippableResolvedId(normalizedResolvedId)
        && path.isAbsolute(normalizedResolvedId)
      ) {
        this.addWatchFile(normalizedResolvedId)
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

    const code = await readFileCached(id, { checkMtime: configService.isDev })
    const styleImports = await collectStyleImports(this, id, existsCache, pathExistsTtlMs)

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

  return Object.assign(loadEntry, {
    invalidateResolveCache() {
      entryResolutionCache.clear()
    },
  })
}
