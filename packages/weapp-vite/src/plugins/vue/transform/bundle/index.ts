import type { CompilationCacheEntry, VueBundleState } from './shared'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { hasAppShellTemplate, isAppVueFile, resolveAppShellLayout } from '../appShell'
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
  const appShellEntry = Array.from(compilationCache.entries()).find(([filename, cached]) => {
    return isAppVueFile(filename) && hasAppShellTemplate(cached.result)
  })
  state.appShell = appShellEntry
    ? resolveAppShellLayout(configService)
    : undefined
  const hmrState = ctx.runtimeState?.build?.hmr
  const isAppVueHmrUpdate = Boolean(
    configService.isDev
    && hmrState?.profile?.file
    && isAppVueFile(hmrState.profile.file),
  )
  const shouldFilterHmrEntries = Boolean(
    configService.isDev
    && hmrState
    && !isAppVueHmrUpdate
    && !hmrState.didEmitAllEntries
    && (hmrState.lastHmrEntryIds?.size ?? hmrState.lastEmittedEntryIds?.size ?? 0) > 0,
  )
  const emittedEntryIds = shouldFilterHmrEntries && hmrState
    ? (hmrState.lastHmrEntryIds?.size ? hmrState.lastHmrEntryIds : hmrState.lastEmittedEntryIds)
    : undefined

  return {
    compilationEntries: Array.from(compilationCache.entries()).filter(([id]) => {
      return !emittedEntryIds || emittedEntryIds.has(normalizeFsResolvedId(id))
    }),
    emittedEntryIds,
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
  await emitFallbackPageAssets(bundle, state, {
    emittedEntryIds: emitState.emittedEntryIds,
  })
}
