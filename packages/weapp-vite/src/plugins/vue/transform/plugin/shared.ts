import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import { performance } from 'node:perf_hooks'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 transform 阶段仍统一复用 fs-extra 读取源码
import fs from 'fs-extra'
import path from 'pathe'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { toAbsoluteId } from '../../../../utils/toAbsoluteId'
import { collectOnPageScrollPerformanceWarnings } from '../../../performance/onPageScrollDiagnostics'
import { addResolvedPageLayoutWatchFiles } from '../../../utils/pageLayout'
import { emitNativeLayoutScriptChunkIfNeeded } from '../bundle'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../pageLayout'
import { isVueLikeFile, registerVueTemplateToken, resolveVueOutputBase } from '../shared'
import { buildWeappVueStyleRequest } from '../styleRequest'

const APP_ENTRY_RE = /[\\/]app\.(?:vue|jsx|tsx)$/
const AUTO_ROUTES_DYNAMIC_IMPORT_RE = /import\(\s*['"](?:weapp-vite\/auto-routes|virtual:weapp-vite-auto-routes)['"]\s*\)/g
const AUTO_ROUTES_ID = 'weapp-vite/auto-routes'
const AUTO_ROUTES_VIRTUAL_ID = 'virtual:weapp-vite-auto-routes'
const AUTO_ROUTES_NAMED_IMPORT_ALIAS_RE = /\s+as\s+/g
const AUTO_ROUTES_DEFAULT_AND_NAMED_IMPORT_RE = /^([A-Z_$][\w$]*)\s*,\s*(\{[^}]+\})$/i
const TEMPLATE_DYNAMIC_HINT_RE = /\{\{|wx:|bind[A-Za-z:_-]+=|catch[A-Za-z:_-]+=/
const PAGE_FEATURE_HOOK_HINTS = [
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onRouteDone',
  'onTabItemTap',
  'onResize',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onSaveExitState',
]
const PAGE_SCROLL_HOOK_HINT = 'onPageScroll'

export function resolveScriptlessVueEntryStub(isPage: boolean) {
  return isPage ? 'Page({})' : 'Component({})'
}

export function isAppEntry(filename: string) {
  return APP_ENTRY_RE.test(filename)
}

export function isVueLikeId(id: string) {
  return isVueLikeFile(id)
}

export function mayNeedTransformSetDataPick(template: string) {
  return TEMPLATE_DYNAMIC_HINT_RE.test(template)
}

export function mayNeedTransformPageFeatureInjection(script: string) {
  return PAGE_FEATURE_HOOK_HINTS.some(hint => script.includes(hint))
}

export function mayNeedTransformPageScrollDiagnostics(script: string) {
  return script.includes(PAGE_SCROLL_HOOK_HINT)
}

export function mayNeedInlineAutoRoutes(source: string) {
  return source.includes(AUTO_ROUTES_ID) || source.includes(AUTO_ROUTES_VIRTUAL_ID)
}

function toObjectDestructureClause(namedImportClause: string) {
  return namedImportClause.replace(AUTO_ROUTES_NAMED_IMPORT_ALIAS_RE, ': ')
}

function resolveInlineAutoRoutesImport(line: string, inlineRoutes: Record<string, unknown>, replacementIndex: number) {
  const trimmedLine = line.trim()
  if (
    !trimmedLine.startsWith('import ')
    || !trimmedLine.includes(' from ')
    || (!trimmedLine.includes(`'${AUTO_ROUTES_ID}'`) && !trimmedLine.includes(`"${AUTO_ROUTES_ID}"`) && !trimmedLine.includes(`'${AUTO_ROUTES_VIRTUAL_ID}'`) && !trimmedLine.includes(`"${AUTO_ROUTES_VIRTUAL_ID}"`))
  ) {
    return undefined
  }

  const clause = trimmedLine.slice('import '.length, trimmedLine.lastIndexOf(' from ')).trim()
  const inlineLiteral = JSON.stringify(inlineRoutes)

  if (clause.startsWith('{')) {
    return `const ${toObjectDestructureClause(clause)} = ${inlineLiteral};`
  }

  if (clause.startsWith('* as ')) {
    return `const ${clause.slice(5).trim()} = ${inlineLiteral};`
  }

  const defaultAndNamedMatch = clause.match(AUTO_ROUTES_DEFAULT_AND_NAMED_IMPORT_RE)
  if (defaultAndNamedMatch) {
    const [, defaultName, namedClause] = defaultAndNamedMatch
    const localRef = `__weappViteAutoRoutesInline${replacementIndex}`
    return `const ${localRef} = ${inlineLiteral};\nconst ${defaultName} = ${localRef};\nconst ${toObjectDestructureClause(namedClause)} = ${localRef};`
  }

  return `const ${clause} = ${inlineLiteral};`
}

export function createTransformStageMeasurer(vueTransformTiming: ((payload: {
  id: string
  isPage: boolean
  totalMs: number
  stages: Record<string, number>
}) => void) | undefined) {
  const stageTimings: Record<string, number> = {}
  const totalStart = vueTransformTiming ? performance.now() : 0

  const measureStage = async <T>(label: string, task: () => Promise<T>) => {
    if (!vueTransformTiming) {
      return await task()
    }
    const start = performance.now()
    const result = await task()
    stageTimings[label] = Number((performance.now() - start).toFixed(2))
    return result
  }

  const reportTiming = (id: string, isPage: boolean) => {
    if (!vueTransformTiming) {
      return
    }
    vueTransformTiming({
      id,
      isPage,
      totalMs: Number((performance.now() - totalStart).toFixed(2)),
      stages: stageTimings,
    })
  }

  return {
    measureStage,
    reportTiming,
  }
}

export function resolveTransformFilename(options: {
  id: string
  configService: NonNullable<CompilerContext['configService']>
  pluginCtx: any
  getSourceFromVirtualId: (id: string) => string
  addWatchFile: (pluginCtx: any, file: string) => void
}) {
  const { id, configService, pluginCtx, getSourceFromVirtualId, addWatchFile } = options
  const sourceId = getSourceFromVirtualId(id)
  const filename = toAbsoluteId(sourceId, configService, undefined, { base: 'cwd' })
  if (!filename || !path.isAbsolute(filename)) {
    return null
  }

  if (typeof pluginCtx.addWatchFile === 'function') {
    addWatchFile(pluginCtx, filename)
  }

  return filename
}

export async function loadTransformPageEntries(scanService: CompilerContext['scanService']) {
  if (!scanService) {
    return { pages: [], subPackages: [], pluginPages: [] }
  }

  const appEntry = await scanService.loadAppEntry()
  const subPackages = scanService.loadSubPackages().map(meta => ({
    root: meta.subPackage.root,
    pages: meta.subPackage.pages,
  }))
  const pluginPages = scanService.pluginJson
    ? Object.values((scanService.pluginJson as { pages?: Record<string, string> }).pages ?? {}).map(page => String(page))
    : []

  return {
    pages: appEntry.json?.pages ?? [],
    subPackages,
    pluginPages,
  }
}

export function invalidatePageLayoutCaches(
  configService: NonNullable<CompilerContext['configService']> | undefined,
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
) {
  if (!configService) {
    return
  }

  for (const [cachedId, cached] of compilationCache.entries()) {
    if (cached.isPage) {
      cached.source = undefined
    }
    styleBlocksCache.delete(cachedId)
  }
}

export function invalidateVueFileCaches(
  file: string,
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
  options: {
    existsSync: (filePath: string) => boolean
  },
) {
  if (!options.existsSync(file)) {
    compilationCache.delete(file)
  }
  else {
    const cached = compilationCache.get(file)
    if (cached) {
      cached.source = undefined
    }
  }
  styleBlocksCache.delete(file)
}

export function handleTransformLayoutInvalidation(
  file: string,
  options: {
    configService: NonNullable<CompilerContext['configService']> | undefined
    compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>
    styleBlocksCache: Map<string, SFCStyleBlock[]>
    isLayoutFile: (file: string, configService: NonNullable<CompilerContext['configService']>) => boolean
    invalidateResolvedPageLayoutsCache: (srcRoot: string) => void
  },
) {
  const { configService, compilationCache, styleBlocksCache, isLayoutFile, invalidateResolvedPageLayoutsCache } = options
  if (!configService || !isLayoutFile(file, configService)) {
    return false
  }

  invalidateResolvedPageLayoutsCache(configService.absoluteSrcRoot)
  invalidatePageLayoutCaches(configService, compilationCache, styleBlocksCache)
  return true
}

export function handleTransformVueFileInvalidation(
  file: string,
  options: {
    compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>
    styleBlocksCache: Map<string, SFCStyleBlock[]>
    existsSync: (filePath: string) => boolean
  },
) {
  if (!isVueLikeId(file)) {
    return false
  }

  invalidateVueFileCaches(file, options.compilationCache, options.styleBlocksCache, {
    existsSync: options.existsSync,
  })
  return true
}

export async function ensureSfcStyleBlocks(
  filename: string,
  styleBlocksCache: Map<string, SFCStyleBlock[]>,
  options: {
    load: (filename: string) => Promise<SFCStyleBlock[]>
  },
) {
  const cached = styleBlocksCache.get(filename)
  if (cached) {
    return cached
  }

  const styles = await options.load(filename)
  styleBlocksCache.set(filename, styles)
  return styles
}

export async function loadTransformSource(options: {
  code: string
  filename: string
  isDev: boolean
  readFileCached: (filename: string, options: { checkMtime: boolean, encoding: 'utf8' }) => Promise<string>
}) {
  const { code, filename, isDev, readFileCached } = options
  if (typeof code === 'string') {
    return code
  }

  return isDev
    ? await readFileCached(filename, { checkMtime: true, encoding: 'utf8' })
    : await fs.readFile(filename, 'utf-8')
}

export async function preloadTransformSfcStyleBlocks(options: {
  filename: string
  source: string
  styleBlocksCache: Map<string, SFCStyleBlock[]>
  load: (filename: string, source: string) => Promise<SFCStyleBlock[]>
}) {
  const { filename, source, styleBlocksCache, load } = options
  if (!filename.endsWith('.vue') || !source.includes('<style')) {
    return undefined
  }

  try {
    return await ensureSfcStyleBlocks(filename, styleBlocksCache, {
      load: async target => await load(target, source),
    })
  }
  catch {
    // 忽略解析失败，后续由 compileVueFile 抛出错误
    return undefined
  }
}

export async function handleTransformEntryPageLayoutFlow(options: {
  pluginCtx: any
  ctx: CompilerContext
  filename: string
  source: string
  result?: VueTransformResult
}) {
  const configService = options.ctx.configService
  if (!configService) {
    return undefined
  }

  const resolvedLayoutPlan = await resolvePageLayoutPlan(options.source, options.filename, configService)
  if (!resolvedLayoutPlan) {
    return undefined
  }

  if (options.result) {
    applyPageLayoutPlan(options.result, options.filename, resolvedLayoutPlan)
  }

  await addResolvedPageLayoutWatchFiles(options.pluginCtx, resolvedLayoutPlan.layouts)

  for (const layout of resolvedLayoutPlan.layouts) {
    if (layout.kind !== 'native') {
      continue
    }
    await emitNativeLayoutScriptChunkIfNeeded({
      pluginCtx: options.pluginCtx,
      layoutBasePath: layout.file,
      configService,
      outputExtensions: configService.outputExtensions,
    })
  }

  return resolvedLayoutPlan
}

export async function finalizeTransformEntryScript(options: {
  result: VueTransformResult
  filename: string
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
}) {
  const { result, filename, pluginCtx, configService, isPage, isApp } = options

  if (isPage && result.script) {
    if (mayNeedTransformPageScrollDiagnostics(result.script)) {
      for (const warning of collectOnPageScrollPerformanceWarnings(result.script, filename, {
        engine: resolveAstEngine(configService.weappViteConfig),
      })) {
        logger.warn(warning)
      }
    }

    if (mayNeedTransformPageFeatureInjection(result.script)) {
      const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
        checkMtime: configService.isDev,
      })
      if (injected.transformed) {
        result.script = injected.code
      }
    }
  }

  if (
    !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
    && mayNeedTransformSetDataPick(result.template)
  ) {
    const keys = collectSetDataPickKeysFromTemplate(result.template, {
      astEngine: resolveAstEngine(configService.weappViteConfig),
    })
    const injectedPick = injectSetDataPickInJs(result.script, keys)
    if (injectedPick.transformed) {
      result.script = injectedPick.code
    }
  }

  return result
}

export function finalizeTransformEntryCode(options: {
  result: VueTransformResult
  filename: string
  styleBlocks?: SFCStyleBlock[]
  isPage: boolean
  isApp: boolean
  isDev: boolean
}) {
  const { result, filename, styleBlocks, isPage, isApp, isDev } = options
  let returnedCode = result.script ?? ''

  if (styleBlocks?.length) {
    const styleImports = styleBlocks
      .map((styleBlock, index) => {
        const request = buildWeappVueStyleRequest(filename, styleBlock, index)
        return `import ${JSON.stringify(request)};\n`
      })
      .join('')
    returnedCode = styleImports + returnedCode
  }

  if (!isApp && !result.script?.trim()) {
    returnedCode += resolveScriptlessVueEntryStub(isPage)
  }

  const macroHash = result.meta?.jsonMacroHash
  if (macroHash && isDev) {
    returnedCode += `\n;Object.defineProperty({}, '__weappViteJsonMacroHash', { value: ${JSON.stringify(macroHash)} })\n`
  }

  const defineOptionsHash = result.meta?.defineOptionsHash
  if (defineOptionsHash && isDev) {
    returnedCode += `\n;Object.defineProperty({}, '__weappViteDefineOptionsHash', { value: ${JSON.stringify(defineOptionsHash)} })\n`
  }

  return returnedCode
}

export async function inlineTransformAutoRoutes(options: {
  source: string
  autoRoutesService?: {
    ensureFresh?: () => Promise<void>
    getReference?: () => {
      pages?: unknown[]
      entries?: unknown[]
      subPackages?: unknown[]
    } | undefined
  }
}) {
  const { source, autoRoutesService } = options
  if (!mayNeedInlineAutoRoutes(source)) {
    return source
  }

  AUTO_ROUTES_DYNAMIC_IMPORT_RE.lastIndex = 0

  await autoRoutesService?.ensureFresh?.()

  const routesRef = autoRoutesService?.getReference?.()
  const inlineRoutes = {
    pages: routesRef?.pages ?? [],
    entries: routesRef?.entries ?? [],
    subPackages: routesRef?.subPackages ?? [],
  }

  let importReplacementIndex = 0
  return source
    .split('\n')
    .map((line) => {
      const replaced = resolveInlineAutoRoutesImport(line, inlineRoutes, importReplacementIndex)
      if (replaced) {
        importReplacementIndex += 1
        return replaced
      }
      return line
    })
    .join('\n')
    .replace(AUTO_ROUTES_DYNAMIC_IMPORT_RE, `Promise.resolve(${JSON.stringify(inlineRoutes)})`)
}

export async function resolveTransformEntryFlags(options: {
  pageMatcher: {
    isPageFile: (filename: string) => Promise<boolean>
    markDirty: () => void
  } | null
  setPageMatcher: (matcher: {
    isPageFile: (filename: string) => Promise<boolean>
    markDirty: () => void
  }) => void
  createPageMatcher: (options: {
    srcRoot: string
    loadEntries: () => Promise<{
      pages: string[]
      subPackages: { root: string, pages: string[] }[]
      pluginPages: string[]
    }>
    warn: (message: string) => void
  }) => {
    isPageFile: (filename: string) => Promise<boolean>
    markDirty: () => void
  }
  configService: NonNullable<CompilerContext['configService']>
  scanService: CompilerContext['scanService']
  scanDirty: boolean
  filename: string
}) {
  const {
    pageMatcher,
    setPageMatcher,
    createPageMatcher,
    configService,
    scanService,
    scanDirty,
    filename,
  } = options

  if (configService.weappLibConfig?.enabled) {
    return {
      isPage: false,
      isApp: false,
      pageMatcher: pageMatcher ?? null,
    }
  }

  const currentPageMatcher = pageMatcher ?? createPageMatcher({
    srcRoot: configService.absoluteSrcRoot,
    loadEntries: async () => await loadTransformPageEntries(scanService),
    warn: (message: string) => logger.warn(message),
  })

  setPageMatcher(currentPageMatcher)
  if (scanDirty) {
    currentPageMatcher.markDirty()
  }

  return {
    isPage: await currentPageMatcher.isPageFile(filename),
    isApp: isAppEntry(filename),
    pageMatcher: currentPageMatcher,
  }
}

export async function compileTransformEntryResult(options: {
  transformedSource: string
  filename: string
  compileOptions: Record<string, unknown>
  compileVueFile: (source: string, filename: string, options: Record<string, unknown>) => Promise<VueTransformResult>
  compileJsxFile: (source: string, filename: string, options: Record<string, unknown>) => Promise<VueTransformResult>
}) {
  const { transformedSource, filename, compileOptions, compileVueFile, compileJsxFile } = options
  return filename.endsWith('.vue')
    ? await compileVueFile(transformedSource, filename, compileOptions)
    : await compileJsxFile(transformedSource, filename, compileOptions)
}

export async function finalizeTransformCompiledResult(options: {
  ctx: CompilerContext
  pluginCtx: any
  filename: string
  source: string
  result: VueTransformResult
  compilationCache: Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
  scopedSlotModules: Map<string, string>
  emittedScopedSlotChunks: Set<string>
  addWatchFile: (pluginCtx: any, file: string) => void
  emitScopedSlotChunks: (
    pluginCtx: any,
    relativeBase: string,
    result: VueTransformResult,
    scopedSlotModules: Map<string, string>,
    emittedScopedSlotChunks: Set<string>,
    outputExtensions: NonNullable<CompilerContext['configService']>['outputExtensions'],
  ) => void
}) {
  const {
    ctx,
    pluginCtx,
    filename,
    source,
    result,
    compilationCache,
    configService,
    isPage,
    isApp,
    scopedSlotModules,
    emittedScopedSlotChunks,
    addWatchFile,
    emitScopedSlotChunks,
  } = options

  if (isPage && result.template) {
    await handleTransformEntryPageLayoutFlow({
      pluginCtx,
      ctx,
      filename,
      source,
      result,
    })
  }

  registerVueTemplateToken(ctx, filename, result.template)

  if (Array.isArray(result.meta?.sfcSrcDeps) && typeof pluginCtx.addWatchFile === 'function') {
    for (const dep of result.meta.sfcSrcDeps) {
      addWatchFile(pluginCtx, dep)
    }
  }

  await finalizeTransformEntryScript({
    result,
    filename,
    pluginCtx,
    configService,
    isPage,
    isApp,
  })

  compilationCache.set(filename, { result, source, isPage })

  const relativeBase = resolveVueOutputBase(configService, filename)
  if (relativeBase) {
    emitScopedSlotChunks(pluginCtx, relativeBase, result, scopedSlotModules, emittedScopedSlotChunks, configService.outputExtensions)
  }

  return result
}

export function logTransformFileError(filename: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`[Vue 编译] 编译 ${filename} 失败：${message}`)
}

