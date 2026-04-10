import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from '../helpers'
import { normalizeWatchPath } from '../../../utils/path'
import { emitWxmlAssetsWithCache } from '../../utils/wxmlEmit'
import { emitJsonAssets } from '../helpers'
import { createGenerateBundleHook } from './emit/generate'

export function createRenderStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, buildTarget } = state

  return function renderStart(this: any) {
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
