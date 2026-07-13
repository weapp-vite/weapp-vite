import type { PluginContext, ResolvedId } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { Entry } from '../../../../types'
import type { HmrProfileDurationKey } from '../../../../utils/hmrProfile'
import type { ResolvedPageLayoutPlan } from '../../../vue/transform/pageLayout'
import type { ChunkEmitTask } from '../chunkEmitter'
import type { ExtendedLibManager } from '../extendedLib'
import type { JsonEmitFileEntry } from '../jsonEmit'
import type { ResolvedEntryRecord } from './resolve'
import fs from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { fs as sharedFs } from '@weapp-core/shared/fs'
import MagicString from 'magic-string'
import path from 'pathe'
import logger from '../../../../logger'
import { recordHmrProfileDuration } from '../../../../utils/hmrProfile'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { registerNativePageLayoutOutput } from '../../../outputFinalizer/pageLayout'
import { readFile as readFileCached } from '../../../utils/cache'
import { syncCssImportDependencies } from '../../../utils/invalidateEntry'
import {
  emitNativeLayoutScriptChunkIfNeeded,
  resolveNativeLayoutOutputOptions,
  resolveNativeLayoutStaticAssetEntries,
} from '../../../utils/nativeLayout'
import { expandResolvedPageLayoutFiles } from '../../../utils/pageLayout'
import { addNormalizedWatchFile } from '../../../utils/watchFiles'
import { emitWxmlAssetFile, resolveWxmlEmitContext } from '../../../utils/wxmlEmit'
import { applyPageLayoutPlanToNativePage, collectNativeLayoutAssets, injectNativePageLayoutRuntime, resolvePageLayoutPlan } from '../../../vue/transform/pageLayout'
import { collectStyleImports } from './watch'

const NON_VUE_PAGE_RE = /\.vue$|\.jsx$|\.tsx$/
const nativeLayoutAssetSourceCache = new Map<string, string>()

type PrefetchedResult<T>
  = | { ok: true, value: T }
    | { ok: false, error: unknown }

