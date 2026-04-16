import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import { addResolvedPageLayoutWatchFiles } from '../../../../utils/pageLayout'
import { emitNativeLayoutScriptChunkIfNeeded } from '../../bundle'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../../pageLayout'
import { ensureSfcStyleBlocks, isAppEntry, loadTransformPageEntries } from './state'

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
    applyPageLayoutPlan(options.result, options.filename, resolvedLayoutPlan, {
      platform: configService.platform,
    })
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
    warn: () => {},
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
