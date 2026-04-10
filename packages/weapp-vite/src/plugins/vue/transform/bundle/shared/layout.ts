import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../../context'
import type { ResolvedPageLayout } from '../../pageLayout'
import type { CompilationCacheEntry } from './types'
import { normalizeWatchPath } from '../../../../../utils/path'
import { applyPageLayoutPlan, resolvePageLayoutPlan } from '../../pageLayout'
import { findFirstResolvedVueLikeEntry } from '../../shared'

const APP_VUE_LIKE_FILE_RE = /[\\/]app\.(?:vue|jsx|tsx)$/

export function addBundleWatchFile(pluginCtx: any, filePath: string) {
  if (typeof pluginCtx.addWatchFile !== 'function') {
    return
  }

  pluginCtx.addWatchFile(normalizeWatchPath(filePath))
}

export function getEntryBaseName(filename: string) {
  const extIndex = filename.lastIndexOf('.')
  if (extIndex < 0) {
    return filename
  }
  return filename.slice(0, extIndex)
}

export function isAppVueLikeFile(filename: string) {
  return APP_VUE_LIKE_FILE_RE.test(filename)
}

export async function resolveFallbackPageEntryFile(options: {
  entryId: string
  compilationCache: Map<string, CompilationCacheEntry>
  pathExists: (candidate: string) => Promise<string | undefined | null>
}) {
  return await findFirstResolvedVueLikeEntry(options.entryId, {
    resolve: async (candidate) => {
      if (options.compilationCache.has(candidate)) {
        return null
      }
      return await options.pathExists(candidate)
    },
  })
}

export async function resolveFallbackPageEmitState(options: {
  entryId: string
  configService: NonNullable<CompilerContext['configService']>
  compilationCache: Map<string, CompilationCacheEntry>
  pathExists: (candidate: string) => Promise<string | undefined | null>
}) {
  const relativeBase = options.configService.relativeOutputPath(options.entryId)
  if (!relativeBase) {
    return undefined
  }

  const entryFilePath = await resolveFallbackPageEntryFile({
    entryId: options.entryId,
    compilationCache: options.compilationCache,
    pathExists: options.pathExists,
  })
  if (!entryFilePath) {
    return undefined
  }

  return {
    relativeBase,
    entryFilePath,
  }
}

export async function handleFallbackPageLayouts(options: {
  source: string
  entryFilePath: string
  configService: NonNullable<CompilerContext['configService']>
  emitLayouts: (layouts: ResolvedPageLayout[] | undefined) => Promise<void>
}) {
  const resolvedLayoutPlan = await resolvePageLayoutPlan(
    options.source,
    options.entryFilePath,
    options.configService,
  )
  await options.emitLayouts(resolvedLayoutPlan?.layouts)
}

export async function handleCompiledEntryPageLayouts(options: {
  source: string
  filename: string
  result: VueTransformResult
  configService: NonNullable<CompilerContext['configService']>
  emitLayouts: (layouts: ResolvedPageLayout[] | undefined) => Promise<void>
}) {
  const resolvedLayoutPlan = await resolvePageLayoutPlan(
    options.source,
    options.filename,
    options.configService,
  )

  if (resolvedLayoutPlan) {
    applyPageLayoutPlan(options.result, options.filename, resolvedLayoutPlan)
  }

  await options.emitLayouts(resolvedLayoutPlan?.layouts)
}
