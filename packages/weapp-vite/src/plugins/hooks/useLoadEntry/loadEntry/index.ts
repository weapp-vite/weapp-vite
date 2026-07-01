import type { PluginContext, ResolvedId } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../../../context'
import type { Entry } from '../../../../types'
import type { ResolvedPageLayoutPlan } from '../../../vue/transform/pageLayout'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import type { AppEntriesCache } from './app'
import type { ResolvedEntryRecord } from './resolve'
import { performance } from 'node:perf_hooks'
import { get, isObject, removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { changeFileExtension, extractConfigFromVue, findCssEntry, findJsonEntry, findVueEntry } from '../../../../utils'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { resolveVueSfcHasTemplate, resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } from '../../../../utils/file/vueSfcSignature'
import { resolveCompilerOutputExtensions } from '../../../../utils/outputExtensions'
import { isPathInside } from '../../../../utils/path'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { analyzeCommonJson } from '../../../utils/analyze'
import { markComponentEntries, registerResolvedPageLayoutEntries } from '../../../utils/layoutEntries'
import { addResolvedPageLayoutWatchFiles, expandResolvedPageLayoutFiles } from '../../../utils/pageLayout'
import { emitScriptlessComponentAsset, resolveScriptlessComponentFileName, SLOT_HOST_SCRIPTLESS_COMPONENT_STUB } from '../../../utils/scriptlessComponent'
import { shouldEmitScriptlessVueLayoutJs as shouldEmitScriptlessVueLayoutJsFromSource } from '../../../utils/scriptlessVueLayout'
import { addNormalizedWatchFile } from '../../../utils/watchFiles'
import { resolvePageLayoutPlan } from '../../../vue/transform/pageLayout'
import { collectAppEntries } from './app'
import { emitEntryOutput, prepareNormalizedEntries } from './emit'
import { createEntryResolver } from './resolve'
import { applyScriptSetupUsingComponents, scanTemplateEntry } from './template'
import { addWatchTarget } from './watch'

const VUE_LIKE_PAGE_ENTRY_RE = /\.(?:vue|jsx|tsx)$/

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
  applyAutoImports: (baseName: string, json: any) => string[]
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
      appVueNonJsonSignature?: string
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
      return shouldEmitScriptlessVueLayoutJsFromSource(layoutSource, layoutFile)
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
    if (configService.isDev) {
      existsCache.clear()
    }
    const stopwatch = debug ? createStopwatch() : undefined
    const getTime = () => (stopwatch ? stopwatch() : '0.00ms')
    const relativeCwdId = configService.relativeCwd(id)
    const normalizedId = normalizeFsResolvedId(id)
    const libConfig = configService.weappLibConfig
    let appVueNonJsonSignature: string | undefined
    const libEntry = libConfig?.enabled && normalizedId
      ? ctx.runtimeState.lib.entries.get(normalizedId)
      : undefined

    addNormalizedWatchFile(this, id)
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
      addNormalizedWatchFile(this, vueEntryPath)
    }

    let vueSource: string | undefined
    const readVueSource = async () => {
      if (!vueEntryPath) {
        return undefined
      }
      if (vueSource !== undefined) {
        return vueSource
      }
      try {
        vueSource = await fs.readFile(vueEntryPath, 'utf-8')
      }
      catch (error) {
        const missingEntry = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
        if (!(missingEntry && configService.isDev && !await fs.pathExists(vueEntryPath))) {
          throw error
        }
      }
      return vueSource
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
    const forceEmitEntrySet = new Set<string>()
    const forceReloadEntrySet = new Set<string>()
    const nativeLayoutScriptEntries = new Set<string>()
    let autoRoutesSignature = configService.isDev
      ? ctx.autoRoutesService?.getSignature?.()
      : undefined
    const registerPageLayoutComponentEntries = async (
      layoutPlan: ResolvedPageLayoutPlan,
      options?: {
        trackLayoutDependencies?: boolean
      },
    ) => {
      if (options?.trackLayoutDependencies) {
        const layoutDependencies = new Set<string>()
        for (const file of await expandResolvedPageLayoutFiles(layoutPlan.layouts)) {
          layoutDependencies.add(normalizeFsResolvedId(file))
        }
        replaceLayoutDependencies(normalizedId, layoutDependencies)
      }

      await addResolvedPageLayoutWatchFiles(this, layoutPlan.layouts)
      await registerResolvedPageLayoutEntries({
        layouts: layoutPlan.layouts,
        entries,
        explicitEntryTypes,
        nativeScriptEntries: nativeLayoutScriptEntries,
        normalizeEntry,
        jsonPath,
      })
      for (const layout of layoutPlan.layouts) {
        if (layout.kind === 'native') {
          continue
        }
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
        emitScriptlessComponentAsset(
          this,
          resolveScriptlessComponentFileName(relativeLayoutBase, scriptExtension),
          SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
        )
      }
    }

    if (type === 'app') {
      const vueEntryPath = await findVueEntry(baseName)
      const normalizedVueEntryPath = vueEntryPath ? normalizeFsResolvedId(vueEntryPath) : undefined
      if (configService.isDev && vueEntryPath) {
        const vueSource = await fs.readFile(vueEntryPath, 'utf-8').catch(() => undefined)
        if (vueSource) {
          appVueNonJsonSignature = resolveVueSfcNonJsonSignature(vueSource, vueEntryPath)
          if (appVueNonJsonSignature) {
            ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(normalizeFsResolvedId(vueEntryPath), appVueNonJsonSignature)
          }
          const scriptSignature = resolveVueSfcScriptSignature(vueSource, vueEntryPath)
          if (scriptSignature) {
            ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(normalizeFsResolvedId(vueEntryPath), scriptSignature)
          }
          const hasTemplate = resolveVueSfcHasTemplate(vueSource, vueEntryPath)
          if (hasTemplate !== undefined) {
            ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(normalizeFsResolvedId(vueEntryPath), hasTemplate)
          }
        }
      }
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
      autoRoutesSignature = configService.isDev
        ? ctx.autoRoutesService?.getSignature?.()
        : undefined
      entries.push(...appResult.entries)
      if (get(json, 'tabBar.custom')) {
        explicitEntryTypes.set(normalizeEntry('custom-tab-bar/index', jsonPath), 'component')
      }
      if (get(json, 'appBar')) {
        explicitEntryTypes.set(normalizeEntry('app-bar/index', jsonPath), 'component')
      }
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
        && !dirtyEntrySet.has(normalizedId)
        && !dirtyEntrySet.has(normalizedVueEntryPath ?? '')
        && appResult.cacheHit
        && appEntryOutputCache.current
        && appEntryOutputCache.current.appSignature === appResult.appSignature
        && appEntryOutputCache.current.appVueNonJsonSignature === appVueNonJsonSignature
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
          externalComponentEntryMap: ctx.runtimeState.build.hmr.externalComponentEntryMap,
        })

        if (type === 'page') {
          const vueSource = await readVueSource()
          if (vueSource) {
            const layoutPlan = await resolvePageLayoutPlan(vueSource, vueEntryPath, configService as any)
            replaceLayoutDependencies(normalizedId, [])
            if (layoutPlan) {
              await registerPageLayoutComponentEntries(layoutPlan, {
                trackLayoutDependencies: vueSource.includes('definePageMeta') || vueSource.includes('setPageLayout'),
              })
            }
          }
        }
      }
      else if (type === 'page' && templatePath && !VUE_LIKE_PAGE_ENTRY_RE.test(id)) {
        replaceLayoutDependencies(normalizedId, [])
        const source = await fs.readFile(id, 'utf-8')
        const layoutPlan = await resolvePageLayoutPlan(source, id, configService as any)
        if (layoutPlan) {
          await registerPageLayoutComponentEntries(layoutPlan, {
            trackLayoutDependencies: true,
          })
        }
      }

      if (configService.isDev && hasJsonEntry && vueEntryPath) {
        const vueSource = await readVueSource()
        if (vueSource) {
          const nonJsonSignature = resolveVueSfcNonJsonSignature(vueSource, vueEntryPath)
          if (nonJsonSignature) {
            ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(normalizedId, nonJsonSignature)
          }
          const scriptSignature = resolveVueSfcScriptSignature(vueSource, vueEntryPath)
          if (scriptSignature) {
            ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(normalizedId, scriptSignature)
          }
          const hasTemplate = resolveVueSfcHasTemplate(vueSource, vueEntryPath)
          if (hasTemplate !== undefined) {
            ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(normalizedId, hasTemplate)
          }
        }
      }

      await ctx.autoImportService?.awaitPendingRegistrations?.()
      const injectedAutoImportEntries = applyAutoImports(baseName, json) ?? []
      const componentEntries = analyzeCommonJson(json)
      const pendingAutoImportMap = ctx.runtimeState?.autoImport?.pendingEntriesByImporter
      const vueBaseName = vueEntryPath ? removeExtensionDeep(vueEntryPath) : undefined
      const pendingAutoImportEntries = Array.from(new Set([
        ...Array.from(pendingAutoImportMap?.get(baseName) ?? []),
        ...Array.from(vueBaseName ? pendingAutoImportMap?.get(vueBaseName) ?? [] : []),
      ]))
      if (pendingAutoImportEntries.length) {
        pendingAutoImportMap?.delete(baseName)
        if (vueBaseName) {
          pendingAutoImportMap?.delete(vueBaseName)
        }
      }
      const mergedComponentEntries = Array.from(new Set([
        ...componentEntries,
        ...pendingAutoImportEntries,
      ]))
      entries.push(...mergedComponentEntries)
      for (const componentEntry of mergedComponentEntries) {
        const normalizedComponentEntry = normalizeEntry(componentEntry, jsonPath)
        explicitEntryTypes.set(normalizedComponentEntry, 'component')
        const isPendingAutoImportEntry = pendingAutoImportEntries.includes(componentEntry)
        if (isPendingAutoImportEntry || injectedAutoImportEntries.includes(componentEntry)) {
          forceEmitEntrySet.add(normalizedComponentEntry)
        }
        if (isPendingAutoImportEntry) {
          forceReloadEntrySet.add(normalizedComponentEntry)
        }
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

    markComponentEntries(entriesMap, nativeLayoutScriptEntries)

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
      resolveMappedEntry: entry => ctx.runtimeState.build.hmr.externalComponentEntryMap.get(entry),
      entryResolveRoot,
      configService,
      runtimeState: ctx.runtimeState,
      wxmlService,
      resolvedEntryMap,
      loadedEntrySet,
      dirtyEntrySet,
      forceEmitEntrySet,
      forceReloadEntrySet,
      replaceLayoutDependencies,
      emitEntriesChunks,
      registerJsonAsset,
      existsCache,
      pathExistsTtlMs,
      debug,
      relativeCwdId,
      getTime,
      emittedWxmlCodeCache: ctx.runtimeState?.wxml?.emittedCode,
      skipEntries: shouldSkipAppEntries,
    })

    if (type === 'app' && !shouldSkipAppEntries && appResult) {
      ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = autoRoutesSignature
      appEntryOutputCache.current = {
        appSignature: appResult.appSignature,
        appVueNonJsonSignature,
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
