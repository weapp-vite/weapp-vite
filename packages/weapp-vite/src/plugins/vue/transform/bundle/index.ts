import type { CompilationCacheEntry, VueBundleState } from './shared'
import { emitCompiledVueEntryAssets } from './emitCompiledEntry'
import { emitFallbackPageAssets } from './emitFallbackPage'

export { emitNativeLayoutScriptChunkIfNeeded } from './layoutAssets'

export type { CompilationCacheEntry, VueBundleState } from './shared'

export async function emitVueBundleAssets(
  bundle: Record<string, any>,
  state: VueBundleState,
) {
  const { ctx, compilationCache } = state
  const { configService, scanService } = ctx
  if (!configService || !scanService) {
    return
  }

  for (const [filename, cached] of compilationCache.entries()) {
    await emitCompiledVueEntryAssets(bundle, state, filename, cached as CompilationCacheEntry)
  }
  await emitFallbackPageAssets(bundle, state)
}
