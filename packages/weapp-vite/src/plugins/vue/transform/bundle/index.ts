import type { CompilationCacheEntry, VueBundleState } from './shared'
import { normalizeSourceId } from '../../../../moduleGraph/traversal'
import { recordHmrProfileDuration, recordHmrProfileOperation } from '../../../../utils/hmrProfile'
import { withRealpathScope } from '../../../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { isAppVueFile } from '../appShell'
import { emitCompiledVueEntryAssets } from './emitCompiledEntry'
import { emitFallbackPageAssets } from './emitFallbackPage'
import { resolveVueBundleAssetContext } from './shared/assets'

export type { CompilationCacheEntry, VueBundleState } from './shared'

function isAutoRoutesAppRefreshHmrUpdate(hmrState: NonNullable<VueBundleState['ctx']['runtimeState']>['build']['hmr'] | undefined) {
  return hmrState?.profile?.dirtyReasonSummary?.some(item =>
    item.startsWith('entry-auto-routes:')
    || item.startsWith('auto-routes-topology:'),
  ) === true
}

export function resolveVueBundleEmitState(state: VueBundleState) {
  const { ctx, compilationCache } = state
  const { configService, scanService } = ctx
  if (!configService || !scanService) {
    return undefined
  }
  const hmrState = ctx.runtimeState?.build?.hmr
  const currentHmrFile = hmrState?.profile?.file
  const isAppVueHmrUpdate = Boolean(
    configService.isDev
    && typeof currentHmrFile === 'string'
    && isAppVueFile(normalizeFsResolvedId(currentHmrFile)),
  )
  const isAutoRoutesAppRefreshUpdate = configService.isDev && isAutoRoutesAppRefreshHmrUpdate(hmrState)
  const shouldFilterHmrEntries = Boolean(
    configService.isDev
    && hmrState
    && !isAppVueHmrUpdate
    && !hmrState.didEmitAllEntries
    && ((hmrState.lastHmrEntryIds?.size ?? 0) > 0 || (hmrState.lastEmittedEntryIds?.size ?? 0) > 0),
  )
  const emittedEntryIds = shouldFilterHmrEntries && hmrState
    // 入口闭包可能在 load/transform 期间扩大，新组件已发射 JS 时也必须发布其模板与 JSON。
    ? new Set([...(hmrState.lastHmrEntryIds ?? []), ...(hmrState.lastEmittedEntryIds ?? [])])
    : undefined
  const dirtyVueEntryIds = hmrState?.dirtyVueEntryIds
  const currentAutoRoutesSignature = ctx.autoRoutesService?.getSignature?.()

  return {
    compilationEntries: withRealpathScope(() => Array.from(compilationCache.entries()).filter(([id]) => {
      const normalizedId = normalizeFsResolvedId(id)
      if (!state.nativeEntrySources?.has(normalizedId) && !state.nativeEntrySources?.has(normalizeSourceId(id))) {
        return false
      }
      const cached = compilationCache.get(id)
      const isStaleAutoRoutesAppEntry = Boolean(
        cached
        && isAppVueFile(normalizedId)
        && typeof currentAutoRoutesSignature === 'string'
        && cached.autoRoutesSignature !== currentAutoRoutesSignature,
      )
      const isAutoRoutesAppRefreshAppEntry = isAutoRoutesAppRefreshUpdate && isAppVueFile(normalizedId)
      return !emittedEntryIds
        || emittedEntryIds.has(normalizedId)
        || dirtyVueEntryIds?.has(normalizedId)
        || isStaleAutoRoutesAppEntry
        || isAutoRoutesAppRefreshAppEntry
    })),
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
  const profile = state.ctx.runtimeState?.build?.hmr?.profile
  const startedAt = performance.now()
  try {
    const emitState = resolveVueBundleEmitState(state)
    if (!emitState) {
      return
    }
    recordHmrProfileOperation(profile, 'vueBundleEligibleCount', emitState.compilationEntries.length)
    // 平台输出选项属于本轮资产计划，所有入口共享；不跨构建代次保存。
    const bundleState = {
      ...state,
      assetContext: resolveVueBundleAssetContext(state.ctx.configService!),
    }
    await emitCompiledBundleEntries(bundle, bundleState, emitState.compilationEntries)
    await emitFallbackPageAssets(bundle, bundleState, {
      emittedEntryIds: emitState.emittedEntryIds,
    })
  }
  finally {
    recordHmrProfileDuration(profile, 'vueGenerateBundleMs', performance.now() - startedAt)
  }
}
