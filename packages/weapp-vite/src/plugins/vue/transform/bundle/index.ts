import type { CompilationCacheEntry, VueBundleState } from './shared'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { emitCompiledVueEntryAssets } from './emitCompiledEntry'
import { emitFallbackPageAssets } from './emitFallbackPage'

export { emitNativeLayoutScriptChunkIfNeeded } from './layoutAssets'

export type { CompilationCacheEntry, VueBundleState } from './shared'

export function resolveVueBundleEmitState(state: VueBundleState) {
  const { ctx, compilationCache } = state
  const { configService, scanService } = ctx
  if (!configService || !scanService) {
    return undefined
  }
  const shouldFilterHmrEntries = Boolean(
    configService.isDev
    && ctx.runtimeState?.build?.hmr?.profile?.event === 'update'
    && !ctx.runtimeState.build.hmr.didEmitAllEntries
    && ctx.runtimeState.build.hmr.lastEmittedEntryIds.size > 0,
  )
  const emittedEntryIds = shouldFilterHmrEntries
    ? ctx.runtimeState.build.hmr.lastEmittedEntryIds
    : undefined

  return {
    compilationEntries: Array.from(compilationCache.entries()).filter(([id]) => {
      return !emittedEntryIds || emittedEntryIds.has(normalizeFsResolvedId(id))
    }),
  }
}

export async function emitCompiledBundleEntries(
  bundle: Record<string, any>,
  state: VueBundleState,
  compilationEntries: Array<[string, CompilationCacheEntry]>,
) {
  for (const [filename, cached] of compilationEntries) {
    await emitCompiledVueEntryAssets(bundle, state, filename, cached)
  }
}

export async function emitVueBundleAssets(
  bundle: Record<string, any>,
  state: VueBundleState,
) {
  const emitState = resolveVueBundleEmitState(state)
  if (!emitState) {
    return
  }

  await emitCompiledBundleEntries(bundle, state, emitState.compilationEntries)
  await emitFallbackPageAssets(bundle, state)
}