export async function registerNativeLayoutChunksForEntry(
  pluginCtx: any,
  ctx: CompilerContext,
  filename: string,
  source: string,
) {
  await handleTransformEntryPageLayoutFlow({
    pluginCtx,
    ctx,
    filename,
    source,
  })
}

export async function preloadNativeLayoutEntries(options: {
  pluginCtx: any
  ctx: CompilerContext
  configService: NonNullable<CompilerContext['configService']> | undefined
  scanService: CompilerContext['scanService']
  collectFallbackPageEntryIds: (
    configService: NonNullable<CompilerContext['configService']>,
    scanService: NonNullable<CompilerContext['scanService']>,
  ) => Promise<string[]>
  findFirstResolvedVueLikeEntry: (
    entryId: string,
    options: { resolve: (candidate: string) => Promise<string | undefined> },
  ) => Promise<string | undefined>
  pathExists: (candidate: string) => Promise<boolean>
  readFile: (file: string, encoding: 'utf8') => Promise<string>
}) {
  const {
    pluginCtx,
    ctx,
    configService,
    scanService,
    collectFallbackPageEntryIds,
    findFirstResolvedVueLikeEntry,
    pathExists,
    readFile,
  } = options

  if (!configService || !scanService) {
    return
  }

  const entryIds = await collectFallbackPageEntryIds(configService, scanService)
  for (const entryId of entryIds) {
    const entryFilePath = await findFirstResolvedVueLikeEntry(entryId, {
      resolve: async candidate => await pathExists(candidate) ? candidate : undefined,
    })
    if (!entryFilePath) {
      continue
    }

    try {
      const source = await readFile(entryFilePath, 'utf8')
      await registerNativeLayoutChunksForEntry(pluginCtx, ctx, entryFilePath, source)
    }
    catch {
      // 忽略预扫描失败，交给后续 transform/generateBundle 兜底
    }
  }
}

