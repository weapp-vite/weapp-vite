import type { CompilationCacheEntry, VueBundleState } from './shared'
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

  return {
    compilationEntries: Array.from(compilationCache.entries()),
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