function prefetch<T>(task: Promise<T>): Promise<PrefetchedResult<T>> {
  return task.then(
    value => ({ ok: true, value }),
    error => ({ ok: false, error }),
  )
}

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
  explicitEntryTypes?: Map<string, Entry['type']>
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
    explicitEntryTypes,
  } = options

  const filteredEntries = skipOwnEntries
    ? []
    : entries.filter(entry => !extendedLibManager.shouldIgnoreEntry(entry))
  const normalizedEntries = skipOwnEntries
    ? []
    : Array.from(new Set(filteredEntries.map(entry => normalizeEntry(entry, jsonPath))))
  if (!skipOwnEntries) {
    for (const normalizedEntry of normalizedEntries) {
      const resolvedEntryType = explicitEntryTypes?.get(normalizedEntry) ?? entryType ?? (json.component ? 'component' : 'page')
      entriesMap.set(normalizedEntry, {
        type: resolvedEntryType,
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
  resolveEntriesWithCache: (pluginCtx: PluginContext, entries: string[], absoluteRoot: string, options?: {
    fallbackRoots?: string[]
    resolveMappedEntry?: (entry: string) => string | undefined
  }) => Promise<ResolvedEntryRecord[]>
  resolveMappedEntry?: (entry: string) => string | undefined
  configService: CompilerContext['configService']
  runtimeState: CompilerContext['runtimeState']
  wxmlService?: CompilerContext['wxmlService']
  resolvedEntryMap: Map<string, ResolvedId>
  loadedEntrySet: Set<string>
  dirtyEntrySet: Set<string>
  forceEmitEntrySet?: Set<string>
  forceReloadEntrySet?: Set<string>
  replaceLayoutDependencies: (entryId: string, dependencies: Iterable<string>) => void
  emitEntriesChunks: (this: PluginContext, resolvedIds: (ResolvedId | null)[]) => ChunkEmitTask[]
  registerJsonAsset: (entry: JsonEmitFileEntry) => void
  existsCache: Map<string, boolean>
  pathExistsTtlMs: number
  debug?: (...args: any[]) => void
  relativeCwdId: string
  getTime: () => string
  skipEntries?: boolean
  entryResolveRoot: string
  emittedWxmlCodeCache?: Map<string, string>
  styleImportsCache?: Map<string, string[]>
  resolvedPageLayoutPlan?: ResolvedPageLayoutPlan | null
  entryCodeSource?: string
}

function isEntryStyleStableHmr(runtimeState: CompilerContext['runtimeState']) {
  const profile = runtimeState?.build?.hmr?.profile
  if (profile?.event === undefined) {
    return false
  }
  const dirtyReasonSummary = profile.dirtyReasonSummary
  if (!dirtyReasonSummary?.length) {
    return false
  }
  return dirtyReasonSummary.every(reason =>
    reason.startsWith('entry-direct:')
    || reason.startsWith('importer-graph:')
    || reason.startsWith('shared-chunk-source:')
    || reason.startsWith('json-sidecar:')
    || reason.startsWith('sidecar-direct:')
    || reason.startsWith('entry-local-asset:')
    || reason.startsWith('tailwind-content:'),
  )
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
    resolveMappedEntry,
    entryResolveRoot,
    configService,
    runtimeState,
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
    emittedWxmlCodeCache,
    styleImportsCache,
    resolvedPageLayoutPlan,
    entryCodeSource,
  } = options
  let json = initialJson
  function recordEntryDuration(key: HmrProfileDurationKey, startedAt: number) {
    recordHmrProfileDuration(runtimeState?.build?.hmr?.profile, key, performance.now() - startedAt)
  }

  const entryCodeTask = entryCodeSource === undefined
    ? prefetch((async () => {
        const startedAt = performance.now()
        try {
          return await readFileCached(id, { checkMtime: configService.isDev })
        }
        finally {
          recordEntryDuration('entryCodeReadMs', startedAt)
        }
      })())
    : prefetch(Promise.resolve(entryCodeSource))
  const cachedStyleImports = configService.isDev && isEntryStyleStableHmr(runtimeState)
    ? styleImportsCache?.get(id)
    : undefined
  const styleImportsTask = prefetch((async () => {
    if (cachedStyleImports) {
      return cachedStyleImports
    }
    const startedAt = performance.now()
    try {
      const styleImports = await collectStyleImports(pluginCtx, id, existsCache, pathExistsTtlMs)
      for (const styleImport of styleImports) {
        runtimeState?.css?.sidecarImports.add(styleImport)
      }
      styleImportsCache?.set(id, styleImports)
      return styleImports
    }
    finally {
      recordEntryDuration('entryStyleScanMs', startedAt)
    }
  })())
  const styleImportSourcesTask = prefetch((async () => {
    const styleImportsResult = await styleImportsTask
    if (!styleImportsResult.ok) {
      throw styleImportsResult.error
    }
    const styleReadStartedAt = performance.now()
    let styleSources: Array<{ styleImport: string, source: string }>
    try {
      styleSources = cachedStyleImports
        ? []
        : await Promise.all(styleImportsResult.value.map(async (styleImport) => {
            return {
              styleImport,
              source: await readFileCached(styleImport, { checkMtime: configService.isDev }),
            }
          }))
    }
    finally {
      recordEntryDuration('entryStyleReadMs', styleReadStartedAt)
    }
    return {
      styleImports: styleImportsResult.value,
      styleSources,
    }
  })())

  async function emitNativeLayoutAssets(layoutBasePath: string) {
    if (typeof pluginCtx.emitFile !== 'function') {
      return
    }

    const resolvedOptions = resolveNativeLayoutOutputOptions({
      configService,
      layoutBasePath,
      outputExtensions: configService.outputExtensions,
    })
    if (!resolvedOptions) {
      return
    }

    const assets = await collectNativeLayoutAssets(layoutBasePath)
    const emittedLayoutAssets: Set<string> = (pluginCtx as any).__weappViteNativeLayoutAssets ?? ((pluginCtx as any).__weappViteNativeLayoutAssets = new Set<string>())

    if (assets.json) {
      registerJsonAsset({
        jsonPath: assets.json,
        json: JSON.parse(await fs.readFile(assets.json, 'utf8')),
        type: 'component',
      })
    }

    const assetEntries = await resolveNativeLayoutStaticAssetEntries({
      assets,
      resolvedOptions,
      readFile: fs.readFile,
    })

    const emittedCodeCache = emittedWxmlCodeCache ?? new Map<string, string>()
    const wxmlEmitContext = wxmlService
      ? resolveWxmlEmitContext({
          wxmlService,
          configService,
          scanService: {
            isMainPackageFileName: () => true,
          },
        } as any)
      : undefined

    for (const asset of assetEntries) {
      if (emittedLayoutAssets.has(asset.fileName)) {
        continue
      }

      if (asset.kind === 'template' && assets.template && wxmlService && wxmlEmitContext) {
        const token = wxmlService.analyze(asset.source)
        wxmlService.tokenMap.set(assets.template, token)
        await wxmlService.setTokenDeps(assets.template, token.deps)
        wxmlService.setWxmlComponentsMap(assets.template, token.components)
        emitWxmlAssetFile({
          runtime: {
            addWatchFile: pluginCtx.addWatchFile?.bind(pluginCtx),
            emitFile: payload => pluginCtx.emitFile(payload),
          },
          id: assets.template,
          fileName: asset.fileName,
          token,
          deps: wxmlService.depsMap.get(assets.template),
          emittedCodeCache,
          scriptModuleExtension: wxmlEmitContext.scriptModuleExtension,
          scriptModuleTag: wxmlEmitContext.scriptModuleTag,
          templateExtension: wxmlEmitContext.templateExtension,
        })
        emittedLayoutAssets.add(asset.fileName)
        continue
      }

      const cacheKey = `asset:${asset.fileName}`
      if (nativeLayoutAssetSourceCache.get(cacheKey) === asset.source) {
        emittedLayoutAssets.add(asset.fileName)
        continue
      }

      emittedLayoutAssets.add(asset.fileName)
      pluginCtx.emitFile({
        type: 'asset',
        fileName: asset.fileName,
        source: asset.source,
      })
      nativeLayoutAssetSourceCache.set(cacheKey, asset.source)
    }

    emitNativeLayoutScriptChunkIfNeeded({
      pluginCtx,
      scriptId: assets.script,
      fileName: `${resolvedOptions.relativeBase}.${resolvedOptions.scriptExtension}`,
    })
  }

  const shouldSkipEntries = Boolean(options.skipEntries)
  const resolvedIds = shouldSkipEntries
    ? []
    : normalizedEntries.length
      ? await (async () => {
          const startedAt = performance.now()
          try {
            return await resolveEntriesWithCache(
              pluginCtx,
              normalizedEntries,
              entryResolveRoot,
              {
                fallbackRoots: [configService.cwd],
                resolveMappedEntry,
              },
            )
          }
          finally {
            recordEntryDuration('entryResolveMs', startedAt)
          }
        })()
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
      const missingAbsoluteEntryPath = path.resolve(entryResolveRoot, entry)
      const shouldSuppressMissingEntryWarning = configService.isDev
        && path.isAbsolute(missingAbsoluteEntryPath)
        && !await sharedFs.pathExists(missingAbsoluteEntryPath)
      if (shouldSuppressMissingEntryWarning) {
        continue
      }
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
      addNormalizedWatchFile(pluginCtx, normalizedResolvedId)
    }
    if (normalizedResolvedId && !isSkippableResolvedId(normalizedResolvedId)) {
      resolvedEntryMap.set(normalizedResolvedId, resolvedId)
    }

    const isForcedEntry = forceEmitEntrySet?.has(entry) === true
      || forceEmitEntrySet?.has(normalizedResolvedId) === true
    const isForcedReloadEntry = forceReloadEntrySet?.has(entry) === true
      || forceReloadEntrySet?.has(normalizedResolvedId) === true
    const isDirtyEntry = dirtyEntrySet.has(normalizedResolvedId)
    if (!isDirtyEntry && !isForcedEntry && loadedEntrySet.has(normalizedResolvedId)) {
      continue
    }

    if (isForcedReloadEntry) {
      loadedEntrySet.delete(normalizedResolvedId)
    }
    pendingResolvedIds.push(resolvedId)
    if (isDirtyEntry || isForcedEntry) {
      dirtyEntrySet.delete(normalizedResolvedId)
    }
  }

  if (pendingResolvedIds.length) {
    const startedAt = performance.now()
    try {
      await Promise.all(emitEntriesChunks.call(pluginCtx, pendingResolvedIds))
    }
    finally {
      recordEntryDuration('entryChunkEmitMs', startedAt)
    }
  }

  debug?.(`emitEntriesChunks ${relativeCwdId} 耗时 ${getTime()}`)

  let code: string
  const entryCodeResult = await entryCodeTask
  if (entryCodeResult.ok) {
    code = entryCodeResult.value
  }
  else {
    const { error } = entryCodeResult
    const missingEntry = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    if (missingEntry && configService.isDev && !await sharedFs.pathExists(id)) {
      return
    }
    throw error
  }

  if (
    type === 'page'
    && templatePath
    && !NON_VUE_PAGE_RE.test(id)
  ) {
    const layoutStartedAt = performance.now()
    try {
      replaceLayoutDependencies(id, [])
      const layoutPlan = resolvedPageLayoutPlan === undefined
        ? await resolvePageLayoutPlan(code, id, configService as any)
        : resolvedPageLayoutPlan ?? undefined
      registerNativePageLayoutOutput({
        configService,
        runtimeState,
        pageId: id,
        templatePath,
        plan: layoutPlan,
      })
      if (layoutPlan) {
        const layoutDependencies = new Set<string>()
        for (const file of await expandResolvedPageLayoutFiles(layoutPlan.layouts)) {
          addNormalizedWatchFile(pluginCtx, file)
          layoutDependencies.add(normalizeFsResolvedId(file))
        }
        replaceLayoutDependencies(id, layoutDependencies)

        const nativeTemplate = await readFileCached(templatePath, { checkMtime: configService.isDev })
        const transformed = applyPageLayoutPlanToNativePage(
          {
            script: code,
            template: nativeTemplate,
            config: JSON.stringify(json),
          },
          id,
          layoutPlan,
          {
            platform: configService.platform,
          },
        )

        code = transformed.script ?? code

        if (transformed.config) {
          json = JSON.parse(transformed.config)
        }

        if (transformed.template && wxmlService) {
          const token = wxmlService.analyze(transformed.template)
          wxmlService.tokenMap.set(templatePath, token)
          void wxmlService.setTokenDeps(templatePath, token.deps)
          wxmlService.setWxmlComponentsMap(templatePath, token.components)
        }

        for (const layout of layoutPlan.layouts) {
          if (layout.kind === 'native') {
            await emitNativeLayoutAssets(layout.file)
          }
        }
      }

      code = injectNativePageLayoutRuntime(code, id, layoutPlan) ?? code
    }
    finally {
      recordEntryDuration('entryLayoutMs', layoutStartedAt)
    }
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

  const styleImportSourcesResult = await styleImportSourcesTask
  if (!styleImportSourcesResult.ok) {
    throw styleImportSourcesResult.error
  }
  const { styleImports, styleSources } = styleImportSourcesResult.value
  for (const { styleImport, source } of styleSources) {
    syncCssImportDependencies({ configService, runtimeState } as CompilerContext, styleImport, source)
  }

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
