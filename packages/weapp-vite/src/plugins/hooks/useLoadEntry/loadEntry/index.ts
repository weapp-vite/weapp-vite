import type { PluginContext, ResolvedId } from 'rolldown'
import type { BuildTarget, CompilerContext } from '../../../../context'
import type { Entry } from '../../../../types'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import type { AppEntriesCache } from './app'
import type { ResolvedEntryRecord } from './resolve'
import { performance } from 'node:perf_hooks'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import { changeFileExtension, extractConfigFromVue, findCssEntry, findJsonEntry, findVueEntry } from '../../../../utils'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { normalizeWatchPath } from '../../../../utils/path'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { analyzeCommonJson } from '../../../utils/analyze'
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
  const entryResolver = createEntryResolver()
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
  let resolveCacheVersion = 0

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
    let templatePath = ''
    let entryTypeOverride: Entry['type'] | undefined
    let pluginResolvedRecords: ResolvedEntryRecord[] | undefined
    let pluginJsonPathForRegistration: string | undefined
    let pluginJsonForRegistration: any
    let appResult: Awaited<ReturnType<typeof collectAppEntries>> | undefined
    let shouldSkipAppEntries = false
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
        else {
          entryTypeOverride = 'lib'
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
      }

      applyAutoImports(baseName, json)
      entries.push(...analyzeCommonJson(json))
    }

    const normalizedEntries = shouldSkipAppEntries
      ? []
      : prepareNormalizedEntries({
          entries,
          json,
          jsonPath,
          templatePath,
          id,
          isPluginBuild,
          entriesMap,
          normalizeEntry,
          extendedLibManager,
          entryType: entryTypeOverride,
        })

    const result = await emitEntryOutput({
      pluginCtx: this,
      id,
      type,
      json,
      jsonPath,
      isPluginBuild,
      normalizedEntries,
      pluginResolvedRecords,
      pluginJsonPathForRegistration,
      pluginJsonForRegistration,
      resolveEntriesWithCache: entryResolver.resolveEntriesWithCache,
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
      resolveCacheVersion += 1
      appEntryOutputCache.current = undefined
    },
  })
}
