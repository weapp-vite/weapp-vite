import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { CompilationCacheEntry, VueBundleCompileOptionsState } from './types'
import { WEVU_SLOT_OWNER_ID_ATTR, WEVU_SLOT_OWNER_ID_PROP } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/fs'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import { resolveVueSfcStyleIndependentSignature } from '../../../../../utils/file/vueSfcSignature'
import { addResolvedPageLayoutWatchFiles } from '../../../../utils/pageLayout'
import { readAndParseSfc } from '../../../../utils/vueSfc'
import { createCompileVueFileOptions } from '../../compileOptions'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectScopedSlotHostPropertiesInJs, injectScopedSlotOwnerSetDataPickInJs, injectSetDataPickInJs, isAutoSetDataPickEnabled, mayNeedInjectSetDataPickInJs, mayNeedScopedSlotHostPropertiesForSetupSlotsInJs, pruneScopedSlotOwnerAutoSetDataPickKeys, shouldUseScopedSlotOwnerOnlySetDataPick } from '../../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../../pageLayout'
import { resolveDirtyVueEntryId, resolveTransformAutoRoutesSource } from '../../plugin/shared'
import { refreshStyleOnlyVueTransformResult } from '../../styleOnly'
import { isWevuMinifyEnabled } from '../../wevuPreset'
import { getEntryBaseName, isAppVueLikeFile } from './layout'
import { setVueBundlePageLayoutPlan } from './types'

export async function compileVueLikeFile(options: {
  source: string
  filename: string
  ctx: CompilerContext
  pluginCtx: any
  isPage: boolean
  isApp: boolean
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
}) {
  const {
    source,
    filename,
    ctx,
    pluginCtx,
    isPage,
    isApp,
    configService,
    compileOptionsState,
  } = options

  const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, isPage, isApp, configService, compileOptionsState)
  if (filename.endsWith('.vue')) {
    const result = await compileVueFile(source, filename, compileOptions)
    if (isPage && result.template) {
      const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
      if (resolvedLayoutPlan) {
        setVueBundlePageLayoutPlan(result, resolvedLayoutPlan)
        applyPageLayoutPlan(result, filename, resolvedLayoutPlan, {
          platform: configService.platform,
        })
        await addResolvedPageLayoutWatchFiles(pluginCtx, resolvedLayoutPlan.layouts)
      }
    }
    return result
  }
  const result = await compileJsxFile(source, filename, compileOptions)
  if (isPage && result.template) {
    const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
    if (resolvedLayoutPlan) {
      setVueBundlePageLayoutPlan(result, resolvedLayoutPlan)
      applyPageLayoutPlan(result, filename, resolvedLayoutPlan, {
        platform: configService.platform,
      })
      await addResolvedPageLayoutWatchFiles(pluginCtx, resolvedLayoutPlan.layouts)
    }
  }
  return result
}

export async function finalizeCompiledVueLikeResult(options: {
  result: VueTransformResult
  filename: string
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  isPage: boolean
  isApp: boolean
}) {
  const { result, filename, pluginCtx, configService, isPage, isApp } = options

  if (isPage && result.script) {
    const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
      checkMtime: configService.isDev,
      minify: isWevuMinifyEnabled(configService.weappViteConfig, configService.isDev),
    })
    if (injected.transformed) {
      result.script = injected.code
    }
  }

  const shouldAutoSetDataPick = !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
    && mayNeedInjectSetDataPickInJs(result.script)
  const shouldInjectScopedSlotOwnerPick = !isApp
    && result.script
    && result.template?.includes(WEVU_SLOT_OWNER_ID_ATTR)
    && mayNeedInjectSetDataPickInJs(result.script)

  if (shouldAutoSetDataPick) {
    const keys = collectSetDataPickKeysFromTemplate(result.template!)
    const scopedSlotPickKeys = shouldUseScopedSlotOwnerOnlySetDataPick(keys)
      ? pruneScopedSlotOwnerAutoSetDataPickKeys(keys)
      : keys
    const injectedPick = shouldInjectScopedSlotOwnerPick
      ? injectScopedSlotOwnerSetDataPickInJs(result.script!, scopedSlotPickKeys)
      : injectSetDataPickInJs(result.script!, keys)
    if (injectedPick.transformed) {
      result.script = injectedPick.code
    }
  }
  else if (shouldInjectScopedSlotOwnerPick) {
    const keys = collectSetDataPickKeysFromTemplate(result.template!)
    const injectedPick = injectScopedSlotOwnerSetDataPickInJs(
      result.script!,
      pruneScopedSlotOwnerAutoSetDataPickKeys(keys),
    )
    if (injectedPick.transformed) {
      result.script = injectedPick.code
    }
  }

  const hasScopedSlotHostGenerics = Boolean(result.componentGenerics && Object.keys(result.componentGenerics).length > 0)
  const needsSetupSlotHostProperties = result.script && mayNeedScopedSlotHostPropertiesForSetupSlotsInJs(result.script)
  if (!isPage && !isApp && result.script && (hasScopedSlotHostGenerics || result.template?.includes(WEVU_SLOT_OWNER_ID_PROP) || result.template?.includes('<slot') || result.template?.includes('vueSlots') || needsSetupSlotHostProperties)) {
    const injectedProps = injectScopedSlotHostPropertiesInJs(result.script)
    if (injectedProps.transformed) {
      result.script = injectedProps.code
    }
  }

  return result
}

