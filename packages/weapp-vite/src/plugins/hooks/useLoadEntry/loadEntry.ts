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
import { parse as parseSfc } from 'vue/compiler-sfc'
import { supportedCssLangs } from '../../../constants'
import logger from '../../../logger'
import { changeFileExtension, extractConfigFromVue, findJsonEntry, findTemplateEntry, findVueEntry } from '../../../utils'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../utils/babel'
import { resolveEntryPath } from '../../../utils/entryResolve'
import { resolveReExportedName } from '../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../utils/usingComponentFrom'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../utils/vueTemplateTags'
import { analyzeAppJson, analyzeCommonJson, analyzePluginJson } from '../../utils/analyze'
import { readFile as readFileCached } from '../../utils/cache'

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
  buildTarget?: BuildTarget
  debug?: (...args: any[]) => void
}

function createStopwatch() {
  const start = performance.now()
  return () => `${(performance.now() - start).toFixed(2)}ms`
}

function collectVueTemplateComponentNames(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto usingComponents',
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag),
  })
}

function collectVueTemplateAutoImportTags(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto import tags',
    shouldCollect: isAutoImportCandidateTag,
  })
}

function collectScriptSetupImports(scriptSetup: string, templateComponentNames: Set<string>) {
  const results: Array<{ localName: string, importSource: string, importedName?: string, kind: 'default' | 'named' }> = []
  const ast = babelParse(scriptSetup, BABEL_TS_MODULE_PARSER_OPTIONS)

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') {
      continue
    }
    // @ts-ignore - babel AST shape
    const importKind = (node as any).importKind
    if (importKind === 'type') {
      continue
    }

    const importSource = node.source.value
    for (const specifier of node.specifiers) {
      // @ts-ignore - babel AST shape
      if ((specifier as any).importKind === 'type') {
        continue
      }
      const localName = specifier.local?.name
      if (!localName || !templateComponentNames.has(localName)) {
        continue
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        results.push({ localName, importSource, importedName: 'default', kind: 'default' })
      }
      else if (specifier.type === 'ImportSpecifier') {
        const imported = (specifier as any).imported
        const importedName = imported?.type === 'Identifier'
          ? imported.name
          : imported?.type === 'StringLiteral'
            ? imported.value
            : undefined
        results.push({ localName, importSource, importedName, kind: 'named' })
      }
    }
  }

  return results
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
    debug,
  } = options

  const buildTarget = options.buildTarget ?? 'app'
  const isPluginBuild = buildTarget === 'plugin'
  const { jsonService, configService, scanService, wxmlService } = ctx
  const existsCache = new Map<string, boolean>()
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
      await addWatchTarget(this, prediction, existsCache)
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
      templatePath = await ensureTemplateScanned(this, id, scanTemplateEntry, existsCache)

      // <script setup> 自动 usingComponents：import 后模板使用的组件无需在 <json> 注册
      if (vueEntryPath) {
        try {
          const vueSource = await readFileCached(vueEntryPath, { checkMtime: configService.isDev })
          const { descriptor, errors } = parseSfc(vueSource, { filename: vueEntryPath })
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
                      exists: (p: string) => fs.exists(p),
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

    const code = await readFileCached(id, { checkMtime: configService.isDev })
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

  return Object.assign(loadEntry, {
    invalidateResolveCache() {
      entryResolutionCache.clear()
    },
  })
}