export async function loadTransformStyleBlock(options: {
  id: string
  pluginCtx: any
  configService: CompilerContext['configService']
  styleBlocksCache: Map<string, SFCStyleBlock[]>
  loadScopedSlotModule: (id: string, scopedSlotModules: Map<string, string>) => string | null
  scopedSlotModules: Map<string, string>
  parseWeappVueStyleRequest: (id: string) => { filename: string, index: number } | null
  readAndParseSfc: (filename: string, options: any) => Promise<{ descriptor: { styles: SFCStyleBlock[] } }>
  createReadAndParseSfcOptions: (pluginCtx: any, configService: CompilerContext['configService']) => any
}) {
  const {
    id,
    pluginCtx,
    configService,
    styleBlocksCache,
    loadScopedSlotModule,
    scopedSlotModules,
    parseWeappVueStyleRequest,
    readAndParseSfc,
    createReadAndParseSfcOptions,
  } = options

  const scopedSlot = loadScopedSlotModule(id, scopedSlotModules)
  if (scopedSlot) {
    return scopedSlot
  }

  const parsed = parseWeappVueStyleRequest(id)
  if (!parsed) {
    return null
  }

  const { filename, index } = parsed
  let styles: SFCStyleBlock[]
  try {
    styles = await ensureSfcStyleBlocks(filename, styleBlocksCache, {
      load: async target => (
        await readAndParseSfc(target, {
          ...createReadAndParseSfcOptions(pluginCtx, configService),
        })
      ).descriptor.styles,
    })
  }
  catch {
    return null
  }

  const block = styles[index]
  if (!block) {
    return null
  }

  return {
    code: block.content,
    map: null,
  }
}
