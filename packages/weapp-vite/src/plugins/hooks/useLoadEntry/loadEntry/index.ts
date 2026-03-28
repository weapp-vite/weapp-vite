import type { PluginContext, ResolvedId } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../../../context'
import type { Entry } from '../../../../types'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import type { AppEntriesCache } from './app'
import type { ResolvedEntryRecord } from './resolve'
import { performance } from 'node:perf_hooks'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'
// eslint-disable-next-line e18e/ban-dependencies -- 本模块仍沿用 fs-extra 处理入口文件系统读写
import fs from 'fs-extra'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { changeFileExtension, extractConfigFromVue, findCssEntry, findJsonEntry, findVueEntry } from '../../../../utils'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../../utils/babel'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { resolveCompilerOutputExtensions } from '../../../../utils/outputExtensions'
import { isPathInside, normalizeWatchPath } from '../../../../utils/path'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { analyzeCommonJson } from '../../../utils/analyze'
import { collectNativeLayoutAssets, resolvePageLayoutPlan } from '../../../vue/transform/pageLayout'
import { collectAppEntries } from './app'
import { emitEntryOutput, prepareNormalizedEntries } from './emit'
import { createEntryResolver } from './resolve'
import { applyScriptSetupUsingComponents, scanTemplateEntry } from './template'
import { addWatchTarget } from './watch'

interface EntryLoaderOptions {
  ctx: CompilerContext
  entriesMap: Map<string, Entry | undefined>
  loadedEntrySet: Set<string>
  dirtyEntrySet: Set<string>
  resolvedEntryMap: Map<string, ResolvedId>
  replaceLayoutDependencies: (entryId: string, dependencies: Iterable<string>) => void
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

function isDefineComponentJsonOnlyScript(content: string) {
  const ast = babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS)
  let hasDefineComponentJson = false

  for (const statement of ast.program.body) {
    if (t.isEmptyStatement(statement)) {
      continue
    }
    if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression)) {
      return false
    }
    const call = statement.expression
    if (!t.isIdentifier(call.callee, { name: 'defineComponentJson' })) {
      return false
    }
    hasDefineComponentJson = true
  }

  return hasDefineComponentJson
}

const WEVU_TEMPLATE_RUNTIME_BINDING_ATTR_RE = /(?:^|[\s<])(?:ref|:ref|v-bind:ref|layout-host|:layout-host|v-bind:layout-host)\s*=/

function hasWevuTemplateRuntimeBindings(template: string | undefined) {
  return typeof template === 'string' && WEVU_TEMPLATE_RUNTIME_BINDING_ATTR_RE.test(template)
}

