import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { isTemplate } from '../../../utils'
import { normalizeWatchPath } from '../../../utils/path'
import { emitStyleSidecarAsset } from '../../css'
import { emitWxmlAssetsWithCache } from '../../utils/wxmlEmit'
import { emitJsonAssets } from '../helpers'
import { createGenerateBundleHook } from './emit/generate'

function isCurrentStyleSidecarUpdate(state: CorePluginState) {
  return state.ctx.runtimeState.build?.hmr?.profile.dirtyReasonSummary?.some(item => item.startsWith('style-sidecar:')) === true
}

function resolveIncrementalHmrWxmlTargetIds(state: CorePluginState) {
  const { ctx, hmrState, entriesMap } = state
  if (
    !ctx.configService.isDev
    || !hmrState.hasBuiltOnce
    || hmrState.didEmitAllEntries
  ) {
    return undefined
  }

  const targets = new Set<string>()
  const currentFile = ctx.runtimeState.build.hmr.profile.file
  if (typeof currentFile === 'string' && isTemplate(currentFile)) {
    targets.add(normalizeWatchPath(currentFile))
  }

  const entryIds = hmrState.lastHmrEntryIds?.size
    ? hmrState.lastHmrEntryIds
    : hmrState.lastEmittedEntryIds

  for (const entryId of entryIds ?? []) {
    const candidates = [
      entryId,
      ctx.configService.relativeAbsoluteSrcRoot(entryId),
      removeExtensionDeep(entryId),
      removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(entryId)),
    ]
    for (const candidate of candidates) {
      const entry = entriesMap.get(candidate)
      if (entry?.templatePath) {
        targets.add(normalizeWatchPath(entry.templatePath))
      }
    }
  }

  return targets.size ? targets : undefined
}

export function createRenderStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, buildTarget } = state

  return async function renderStart(this: any) {
    if (isCurrentStyleSidecarUpdate(state)) {
      const currentFile = ctx.runtimeState.build.hmr.profile.file
      if (typeof currentFile === 'string' && path.extname(currentFile)) {
        await emitStyleSidecarAsset(ctx, this, {} as any, currentFile, state.resolvedConfig)
      }
    }
    emitJsonAssets.call(this, state)
    const runtime: WxmlEmitRuntime = {
      addWatchFile: typeof this.addWatchFile === 'function'
        ? (id: string) => { this.addWatchFile(normalizeWatchPath(id)) }
        : undefined,
      emitFile: (asset) => {
        this.emitFile(asset)
      },
    }
    state.watchFilesSnapshot = emitWxmlAssetsWithCache({
      runtime,
      compiler: ctx,
      subPackageMeta,
      emittedCodeCache: ctx.runtimeState.wxml.emittedCode,
      buildTarget,
      targetIds: resolveIncrementalHmrWxmlTargetIds(state),
    })
  }
}

export { createGenerateBundleHook }
