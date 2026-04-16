import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { CompilationCacheEntry, VueBundleCompileOptionsState } from './types'
import { fs } from '@weapp-core/shared/fs'
import { compileJsxFile, compileVueFile } from 'wevu/compiler'
import { addResolvedPageLayoutWatchFiles } from '../../../../utils/pageLayout'
import { createCompileVueFileOptions } from '../../compileOptions'
import { injectWevuPageFeaturesInJsWithViteResolver } from '../../injectPageFeatures'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, isAutoSetDataPickEnabled } from '../../injectSetDataPick'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../../pageLayout'
import { getEntryBaseName, isAppVueLikeFile } from './layout'

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
    })
    if (injected.transformed) {
      result.script = injected.code
    }
  }

  if (
    !isApp
    && result.script
    && result.template
    && isAutoSetDataPickEnabled(configService.weappViteConfig)
  ) {
    const keys = collectSetDataPickKeysFromTemplate(result.template)
    const injectedPick = injectSetDataPickInJs(result.script, keys)
    if (injectedPick.transformed) {
      result.script = injectedPick.code
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
    const source = await fs.readFile(filename, 'utf-8')
    if (source === cached.source) {
      return cached.result
    }

    const compiled = await compileAndFinalizeVueLikeFile({
      source,
      filename,
      ctx,
      pluginCtx,
      isPage: cached.isPage,
      isApp: isAppVueLikeFile(filename),
      configService,
      compileOptionsState,
    })

    cached.source = source
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
