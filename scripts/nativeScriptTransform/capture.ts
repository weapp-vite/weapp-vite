import { scriptBaselineGlobalKey } from '../scriptAnalysisBaseline/installHelpers/source'
import { installCaptureLoader } from './captureLoader'
import { captureGlobalKey, captureTarget, instrumentTransformScriptCapture } from './captureSource'
import { TransformScriptCaptureState } from './captureState'

export { decodeCapturedData, readCapturedStageResult } from './captureRead'
export type { CapturedValue, TransformScriptCaptureRecord } from './captureTypes'

function currentTransferKey(): symbol | undefined {
  const owner: unknown = Object.getOwnPropertyDescriptor(globalThis, scriptBaselineGlobalKey)?.value
  const key: unknown = owner && typeof owner === 'object' ? Object.getOwnPropertyDescriptor(owner, 'transferKey')?.value : undefined
  if (key !== undefined && typeof key !== 'symbol') {
    throw new TypeError('Existing script AST transfer owner has an unexpected key')
  }
  return key
}

/** 必须先安装捕获，再创建 optimized-js execution；该入口不导入任何真实 compiler 模块。 */
export function installTransformScriptCapture() {
  if (Object.hasOwn(globalThis, captureGlobalKey)) {
    throw new Error('transformScript capture already installed')
  }
  const state = new TransformScriptCaptureState(currentTransferKey)
  Object.defineProperty(globalThis, captureGlobalKey, { configurable: true, value: state })
  const loader = installCaptureLoader(new URL(`../../${captureTarget}`, import.meta.url).href, captureTarget, instrumentTransformScriptCapture)
  let disposed = false
  return {
    assertInstalled: () => loader.assertInstalled(),
    snapshot: () => ({ records: state.snapshot(), loader: loader.snapshot() }),
    run: <T>(scenarioId: string, execute: () => Promise<T> | T) => {
      loader.assertInstalled()
      return state.run(scenarioId, execute)
    },
    dispose() {
      if (disposed) {
        return
      }
      state.dispose()
      disposed = true
      loader.dispose()
      if (Object.getOwnPropertyDescriptor(globalThis, captureGlobalKey)?.value !== state) {
        throw new Error('Capture global ownership changed; foreign owner was preserved')
      }
      delete (globalThis as unknown as Record<string, unknown>)[captureGlobalKey]
    },
  }
}
