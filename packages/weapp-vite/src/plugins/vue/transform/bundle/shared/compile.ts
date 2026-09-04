import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { ResolvedAppShell } from '../../appShell'
import type { CompilationCacheEntry, VueBundleCompileOptionsState } from './types'
import { fs } from '@weapp-core/shared/fs'
import { compileJsxFile, compileVueFile, resolveVueSfcHmrSignatures, resolveVueSfcStyleIndependentSignature } from 'wevu/compiler'
import { storeVueSfcHmrSignatures } from '../../../../../runtime/storeVueSfcHmrSignatures'
import { normalizeFsResolvedId } from '../../../../../utils/resolvedId'
import { registerResolvedPageLayoutDependencies } from '../../../../utils/pageLayout'
import { readAndParseSfc } from '../../../../utils/vueSfc'
import { createCompileVueFileOptions, resolveSfcStylePreprocessOptions } from '../../compileOptions'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../../injectPageFeatures'
import { resolvePageLayoutPlan } from '../../pageLayout'
import { isVueStyleOnlyDirtyReasonSummary, resolveDirtyVueEntryId, resolveTransformAutoRoutesSource } from '../../plugin/shared'
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
  appShell?: ResolvedAppShell
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

  const resolvedPageLayoutPlan = isPage
    ? await resolvePageLayoutPlan(source, filename, configService)
    : undefined
  if (resolvedPageLayoutPlan) {
    await registerResolvedPageLayoutDependencies(ctx, filename, resolvedPageLayoutPlan.layouts)
  }
  const compileOptions = createCompileVueFileOptions(
    ctx,
    pluginCtx,
    filename,
    isPage,
    isApp,
    configService,
    compileOptionsState,
    resolvedPageLayoutPlan,
    options.appShell,
  )
  const result = filename.endsWith('.vue')
    ? await compileVueFile(source, filename, compileOptions)
    : await compileJsxFile(source, filename, compileOptions)
  if (resolvedPageLayoutPlan) {
    setVueBundlePageLayoutPlan(result, resolvedPageLayoutPlan)
  }
  if (filename.endsWith('.vue')) {
    const hmr = ctx.runtimeState?.build?.hmr
    if (configService.isDev && hmr) {
      storeVueSfcHmrSignatures(
        hmr,
        normalizeFsResolvedId(filename),
        resolveVueSfcHmrSignatures(source, filename),
      )
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
  const { result, filename, pluginCtx, configService, isPage } = options

  if (isPage && result.script) {
    const injected = await injectWevuPageFeaturesInJsWithViteResolver(pluginCtx, result.script, filename, {
      checkMtime: configService.isDev,
      minify: isWevuMinifyEnabled(configService.weappViteConfig, configService.isDev),
      sourceMap: false,
    })
    if (injected.transformed) {
      result.script = injected.code
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
  appShell?: ResolvedAppShell
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
  appShell?: ResolvedAppShell
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
    if (
      source === cached.source
      && transformed.signature === cached.autoRoutesSignature
    ) {
      cached.refreshToken = 0
      if (dirtyEntryId) {
        dirtyVueEntryIds?.delete(dirtyEntryId)
      }
      return cached.result
    }
    const currentStyleIndependentSignature = (dirtyEntryId && filename.endsWith('.vue'))
      && isVueStyleOnlyDirtyReasonSummary(ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary)
      ? resolveVueSfcStyleIndependentSignature(source, filename)
      : undefined
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
      if (!await refreshStyleOnlyVueTransformResult(cached.result, filename, descriptor.styles, resolveSfcStylePreprocessOptions(configService))) {
        cached.styleIndependentSignature = undefined
      }
      else {
        cached.source = source
        cached.styleIndependentSignature = currentStyleIndependentSignature
        cached.refreshToken = 0
        storeVueSfcHmrSignatures(
          ctx.runtimeState.build.hmr,
          filename,
          resolveVueSfcHmrSignatures(source, filename),
        )
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
      appShell: options.appShell,
    })

    const nextStyleIndependentSignature = filename.endsWith('.vue')
      ? (currentStyleIndependentSignature ?? resolveVueSfcStyleIndependentSignature(source, filename))
      : undefined

    cached.source = source
    cached.autoRoutesSignature = transformed.signature
    cached.styleIndependentSignature = nextStyleIndependentSignature
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
  appShell?: ResolvedAppShell
}) {
  const result = await refreshCompiledVueEntryCacheInDev({
    filename: options.filename,
    cached: options.cached,
    ctx: options.ctx,
    pluginCtx: options.pluginCtx,
    configService: options.configService,
    compileOptionsState: options.compileOptionsState,
    appShell: options.appShell,
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
  appShell?: ResolvedAppShell
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
    appShell: options.appShell,
  })

  return {
    source,
    result,
  }
}