export function createEntryLoader(options: EntryLoaderOptions) {
  const {
    ctx,
    entriesMap,
    loadedEntrySet,
    dirtyEntrySet,
    resolvedEntryMap,
    replaceLayoutDependencies,
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry: scanTemplateEntryFn,
    emitEntriesChunks,
    applyAutoImports,
    extendedLibManager,
    debug,
  } = options

  const buildTarget = options.buildTarget ?? 'app'
  const isPluginBuild = buildTarget === 'plugin'
  const { jsonService, configService, wxmlService } = ctx
  const existsCache = new Map<string, boolean>()
  const pathExistsTtlMs = getPathExistsTtlMs(configService)
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const entryResolver = createEntryResolver(configService)
  const appEntriesCache: { current?: AppEntriesCache } = {}
  const appEntryOutputCache: {
    current?: {
      appSignature: string
      pluginSignature?: string
      pluginJsonPath?: string
      autoRoutesSignature?: string
      resolveCacheVersion: number
    }
  } = {}
  const emittedScriptlessVueLayoutJs = new Set<string>()
  const scriptlessVueLayoutDecisionCache = new Map<string, Promise<boolean>>()
  let resolveCacheVersion = 0

  const shouldEmitScriptlessVueLayoutJs = async (layoutFile: string) => {
    const cached = scriptlessVueLayoutDecisionCache.get(layoutFile)
    if (cached) {
      return await cached
    }

    const task = (async () => {
      const layoutSource = await fs.readFile(layoutFile, 'utf-8')
      const { descriptor } = parseSfc(layoutSource, { filename: layoutFile })
      if (hasWevuTemplateRuntimeBindings(descriptor.template?.content)) {
        return false
      }
      const blocks = [descriptor.script?.content, descriptor.scriptSetup?.content]
        .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)

      if (blocks.length === 0) {
        return true
      }

      return blocks.every(isDefineComponentJsonOnlyScript)
    })()

    scriptlessVueLayoutDecisionCache.set(layoutFile, task)
    try {
      return await task
    }
    catch (error) {
      scriptlessVueLayoutDecisionCache.delete(layoutFile)
      throw error
    }
  }

  const loadEntry = async function loadEntry(this: PluginContext, id: string, type: 'app' | 'page' | 'component') {
    existsCache.clear()
    const stopwatch = debug ? createStopwatch() : undefined
    const getTime = () => (stopwatch ? stopwatch() : '0.00ms')
    const relativeCwdId = configService.relativeCwd(id)
    const normalizedId = normalizeFsResolvedId(id)
    const libConfig = configService.weappLibConfig
    const libEntry = libConfig?.enabled && normalizedId
      ? ctx.runtimeState.lib.entries.get(normalizedId)
      : undefined

    this.addWatchFile(normalizeWatchPath(id))
    const baseName = removeExtensionDeep(id)

    const jsonEntry = await findJsonEntry(id)
    let jsonPath = jsonEntry.path
    let hasJsonEntry = Boolean(jsonPath)

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
      this.addWatchFile(normalizeWatchPath(vueEntryPath))
    }

    if (!jsonEntry.path) {
      if (vueEntryPath) {
        const configFromVue = await extractConfigFromVue(vueEntryPath)
        if (configFromVue && typeof configFromVue === 'object') {
          json = configFromVue
          hasJsonEntry = true
        }
      }
    }

    const entries: string[] = []
    const explicitEntryTypes = new Map<string, Entry['type']>()
    let templatePath = ''
    let entryTypeOverride: Entry['type'] | undefined
    let pluginResolvedRecords: ResolvedEntryRecord[] | undefined
    let pluginJsonPathForRegistration: string | undefined
    let pluginJsonForRegistration: any
    let appResult: Awaited<ReturnType<typeof collectAppEntries>> | undefined
    let shouldSkipAppEntries = false
    const nativeLayoutScriptEntries = new Set<string>()
    const autoRoutesSignature = configService.isDev
      ? ctx.autoRoutesService?.getSignature?.()
      : undefined

    if (type === 'app') {
      appResult = await collectAppEntries({
        pluginCtx: this,
        id,
        json,
        ctx,
        isPluginBuild,
        registerJsonAsset,
        existsCache,
        pathExistsTtlMs,
        normalizeEntry,
        resolveEntryWithCache: entryResolver.resolveEntryWithCache,
        extendedLibManager,
        cache: appEntriesCache,
      })
      entries.push(...appResult.entries)
      pluginResolvedRecords = appResult.pluginResolvedRecords
      if (appResult.pluginEntryTypes?.length) {
        for (const entryType of appResult.pluginEntryTypes) {
          entriesMap.set(entryType.entry, {
            type: entryType.type,
            path: entryType.entry,
          } as Entry)
        }
      }
      pluginJsonPathForRegistration = appResult.pluginJsonPathForRegistration
      pluginJsonForRegistration = appResult.pluginJsonForRegistration
      shouldSkipAppEntries = Boolean(
        configService.isDev
        && !isPluginBuild
        && appResult.cacheHit
        && appEntryOutputCache.current
        && appEntryOutputCache.current.appSignature === appResult.appSignature
        && appEntryOutputCache.current.pluginSignature === appResult.pluginSignature
        && appEntryOutputCache.current.pluginJsonPath === appResult.pluginJsonPath
        && appEntryOutputCache.current.autoRoutesSignature === autoRoutesSignature
        && appEntryOutputCache.current.resolveCacheVersion === resolveCacheVersion,
      )
    }
    else {
      templatePath = await scanTemplateEntry(this, id, scanTemplateEntryFn, existsCache, pathExistsTtlMs)

      if (libEntry && libConfig) {
        const componentJson = libConfig.componentJson ?? 'auto'
        const hasTemplate = Boolean(templatePath) || id.endsWith('.vue')
        const styleEntry = await findCssEntry(baseName)
        const hasStyle = Boolean(styleEntry.path)
        const shouldTreatAsComponent = hasTemplate || hasStyle || Boolean(json?.component)

        if (!hasJsonEntry && shouldTreatAsComponent) {
          const shouldGenerate = componentJson === true || componentJson === 'auto' || typeof componentJson === 'function'
          if (shouldGenerate) {
            const extra = typeof componentJson === 'function'
              ? componentJson({ name: libEntry.name, input: libEntry.input })
              : undefined
            if (typeof componentJson === 'function' && !isObject(extra)) {
              throw new Error('`weapp.lib.componentJson` 必须返回对象。')
            }
            json = {
              component: true,
              ...(isObject(extra) ? extra : {}),
            }
            hasJsonEntry = true
          }
        }

        if (shouldTreatAsComponent) {
          entryTypeOverride = 'component'
        }
      }

      // <script setup> 自动 usingComponents：import 后模板使用的组件无需在 <json> 注册
      if (vueEntryPath) {
        await applyScriptSetupUsingComponents({
          pluginCtx: this,
          vueEntryPath,
          templatePath,
          json,
          configService,
          wxmlService,
          reExportResolutionCache,
        })

        if (type === 'page') {
          const vueSource = await fs.readFile(vueEntryPath, 'utf-8')
          const layoutPlan = await resolvePageLayoutPlan(vueSource, vueEntryPath, configService as any)
          if (layoutPlan) {
            for (const layout of layoutPlan.layouts) {
              this.addWatchFile(normalizeWatchPath(layout.file))
              if (layout.kind === 'native') {
                const nativeAssets = await collectNativeLayoutAssets(layout.file)
                for (const asset of Object.values(nativeAssets)) {
                  if (asset) {
                    this.addWatchFile(normalizeWatchPath(asset))
                  }
                }
                if (nativeAssets.script) {
                  entries.push(layout.importPath)
                  nativeLayoutScriptEntries.add(normalizeEntry(layout.importPath, jsonPath))
                  explicitEntryTypes.set(normalizeEntry(layout.importPath, jsonPath), 'component')
                }
                continue
              }
              entries.push(layout.importPath)
              explicitEntryTypes.set(normalizeEntry(layout.importPath, jsonPath), 'component')

              if (!layout.file.endsWith('.vue')) {
                continue
              }
              if (!await shouldEmitScriptlessVueLayoutJs(layout.file)) {
                continue
              }
              const relativeLayoutBase = configService.relativeOutputPath(removeExtensionDeep(layout.file))
              if (!relativeLayoutBase || emittedScriptlessVueLayoutJs.has(relativeLayoutBase)) {
                continue
              }
              emittedScriptlessVueLayoutJs.add(relativeLayoutBase)
              const { scriptExtension } = resolveCompilerOutputExtensions(configService.outputExtensions)
              this.emitFile({
                type: 'asset',
                fileName: `${relativeLayoutBase}.${scriptExtension}`,
                source: 'Component({})',
              })
            }
          }
        }
      }

      await ctx.autoImportService?.awaitPendingRegistrations?.()
      applyAutoImports(baseName, json)
      const componentEntries = analyzeCommonJson(json)
      entries.push(...componentEntries)
      for (const componentEntry of componentEntries) {
        explicitEntryTypes.set(normalizeEntry(componentEntry, jsonPath), 'component')
      }
    }

    const normalizedEntries = shouldSkipAppEntries
      ? []
      : prepareNormalizedEntries({
          entries,
          json,
          jsonPath,
          templatePath,
          id,
          skipOwnEntries: isPluginBuild && type === 'app',
          entriesMap,
          normalizeEntry,
          extendedLibManager,
          entryType: entryTypeOverride,
          explicitEntryTypes,
        })

    for (const nativeLayoutEntry of nativeLayoutScriptEntries) {
      const mapped = entriesMap.get(nativeLayoutEntry)
      if (!mapped) {
        continue
      }
      mapped.type = 'component'
    }

    const entryResolveRoot = (
      isPluginBuild
      && configService.absolutePluginRoot
      && isPathInside(configService.absolutePluginRoot, id)
    )
      ? configService.absolutePluginRoot
      : configService.absoluteSrcRoot

    const result = await emitEntryOutput({
      pluginCtx: this,
      id,
      type,
      json,
      jsonPath,
      templatePath,
      isPluginBuild,
      normalizedEntries,
      pluginResolvedRecords,
      pluginJsonPathForRegistration,
      pluginJsonForRegistration,
      resolveEntriesWithCache: entryResolver.resolveEntriesWithCache,
      entryResolveRoot,
      configService,
      wxmlService,
      resolvedEntryMap,
      loadedEntrySet,
      dirtyEntrySet,
      replaceLayoutDependencies,
      emitEntriesChunks,
      registerJsonAsset,
      existsCache,
      pathExistsTtlMs,
      debug,
      relativeCwdId,
      getTime,
      skipEntries: shouldSkipAppEntries,
    })

    if (type === 'app' && !shouldSkipAppEntries && appResult) {
      appEntryOutputCache.current = {
        appSignature: appResult.appSignature,
        pluginSignature: appResult.pluginSignature,
        pluginJsonPath: appResult.pluginJsonPath,
        autoRoutesSignature,
        resolveCacheVersion,
      }
    }

    return result
  }

  return Object.assign(loadEntry, {
    invalidateResolveCache() {
      entryResolver.invalidate()
      scriptlessVueLayoutDecisionCache.clear()
      resolveCacheVersion += 1
      appEntryOutputCache.current = undefined
    },
  })
}
