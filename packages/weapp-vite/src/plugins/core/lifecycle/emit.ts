import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import path from 'pathe'
import { normalizeWatchPath } from '../../../utils/path'
import { emitStyleSidecarAsset } from '../../css'
import { emitWxmlAssetsWithCache } from '../../utils/wxmlEmit'
import { emitJsonAssets } from '../helpers'
import { createGenerateBundleHook } from './emit/generate'

function isCurrentStyleSidecarUpdate(state: CorePluginState) {
  return state.ctx.runtimeState.build?.hmr?.profile.dirtyReasonSummary?.some(item => item.startsWith('style-sidecar:')) === true
}

export function createRenderStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, buildTarget } = state

  return async function renderStart(this: any) {
    if (isCurrentStyleSidecarUpdate(state)) {
      const currentFile = ctx.runtimeState.build.hmr.profile.file
      if (typeof currentFile === 'string' && path.extname(currentFile)) {
        await emitStyleSidecarAsset(ctx, this, {} as any, currentFile)
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
    })
  }
}

export { createGenerateBundleHook }