export async function compileAndFinalizeVueLikeFile(options: {
  source: string
  filename: string
  ctx: CompilerContext
  pluginCtx: any
  isPage: boolean
  isApp: boolean
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
}) {
  const result = await compileVueLikeFile(options)
  return await finalizeCompiledVueLikeResult({
    result,
    filename: options.filename,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    isPage: options.isPage,
    isApp: options.isApp,
  })
}

export async function refreshCompiledVueEntryCacheInDev(options: {
  filename: string
  cached: CompilationCacheEntry
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
}) {
  const { filename, cached, ctx, pluginCtx, configService, compileOptionsState } = options
  if (!configService.isDev) {
    return cached.result
  }

  try {
    const rawSource = await fs.readFile(filename, 'utf-8')
    const isApp = isAppVueLikeFile(filename)
    const transformed = isApp
      ? await resolveTransformAutoRoutesSource({
          source: rawSource,
          autoRoutesService: ctx.autoRoutesService,
        })
      : {
          source: rawSource,
          signature: undefined,
        }
    const source = transformed.source
    const dirtyVueEntryIds = ctx.runtimeState?.build?.hmr?.dirtyVueEntryIds
    const dirtyEntryId = resolveDirtyVueEntryId(dirtyVueEntryIds, filename)
    const currentStyleIndependentSignature = filename.endsWith('.vue')
      ? resolveVueSfcStyleIndependentSignature(source, filename)
      : undefined
    if (
      !dirtyEntryId
      && source === cached.source
      && transformed.signature === cached.autoRoutesSignature
    ) {
      cached.refreshToken = 0
      return cached.result
    }
    if (
      dirtyEntryId
      && filename.endsWith('.vue')
      && cached.styleIndependentSignature
      && currentStyleIndependentSignature
      && cached.styleIndependentSignature === currentStyleIndependentSignature
      && transformed.signature === cached.autoRoutesSignature
      && cached.source !== source
    ) {
      const { descriptor } = await readAndParseSfc(filename, {
        source,
        checkMtime: configService.isDev,
      })
      if (!refreshStyleOnlyVueTransformResult(cached.result, filename, descriptor.styles)) {
        cached.styleIndependentSignature = undefined
      }
      else {
        cached.source = source
        cached.styleIndependentSignature = currentStyleIndependentSignature
        cached.refreshToken = 0
        dirtyVueEntryIds?.delete(dirtyEntryId)
        return cached.result
      }
    }

    const compiled = await compileAndFinalizeVueLikeFile({
      source,
      filename,
      ctx,
      pluginCtx,
      isPage: cached.isPage,
      isApp,
      configService,
      compileOptionsState,
    })

    cached.source = source
    cached.autoRoutesSignature = transformed.signature
    cached.styleIndependentSignature = currentStyleIndependentSignature
    cached.refreshToken = 0
    if (dirtyEntryId) {
      dirtyVueEntryIds?.delete(dirtyEntryId)
    }
    cached.result = compiled
    return compiled
  }
  catch {
    return cached.result
  }
}

export async function resolveCompiledEntryEmitState(options: {
  filename: string
  cached: CompilationCacheEntry
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
}) {
  const result = await refreshCompiledVueEntryCacheInDev({
    filename: options.filename,
    cached: options.cached,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
  })

  const baseName = getEntryBaseName(options.filename)
  const relativeBase = options.configService.relativeOutputPath(baseName)
  if (!relativeBase) {
    return undefined
  }

  return {
    result,
    relativeBase,
  }
}

export async function loadFallbackPageEntryCompilation(options: {
  entryFilePath: string
  ctx: CompilerContext
  pluginCtx: any
  configService: NonNullable<CompilerContext['configService']>
  compileOptionsState: VueBundleCompileOptionsState
}) {
  const source = await fs.readFile(options.entryFilePath, 'utf-8')
  const result = await compileAndFinalizeVueLikeFile({
    source,
    filename: options.entryFilePath,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    isPage: true,
    isApp: false,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
  })

  return {
    source,
    result,
  }
}
