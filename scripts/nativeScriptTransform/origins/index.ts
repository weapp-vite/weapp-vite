import type { InlineOriginSnapshot } from './types'
import { installCaptureLoader } from '../captureLoader'
import { inlineOriginsGlobalKey, inlineOriginTargets } from './source'
import { InlineOriginState } from './state'

export type { InlineOriginSnapshot, InlineProvenance } from './types'

/** 仅安装在独占新进程的诊断执行器，三个真实模块都必须经过既有源码 owner。 */
export function installInlineOrigins() {
  if (Object.hasOwn(globalThis, inlineOriginsGlobalKey)) {
    throw new Error('Inline origins already installed')
  }
  const state = new InlineOriginState()
  const loaders = inlineOriginTargets.map(({ target, instrument }) => installCaptureLoader(new URL(`../../../${target}`, import.meta.url).href, target, instrument))
  Object.defineProperty(globalThis, inlineOriginsGlobalKey, { configurable: true, value: state })
  let disposed = false
  return {
    snapshot: (): InlineOriginSnapshot => ({ ...state.snapshot(), loaders: loaders.map(loader => loader.snapshot()) }),
    assertInstalled() {
      if (disposed || Object.getOwnPropertyDescriptor(globalThis, inlineOriginsGlobalKey)?.value !== state) {
        throw new Error('Inline origins require their active global owner')
      }
      for (const loader of loaders) {
        loader.assertInstalled()
      }
    },
    requestFor: (options: unknown) => state.requestFor(options),
    dispose() {
      if (disposed) {
        return
      }
      state.dispose()
      disposed = true
      for (const loader of [...loaders].reverse()) {
        loader.dispose()
      }
      if (Object.getOwnPropertyDescriptor(globalThis, inlineOriginsGlobalKey)?.value !== state) {
        throw new Error('Inline origin global ownership changed; foreign owner was preserved')
      }
      delete (globalThis as unknown as Record<string, unknown>)[inlineOriginsGlobalKey]
    },
  }
}
